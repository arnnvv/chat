"use server";

import { cookies } from "next/headers";
import { cache } from "react";
import {
  emailVerificationRequests,
  friendReqStatusEnum,
  type FriendRequest,
  friendRequests,
  messages,
  type NewMessage,
  type User,
  users,
  devices,
} from "./lib/db/schema";
import { db } from "./lib/db";
import {
  createSession,
  generateSessionToken,
  invalidateSession,
  type SessionValidationResult,
  validateSessionToken,
} from "./lib/auth";
import {
  hashPassword,
  verifyPasswordHash,
  verifyPasswordStrength,
} from "./lib/password";
import { deleteSessionTokenCookie, setSessionTokenCookie } from "./lib/session";
import { and, eq } from "drizzle-orm";
import { utapi } from "./lib/upload";
import type { UploadFileResult } from "uploadthing/types";
import type { ActionResult } from "./lib/formComtrol";
import { validateEmail } from "./lib/validate";
import { pusherServer } from "./lib/pusher";
import { chatHrefConstructor, toPusherKey } from "./lib/utils";
import { resolveIdstoUsers } from "./lib/resolveIdsToUsers";
import { sendEmail } from "./lib/email";
import { globalGETRateLimit, globalPOSTRateLimit } from "./lib/request";

export const getCurrentSession = cache(
  async (): Promise<SessionValidationResult> => {
    const token = (await cookies()).get("session")?.value ?? null;
    if (token === null) {
      return {
        session: null,
        user: null,
      };
    }
    const result = await validateSessionToken(token);
    return result;
  },
);

export const logInAction = async (
  _: any,
  formData: FormData,
): Promise<{
  success: boolean;
  message: string;
}> => {
  if (!globalPOSTRateLimit()) {
    return {
      success: false,
      message: "Too many requests",
    };
  }

  const email = formData.get("email");
  if (typeof email !== "string")
    return {
      success: false,
      message: "Email is required",
    };

  if (!/^.+@.+\..+$/.test(email) || email.length >= 256)
    return {
      success: false,
      message: "Invalid email",
    };

  const password = formData.get("password");
  if (typeof password !== "string")
    return {
      success: false,
      message: "Password is required",
    };

  try {
    const existingUser: User | undefined = (await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    })) as User | undefined;

    if (!existingUser)
      return {
        success: false,
        message: "User not found",
      };

    if (!(await verifyPasswordHash(existingUser.password_hash, password)))
      return {
        success: false,
        message: "Wrong Password",
      };

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, existingUser.id);
    await setSessionTokenCookie(sessionToken, session.expiresAt);

    return {
      success: true,
      message: "Login successful",
    };
  } catch (e) {
    return {
      success: false,
      message: `Login failed: ${JSON.stringify(e)}`,
    };
  }
};

export const signUpAction = async (
  _: any,
  formData: FormData,
): Promise<{
  success: boolean;
  message: string;
}> => {
  if (!globalPOSTRateLimit()) {
    return {
      success: false,
      message: "Too many requests",
    };
  }

  const email = formData.get("email");
  if (typeof email !== "string")
    return {
      success: false,
      message: "Email is required",
    };

  if (!/^.+@.+\..+$/.test(email) || email.length >= 256)
    return {
      success: false,
      message: "Invalid email",
    };

  const password = formData.get("password");
  if (typeof password !== "string")
    return {
      success: false,
      message: "Password is required",
    };

  const strongPassword = await verifyPasswordStrength(password);
  if (!strongPassword)
    return {
      success: false,
      message: "Weak Password",
    };

  const username = formData.get("username");
  if (typeof username !== "string" || !username)
    return {
      success: false,
      message: "Name is required",
    };

  if (username.includes(" ")) {
    return {
      success: false,
      message: "Username should not contain spaces.",
    };
  }

  const disallowedPrefixes = ["google-", "github-"];
  if (disallowedPrefixes.some((prefix) => username.startsWith(prefix))) {
    return {
      success: false,
      message: "Username cannot start with 'google-' or 'github-'.",
    };
  }
  try {
    const existingUser = (await db.query.users.findFirst({
      where: (users, { or, eq }) =>
        or(eq(users.email, email), eq(users.username, username)),
    })) as User | undefined;

    if (existingUser) {
      if (existingUser.email === email) {
        return {
          success: false,
          message: "Email is already in use",
        };
      }
      if (existingUser.username === username) {
        return {
          success: false,
          message: "Username is already taken",
        };
      }
    }

    const hashedPassword = await hashPassword(password);
    const newUser = {
      username,
      email,
      password_hash: hashedPassword,
    };

    const insertedUser = await db
      .insert(users)
      .values(newUser)
      .returning({ id: users.id });

    const userId = insertedUser[0]?.id;
    if (!userId) throw new Error("Failed to retrieve inserted user ID");

    await sendEmail({
      userId,
      email,
    });

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, userId);
    await setSessionTokenCookie(sessionToken, session.expiresAt);

    return {
      success: true,
      message: "Sign up successful",
    };
  } catch (e) {
    return {
      success: false,
      message: `Sign up failed: ${JSON.stringify(e)}`,
    };
  }
};

export const signOutAction = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  if (!globalGETRateLimit()) {
    return {
      success: false,
      message: "Too many requests",
    };
  }

  const { session } = await getCurrentSession();
  if (session === null)
    return {
      success: false,
      message: "Not authenticated",
    };

  try {
    await invalidateSession(session.id);
    await deleteSessionTokenCookie();
    return {
      success: true,
      message: "LoggingOut",
    };
  } catch (e) {
    return {
      success: false,
      message: `Error LoggingOut ${e}`,
    };
  }
};

export async function verifyOTPAction(formData: FormData) {
  if (!globalPOSTRateLimit()) {
    return {
      success: false,
      message: "Too many requests",
    };
  }

  try {
    const { user } = await getCurrentSession();
    if (!user) return;
    const otpValues = [];
    for (let i = 0; i < 8; i++) {
      otpValues.push(formData.get(`otp[${i}]`) || "");
    }
    const otpValue = otpValues.join("");
    const verificationRequest =
      await db.query.emailVerificationRequests.findFirst({
        where: and(
          eq(emailVerificationRequests.userId, user.id),
          eq(emailVerificationRequests.code, otpValue),
        ),
      });

    if (!verificationRequest) {
      await db
        .delete(emailVerificationRequests)
        .where(eq(emailVerificationRequests.userId, user.id));

      return {
        success: false,
        message: "Invalid or expired verification code",
      };
    }

    if (verificationRequest.expiresAt < new Date()) {
      await db
        .delete(emailVerificationRequests)
        .where(eq(emailVerificationRequests.userId, user.id));

      return {
        success: false,
        message: "Verification code has expired",
      };
    }

    await db.update(users).set({ verified: true }).where(eq(users.id, user.id));
    await db
      .delete(emailVerificationRequests)
      .where(eq(emailVerificationRequests.userId, user.id));

    return {
      success: true,
      message: "Email verified successfully",
    };
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

export async function resendOTPAction() {
  if (!globalGETRateLimit()) {
    return {
      success: false,
      message: "Rate Limit",
    };
  }

  const { user } = await getCurrentSession();
  if (!user)
    return {
      success: false,
      message: "Account Dosen't exist",
    };
  try {
    await sendEmail({
      userId: user.id,
      email: user.email,
    });

    return {
      success: true,
      message: "New OTP has been sent to your email.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to resend OTP. Please try again.",
    };
  }
}

export async function forgotPasswordAction(
  _: any,
  formData: FormData,
): Promise<ActionResult> {
  if (!globalPOSTRateLimit()) {
    return {
      success: false,
      message: "Rate Limit",
    };
  }

  const email = formData.get("email") as string;
  if (typeof email !== "string")
    return {
      success: false,
      message: "Email is required",
    };
  if (!/^.+@.+\..+$/.test(email) && email.length < 256)
    return {
      success: false,
      message: "Invalid email",
    };

  const existingUser: User | undefined = (await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  })) as User | undefined;

  if (!existingUser)
    return {
      success: false,
      message: "User not found",
    };

  try {
    await sendEmail({
      userId: existingUser.id,
      email: existingUser.email,
    });

    return {
      success: true,
      message: "OTP Sent",
    };
  } catch (e) {
    return {
      success: false,
      message: `Error occured ${e}`,
    };
  }
}

export async function verifyOTPForgotPassword(formData: FormData) {
  if (!globalPOSTRateLimit()) {
    return {
      success: false,
      message: "Too many requests",
    };
  }

  try {
    const userEmail = formData.get("userEmail") as string;
    if (!userEmail) {
      return {
        success: false,
        message: "User email is missing",
      };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, userEmail),
    });

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const userId = user.id;

    const otpValues = [];
    for (let i = 0; i < 8; i++) {
      otpValues.push((formData.get(`otp[${i}]`) as string) || "");
    }
    const otpValue = otpValues.join("");
    const verificationRequest =
      await db.query.emailVerificationRequests.findFirst({
        where: and(
          eq(emailVerificationRequests.userId, userId),
          eq(emailVerificationRequests.code, otpValue),
        ),
      });

    if (!verificationRequest) {
      await db
        .delete(emailVerificationRequests)
        .where(eq(emailVerificationRequests.userId, userId));

      return {
        success: false,
        message: "Invalid or expired verification code",
      };
    }

    if (verificationRequest.expiresAt < new Date()) {
      await db
        .delete(emailVerificationRequests)
        .where(eq(emailVerificationRequests.userId, userId));

      return {
        success: false,
        message: "Verification code has expired",
      };
    }

    await db
      .delete(emailVerificationRequests)
      .where(eq(emailVerificationRequests.userId, userId));

    return {
      success: true,
      message: "Email verified successfully",
    };
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

export async function resendOTPForgotPassword(email: string) {
  if (!globalPOSTRateLimit()) {
    return {
      success: false,
      message: "Rate Limit",
    };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    await sendEmail({
      userId: user.id,
      email: email,
    });

    return {
      success: true,
      message: "New OTP has been sent to your email.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to resend OTP. Please try again.",
    };
  }
}

export async function resetPasswordAction(
  _: any,
  formData: FormData,
): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !password || !confirmPassword) {
    return {
      success: false,
      message: "Missing required fields",
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      message: "Passwords don't match",
    };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const strongPassword = await verifyPasswordStrength(password);
    if (!strongPassword)
      return {
        success: false,
        message: "Weak Password",
      };

    const hashedPassword = await hashPassword(password);

    await db
      .update(users)
      .set({
        password_hash: hashedPassword,
      })
      .where(eq(users.email, email));

    return {
      success: true,
      message: "Password successfully reset",
    };
  } catch (error) {
    console.error("Error resetting password:", error);
    return {
      success: false,
      message: "An error occurred. Please try again.",
    };
  }
}

export const changeUsernameAction = async (
  _: any,
  formData: FormData,
): Promise<{
  success: boolean;
  message: string;
}> => {
  const username = formData.get("username");
  if (typeof username !== "string")
    return {
      success: false,
      message: "username is required",
    };

  if (username.includes(" ")) {
    return {
      success: false,
      message: "Username should not contain spaces.",
    };
  }

  const disallowedPrefixes = ["google-", "github-"];
  if (disallowedPrefixes.some((prefix) => username.startsWith(prefix))) {
    return {
      success: false,
      message: "Username cannot start with 'google-' or 'github-'.",
    };
  }

  try {
    const { user } = await getCurrentSession();
    if (!user)
      return {
        success: false,
        message: "Not Logged in",
      };

    await db
      .update(users)
      .set({ username: username })
      .where(eq(users.email, user.email))
      .returning();

    return {
      success: true,
      message: "Username set",
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes("unique constraint")) {
      return {
        success: false,
        message: "Username already taken",
      };
    }
    return {
      success: false,
      message: `${e}`,
    };
  }
};

export async function uploadFile(fd: FormData): Promise<ActionResult> {
  const { session, user } = await getCurrentSession();
  if (session === null)
    return {
      success: false,
      message: "Not Logged in",
    };
  const file = fd.get("file") as File;

  const uploadedFile: UploadFileResult = await utapi.uploadFiles(file);
  if (uploadedFile.error)
    return {
      success: false,
      message: uploadedFile.error.message,
    };
  try {
    await db
      .update(users)
      .set({ picture: uploadedFile.data.url })
      .where(eq(users.id, user.id));
  } catch (e) {
    return {
      success: false,
      message: `Error updating image ${e}`,
    };
  }
  return {
    success: true,
    message: uploadedFile.data.url,
  };
}

export const addFriendAction = async (
  _: any,
  formData: FormData,
): Promise<ActionResult> => {
  const { user } = await getCurrentSession();
  if (!user) return { success: false, message: "not logged in" };
  const receiverEmail = formData.get("friend-email") as string;
  if (typeof receiverEmail !== "string")
    return { success: false, message: "Invalid email" };
  if (!validateEmail({ email: receiverEmail }))
    return { success: false, message: "Invalid email" };
  try {
    const friend: User | undefined = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, receiverEmail),
    });

    if (!friend) return { success: false, message: "User not found" };

    if (friend.id === user.id)
      return { success: false, message: "You can't add yourself as a friend" };

    const existingRequest: FriendRequest | undefined =
      await db.query.friendRequests.findFirst({
        where: (requests, { and, or }) =>
          and(
            or(
              and(
                eq(requests.requesterId, user.id),
                eq(requests.recipientId, friend.id),
              ),
              and(
                eq(requests.requesterId, friend.id),
                eq(requests.recipientId, user.id),
              ),
            ),
            or(eq(requests.status, "pending"), eq(requests.status, "accepted")),
          ),
      });

    if (existingRequest)
      if (existingRequest.status === "pending")
        return { success: false, message: "Friend request already sent" };
      else
        return {
          success: false,
          message: "You are already friends with this user",
        };

    pusherServer.trigger(
      toPusherKey(`user:${friend.id}:incoming_friend_request`),
      `incoming_friend_request`,
      {
        senderId: user.id,
        senderEmail: user.email,
        senderName: user.username,
      },
    );

    const newFriendRequest = {
      requesterId: user.id,
      recipientId: friend.id,
      status: friendReqStatusEnum.enumValues[0],
    };

    await db.insert(friendRequests).values(newFriendRequest);

    return { success: true, message: "Friend request sent" };
  } catch (_e) {
    return { success: false, message: "unexpected error check Server logs" };
  }
};

export const acceptFriendRequest = async (
  friendRequestId: number,
  sessionId: number,
): Promise<
  | { error: string; message?: undefined }
  | { message: string; error?: undefined }
> => {
  try {
    const friendRequest: FriendRequest | undefined =
      await db.query.friendRequests.findFirst({
        where: (requests, { and, eq }) =>
          and(
            eq(requests.requesterId, friendRequestId),
            eq(requests.recipientId, sessionId),
            eq(requests.status, "pending"),
          ),
      });
    if (!friendRequest) return { error: "Friend Request not found" };

    const [friendRequester, user] = await resolveIdstoUsers([
      friendRequestId,
      sessionId,
    ]);

    await Promise.all([
      pusherServer.trigger(
        toPusherKey(`user:${friendRequestId}:friends`),
        "new_friend",
        user,
      ),
      pusherServer.trigger(
        toPusherKey(`user:${sessionId}:friends`),
        "new_friend",
        friendRequester,
      ),
      db
        .update(friendRequests)
        .set({ status: "accepted" })
        .where(
          and(
            eq(friendRequests.requesterId, friendRequestId),
            eq(friendRequests.recipientId, sessionId),
            eq(friendRequests.status, "pending"),
          ),
        ),
    ]);

    return { message: "Friend request accepted" };
  } catch (e) {
    return { error: `failed to accept friend request: ${e}` };
  }
};

export const rejectFriendRequest = async (
  friendRequestId: number,
  sessionId: number,
): Promise<
  | { error: string; message?: undefined }
  | { message: string; error?: undefined }
> => {
  try {
    const friendRequest: FriendRequest | undefined =
      await db.query.friendRequests.findFirst({
        where: (requests, { and, eq }) =>
          and(
            eq(requests.requesterId, friendRequestId),
            eq(requests.recipientId, sessionId),
            eq(requests.status, "pending"),
          ),
      });
    if (!friendRequest) return { error: "Friend Request not found" };
    await db
      .update(friendRequests)
      .set({ status: "declined" })
      .where(
        and(
          eq(friendRequests.requesterId, friendRequestId),
          eq(friendRequests.recipientId, sessionId),
        ),
      );

    return { message: "Friend request rejected" };
  } catch (e) {
    return { error: `failed to reject friend request: ${e}` };
  }
};

export const sendMessageAction = async ({
  senderDeviceId,
  encryptedContent,
  sender,
  receiver,
}: {
  senderDeviceId: number;
  encryptedContent: Record<number, string>;
  sender: Omit<User, "password">;
  receiver: User;
}): Promise<
  | {
      message: string;
      error?: undefined;
    }
  | {
      error: string;
      message?: undefined;
    }
  | undefined
> => {
  try {
    const contentPayload = JSON.stringify({
      senderDeviceId,
      recipients: encryptedContent,
    });

    const messageData: NewMessage = {
      senderId: sender.id,
      recipientId: receiver.id,
      content: contentPayload,
      createdAt: new Date(),
    };

    const [insertedMessage] = await db
      .insert(messages)
      .values(messageData)
      .returning();

    const pusherPayload = {
      ...insertedMessage,
      senderName: sender.username,
      senderImage: sender.picture,
    };

    await Promise.all([
      pusherServer.trigger(
        toPusherKey(`chat:${chatHrefConstructor(sender.id, receiver.id)}`),
        "incoming-message",
        pusherPayload,
      ),
      pusherServer.trigger(
        toPusherKey(`user:${receiver.id}:chats`),
        "new_message",
        pusherPayload,
      ),
    ]);

    return { message: "Message sent" };
  } catch (e) {
    console.error("Error sending message:", e);
    return { error: `Failed to send message: ${e}` };
  }
};

export async function registerDeviceAction(
  publicKey: string,
  deviceName: string,
): Promise<ActionResult> {
  if (!globalPOSTRateLimit()) {
    return { success: false, message: "Too many requests" };
  }

  const { user } = await getCurrentSession();
  if (!user) {
    return { success: false, message: "Not authenticated" };
  }

  if (!publicKey || typeof publicKey !== "string" || publicKey.length < 1) {
    return { success: false, message: "Invalid public key" };
  }
  if (!deviceName || typeof deviceName !== "string" || deviceName.length < 1) {
    return { success: false, message: "Invalid device name" };
  }

  try {
    const [newDevice] = await db
      .insert(devices)
      .values({
        userId: user.id,
        publicKey,
        name: deviceName,
      })
      .returning();

    return {
      success: true,
      message: `Device registered successfully with ID: ${newDevice.id}`,
    };
  } catch (error) {
    console.error("Failed to register device:", error);
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return {
        success: false,
        message: "This public key is already registered for this user.",
      };
    }
    return {
      success: false,
      message: "Failed to register device. Please try again.",
    };
  }
}
