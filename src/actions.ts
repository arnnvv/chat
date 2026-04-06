"use server";

import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { cache } from "react";
import type { UploadFileResult } from "uploadthing/types";
import {
  createSession,
  generateSessionToken,
  invalidateSession,
  type SessionValidationResult,
  validateSessionToken,
} from "./lib/auth";
import { db } from "./lib/db";
import {
  devices,
  type Device,
  deviceVerifications,
  emailVerificationRequests,
  type FriendRequest,
  friendReqStatusEnum,
  friendRequests,
  type Message,
  messages,
  type NewMessage,
  oneTimePreKeys,
  signedPreKeys,
  type User,
  users,
} from "./lib/db/schema";
import type { StoredMessagePayload } from "./lib/crypto/wire-format";
import { sendEmail } from "./lib/email";
import type { ActionResult } from "./lib/formComtrol";
import {
  hashPassword,
  verifyPasswordHash,
  verifyPasswordStrength,
} from "./lib/password";
import { pusherServer } from "./lib/pusher-server";
import { globalGETRateLimit, globalPOSTRateLimit } from "./lib/request";
import {
  type PublicDeviceInfo,
  type SafeUser,
  type SafeUserWithDevices,
} from "./lib/safe-user";
import { deleteSessionTokenCookie, setSessionTokenCookie } from "./lib/session";
import { utapi } from "./lib/upload";
import { chatHrefConstructor, toPusherKey } from "./lib/utils";
import { validateEmail } from "./lib/validate";

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

function toSafeUser(
  user: Pick<User, "id" | "username" | "email" | "verified" | "picture">,
): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    verified: user.verified,
    picture: user.picture,
  };
}

function toPublicDeviceInfo(
  device: Pick<
    Device,
    "id" | "userId" | "publicKey" | "identitySigningPublicKey" | "name"
  >,
): PublicDeviceInfo {
  return {
    id: device.id,
    userId: device.userId,
    publicKey: device.publicKey,
    identitySigningPublicKey: device.identitySigningPublicKey,
    name: device.name,
  };
}

async function getSafeUserWithDevicesById(
  userId: number,
): Promise<SafeUserWithDevices | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      username: true,
      email: true,
      verified: true,
      picture: true,
    },
    with: {
      devices: {
        columns: {
          id: true,
          userId: true,
          publicKey: true,
          identitySigningPublicKey: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    ...toSafeUser(user),
    devices: user.devices.map(toPublicDeviceInfo),
  };
}

async function areUsersFriends(
  userIdA: number,
  userIdB: number,
): Promise<boolean> {
  if (userIdA === userIdB) {
    return true;
  }

  const friendship = await db.query.friendRequests.findFirst({
    where: (requests, { and, or }) =>
      and(
        or(
          and(
            eq(requests.requesterId, userIdA),
            eq(requests.recipientId, userIdB),
          ),
          and(
            eq(requests.requesterId, userIdB),
            eq(requests.recipientId, userIdA),
          ),
        ),
        eq(requests.status, "accepted"),
      ),
    columns: {
      id: true,
    },
  });

  return Boolean(friendship);
}

async function requireAuthenticatedUser(): Promise<User> {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

async function getOwnedDeviceOrThrow(
  userId: number,
  deviceId: number,
): Promise<Device> {
  const device = await db.query.devices.findFirst({
    where: and(eq(devices.id, deviceId), eq(devices.userId, userId)),
  });

  if (!device) {
    throw new Error("Device not found for authenticated user.");
  }

  return device;
}

export const logInAction = async (
  _: any,
  formData: FormData,
): Promise<{
  success: boolean;
  message: string;
}> => {
  if (!(await globalPOSTRateLimit())) {
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

    if (!existingUser) {
      return {
        success: false,
        message: "Invalid email or password",
      };
    }

    if (!existingUser.password_hash) {
      return {
        success: false,
        message:
          "This account was created using a social login. Please sign in with Google or GitHub.",
      };
    }

    const passwordMatch = await verifyPasswordHash(
      existingUser.password_hash,
      password,
    );

    if (!passwordMatch) {
      return {
        success: false,
        message: "Invalid email or password",
      };
    }

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, existingUser.id);
    await setSessionTokenCookie(sessionToken, session.expiresAt);

    return {
      success: true,
      message: "Login successful",
    };
  } catch (e) {
    console.error(`Login failed: ${e}`);
    return {
      success: false,
      message: "An unexpected error occurred during login.",
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
  if (!(await globalPOSTRateLimit())) {
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
  if (!(await globalGETRateLimit())) {
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
  if (!(await globalPOSTRateLimit())) {
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
  if (!(await globalGETRateLimit())) {
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
  if (!(await globalPOSTRateLimit())) {
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
  if (!(await globalPOSTRateLimit())) {
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
  if (!(await globalPOSTRateLimit())) {
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

    revalidatePath("/");
    revalidatePath("/dashboard");

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
      .set({ picture: uploadedFile.data.ufsUrl })
      .where(eq(users.id, user.id));
  } catch (e) {
    return {
      success: false,
      message: `Error updating image ${e}`,
    };
  }
  return {
    success: true,
    message: uploadedFile.data.ufsUrl,
  };
}

export const addFriendAction = async (
  _: any,
  formData: FormData,
): Promise<ActionResult> => {
  if (!(await globalPOSTRateLimit())) {
    return {
      success: false,
      message: "Too many requests",
    };
  }

  const { user } = await getCurrentSession();
  if (!user) {
    return {
      success: false,
      message: "not logged in",
    };
  }
  const receiverEmail = formData.get("friend-email") as string;
  if (typeof receiverEmail !== "string") {
    return {
      success: false,
      message: "Invalid email",
    };
  }
  if (!validateEmail({ email: receiverEmail })) {
    return {
      success: false,
      message: "Invalid email",
    };
  }
  try {
    const friend: User | undefined = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, receiverEmail),
    });

    if (!friend) {
      return {
        success: false,
        message: "User not found",
      };
    }

    if (friend.id === user.id) {
      return {
        success: false,
        message: "You can't add yourself as a friend",
      };
    }

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
      if (existingRequest.status === "pending") {
        return {
          success: false,
          message: "Friend request already sent",
        };
      } else {
        return {
          success: false,
          message: "You are already friends with this user",
        };
      }
    const channelName = toPusherKey(`private-user:${friend.id}`);
    const eventName = "incoming_friend_request";

    await pusherServer.trigger(channelName, eventName, {
      senderId: user.id,
      senderEmail: user.email,
      senderName: user.username,
      senderImage: user.picture,
    });

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
): Promise<
  | { error: string; message?: undefined }
  | { message: string; error?: undefined }
> => {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const friendRequest: FriendRequest | undefined =
      await db.query.friendRequests.findFirst({
        where: (requests, { and, eq }) =>
          and(
            eq(requests.requesterId, friendRequestId),
            eq(requests.recipientId, sessionUser.id),
            eq(requests.status, "pending"),
          ),
      });
    if (!friendRequest) return { error: "Friend Request not found" };

    const [friendRequester, user] = await Promise.all([
      getSafeUserWithDevicesById(friendRequestId),
      getSafeUserWithDevicesById(sessionUser.id),
    ]);

    if (!friendRequester || !user) {
      return { error: "Could not find users to complete the request." };
    }

    await Promise.all([
      pusherServer.trigger(
        toPusherKey(`private-user:${friendRequestId}`),
        "new_friend",
        user,
      ),
      pusherServer.trigger(
        toPusherKey(`private-user:${sessionUser.id}`),
        "new_friend",
        friendRequester,
      ),
      db
        .update(friendRequests)
        .set({ status: "accepted" })
        .where(
          and(
            eq(friendRequests.requesterId, friendRequestId),
            eq(friendRequests.recipientId, sessionUser.id),
            eq(friendRequests.status, "pending"),
          ),
        ),
    ]);

    return { message: "Friend request accepted" };
  } catch (e) {
    return { error: `Failed to accept friend request: ${e}` };
  }
};

export const rejectFriendRequest = async (
  friendRequestId: number,
): Promise<
  | { error: string; message?: undefined }
  | { message: string; error?: undefined }
> => {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const friendRequest: FriendRequest | undefined =
      await db.query.friendRequests.findFirst({
        where: (requests, { and, eq }) =>
          and(
            eq(requests.requesterId, friendRequestId),
            eq(requests.recipientId, sessionUser.id),
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
          eq(friendRequests.recipientId, sessionUser.id),
        ),
      );

    return { message: "Friend request rejected" };
  } catch (e) {
    return { error: `failed to reject friend request: ${e}` };
  }
};

export const sendMessageAction = async ({
  senderDeviceId,
  receiverId,
  payload,
  protocolVersion,
}: {
  senderDeviceId: number;
  receiverId: number;
  payload: StoredMessagePayload;
  protocolVersion: 1 | 2;
}): Promise<
  | {
      message: string;
      sentMessage: Message;
      error?: undefined;
    }
  | {
      error: string;
      message?: undefined;
      sentMessage?: undefined;
    }
  | undefined
> => {
  try {
    if (!(await globalPOSTRateLimit())) {
      return { error: "Too many requests" };
    }

    const sender = await requireAuthenticatedUser();
    await getOwnedDeviceOrThrow(sender.id, senderDeviceId);

    if (payload.senderDeviceId !== senderDeviceId) {
      return { error: "Sender device mismatch." };
    }

    const canMessage = await areUsersFriends(sender.id, receiverId);
    if (!canMessage) {
      return { error: "You can only message accepted contacts." };
    }

    const allAllowedDevices = await db.query.devices.findMany({
      where: or(eq(devices.userId, sender.id), eq(devices.userId, receiverId)),
      columns: {
        id: true,
        userId: true,
      },
    });

    const allowedDeviceIds = new Set(
      allAllowedDevices.map((device) => device.id),
    );
    const recipientDeviceIds = Object.keys(payload.recipients).map((id) =>
      Number.parseInt(id, 10),
    );

    if (
      recipientDeviceIds.length === 0 ||
      recipientDeviceIds.some(
        (deviceId) =>
          !Number.isInteger(deviceId) || !allowedDeviceIds.has(deviceId),
      )
    ) {
      return { error: "Message recipients are invalid." };
    }

    const messageData: NewMessage = {
      senderId: sender.id,
      recipientId: receiverId,
      content: JSON.stringify(payload),
      protocolVersion,
      createdAt: new Date(),
    };

    const [insertedMessage] = await db
      .insert(messages)
      .values(messageData)
      .returning();

    const receiver = await db.query.users.findFirst({
      where: eq(users.id, receiverId),
      columns: {
        id: true,
        username: true,
        picture: true,
      },
    });

    if (!receiver) {
      return { error: "Receiver not found." };
    }

    const chatPusherPayload = {
      ...insertedMessage,
      senderName: sender.username,
      senderImage: sender.picture,
    };

    const chatId = chatHrefConstructor(sender.id, receiverId);
    const notificationEvents = [
      pusherServer.trigger(
        toPusherKey(`private-chat:${chatId}`),
        "incoming-message",
        chatPusherPayload,
      ),
      pusherServer.trigger(
        toPusherKey(`private-user:${receiverId}`),
        "new_message_notification",
        {
          chatId,
          contactId: sender.id,
          contactName: sender.username,
          contactImage: sender.picture,
          message: chatPusherPayload,
        },
      ),
    ];

    if (sender.id !== receiverId) {
      notificationEvents.push(
        pusherServer.trigger(
          toPusherKey(`private-user:${sender.id}`),
          "new_message_notification",
          {
            chatId,
            contactId: receiver.id,
            contactName: receiver.username,
            contactImage: receiver.picture,
            message: chatPusherPayload,
          },
        ),
      );
    }

    await Promise.all(notificationEvents);

    return { message: "Message sent", sentMessage: insertedMessage };
  } catch (e) {
    return { error: `Failed to send message: ${e}` };
  }
};

export async function registerDeviceAction(
  publicKey: string,
  deviceName: string,
): Promise<ActionResult> {
  if (!(await globalPOSTRateLimit())) {
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

type SignedPreKeyInput = {
  keyId: number;
  publicKey: string;
  signature: string;
};

type OneTimePreKeyInput = {
  keyId: number;
  publicKey: string;
};

type PublishKeyBundleInput = {
  devicePublicKey: string;
  identitySigningPublicKey: string;
  deviceName: string;
  signedPreKey: SignedPreKeyInput;
  oneTimePreKeys: OneTimePreKeyInput[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidNumericKeyId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateSignedPreKeyInput(value: SignedPreKeyInput): boolean {
  return (
    isValidNumericKeyId(value.keyId) &&
    isNonEmptyString(value.publicKey) &&
    isNonEmptyString(value.signature)
  );
}

function validateOneTimePreKeyInput(value: OneTimePreKeyInput): boolean {
  return isValidNumericKeyId(value.keyId) && isNonEmptyString(value.publicKey);
}

export async function publishKeyBundleAction(
  input: PublishKeyBundleInput,
): Promise<ActionResult & { deviceId?: number }> {
  if (!(await globalPOSTRateLimit())) {
    return { success: false, message: "Too many requests" };
  }

  try {
    const user = await requireAuthenticatedUser();

    if (
      !isNonEmptyString(input.devicePublicKey) ||
      !isNonEmptyString(input.identitySigningPublicKey) ||
      !isNonEmptyString(input.deviceName) ||
      !validateSignedPreKeyInput(input.signedPreKey) ||
      !Array.isArray(input.oneTimePreKeys) ||
      input.oneTimePreKeys.some((key) => !validateOneTimePreKeyInput(key))
    ) {
      return { success: false, message: "Invalid key bundle payload." };
    }

    const deviceId = await db.transaction(async (tx) => {
      const existingDevice = await tx.query.devices.findFirst({
        where: and(
          eq(devices.userId, user.id),
          eq(devices.publicKey, input.devicePublicKey),
        ),
        columns: {
          id: true,
        },
      });

      const resolvedDeviceId = existingDevice
        ? existingDevice.id
        : (
            await tx
              .insert(devices)
              .values({
                userId: user.id,
                publicKey: input.devicePublicKey,
                identitySigningPublicKey: input.identitySigningPublicKey,
                name: input.deviceName,
              })
              .returning({ id: devices.id })
          )[0]?.id;

      if (!resolvedDeviceId) {
        throw new Error("Failed to create device.");
      }

      await tx
        .update(devices)
        .set({
          identitySigningPublicKey: input.identitySigningPublicKey,
          name: input.deviceName,
        })
        .where(eq(devices.id, resolvedDeviceId));

      await tx
        .update(signedPreKeys)
        .set({ isActive: false })
        .where(eq(signedPreKeys.deviceId, resolvedDeviceId));

      await tx
        .delete(oneTimePreKeys)
        .where(eq(oneTimePreKeys.deviceId, resolvedDeviceId));

      await tx.insert(signedPreKeys).values({
        deviceId: resolvedDeviceId,
        keyId: input.signedPreKey.keyId,
        publicKey: input.signedPreKey.publicKey,
        signature: input.signedPreKey.signature,
        isActive: true,
      });

      if (input.oneTimePreKeys.length > 0) {
        await tx.insert(oneTimePreKeys).values(
          input.oneTimePreKeys.map((key) => ({
            deviceId: resolvedDeviceId,
            keyId: key.keyId,
            publicKey: key.publicKey,
          })),
        );
      }

      return resolvedDeviceId;
    });

    return {
      success: true,
      message: "Key bundle published.",
      deviceId,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to publish key bundle: ${error}`,
    };
  }
}

export async function upgradeLegacyDeviceBundleAction(input: {
  deviceId: number;
  devicePublicKey: string;
  identitySigningPublicKey: string;
  signedPreKey: SignedPreKeyInput;
  oneTimePreKeys: OneTimePreKeyInput[];
}): Promise<ActionResult> {
  if (!(await globalPOSTRateLimit())) {
    return { success: false, message: "Too many requests" };
  }

  try {
    const user = await requireAuthenticatedUser();
    await getOwnedDeviceOrThrow(user.id, input.deviceId);

    if (
      !isNonEmptyString(input.devicePublicKey) ||
      !isNonEmptyString(input.identitySigningPublicKey) ||
      !validateSignedPreKeyInput(input.signedPreKey) ||
      !Array.isArray(input.oneTimePreKeys) ||
      input.oneTimePreKeys.some((key) => !validateOneTimePreKeyInput(key))
    ) {
      return { success: false, message: "Invalid upgrade bundle." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(devices)
        .set({
          publicKey: input.devicePublicKey,
          identitySigningPublicKey: input.identitySigningPublicKey,
        })
        .where(
          and(eq(devices.id, input.deviceId), eq(devices.userId, user.id)),
        );

      await tx
        .update(signedPreKeys)
        .set({ isActive: false })
        .where(eq(signedPreKeys.deviceId, input.deviceId));

      await tx
        .delete(oneTimePreKeys)
        .where(eq(oneTimePreKeys.deviceId, input.deviceId));

      await tx.insert(signedPreKeys).values({
        deviceId: input.deviceId,
        keyId: input.signedPreKey.keyId,
        publicKey: input.signedPreKey.publicKey,
        signature: input.signedPreKey.signature,
        isActive: true,
      });

      if (input.oneTimePreKeys.length > 0) {
        await tx.insert(oneTimePreKeys).values(
          input.oneTimePreKeys.map((key) => ({
            deviceId: input.deviceId,
            keyId: key.keyId,
            publicKey: key.publicKey,
          })),
        );
      }
    });

    return { success: true, message: "Device upgraded successfully." };
  } catch (error) {
    return {
      success: false,
      message: `Failed to upgrade device: ${error}`,
    };
  }
}

export async function fetchKeyBundleAction(targetDeviceId: number): Promise<{
  success: boolean;
  bundle?: {
    identityDHKey: string;
    identitySigningKey: string;
    signedPreKey: { keyId: number; publicKey: string; signature: string };
    oneTimePreKey?: { keyId: number; publicKey: string };
  };
  error?: string;
}> {
  if (!(await globalPOSTRateLimit())) {
    return { success: false, error: "Too many requests" };
  }

  try {
    const user = await requireAuthenticatedUser();
    const targetDevice = await db.query.devices.findFirst({
      where: eq(devices.id, targetDeviceId),
      columns: {
        id: true,
        userId: true,
        publicKey: true,
        identitySigningPublicKey: true,
      },
    });

    if (!targetDevice) {
      return { success: false, error: "Target device not found." };
    }

    const allowed =
      targetDevice.userId === user.id ||
      (await areUsersFriends(user.id, targetDevice.userId));

    if (!allowed) {
      return {
        success: false,
        error: "You are not allowed to fetch this key bundle.",
      };
    }

    const activeSignedPreKey = await db.query.signedPreKeys.findFirst({
      where: and(
        eq(signedPreKeys.deviceId, targetDeviceId),
        eq(signedPreKeys.isActive, true),
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      columns: {
        keyId: true,
        publicKey: true,
        signature: true,
      },
    });

    if (!activeSignedPreKey) {
      return {
        success: false,
        error: "Target device does not have an active signed pre-key.",
      };
    }

    const deletedOpkResult = await db.execute(sql`
      DELETE FROM chat_device_one_time_prekeys
      WHERE id = (
        SELECT id
        FROM chat_device_one_time_prekeys
        WHERE device_id = ${targetDeviceId}
        ORDER BY created_at ASC
        LIMIT 1
      )
      RETURNING key_id AS "keyId", public_key AS "publicKey"
    `);

    const oneTimePreKey = deletedOpkResult.rows[0] as
      | { keyId: number; publicKey: string }
      | undefined;

    return {
      success: true,
      bundle: {
        identityDHKey: targetDevice.publicKey,
        identitySigningKey: targetDevice.identitySigningPublicKey,
        signedPreKey: activeSignedPreKey,
        ...(oneTimePreKey ? { oneTimePreKey } : {}),
      },
    };
  } catch (error) {
    return { success: false, error: `Failed to fetch key bundle: ${error}` };
  }
}

export async function refillOneTimePreKeysAction(
  deviceId: number,
  keys: OneTimePreKeyInput[],
): Promise<ActionResult> {
  if (!(await globalPOSTRateLimit())) {
    return { success: false, message: "Too many requests" };
  }

  try {
    const user = await requireAuthenticatedUser();
    await getOwnedDeviceOrThrow(user.id, deviceId);

    if (
      !Array.isArray(keys) ||
      keys.length === 0 ||
      keys.some((key) => !validateOneTimePreKeyInput(key))
    ) {
      return { success: false, message: "Invalid one-time pre-key payload." };
    }

    await db.insert(oneTimePreKeys).values(
      keys.map((key) => ({
        deviceId,
        keyId: key.keyId,
        publicKey: key.publicKey,
      })),
    );

    return { success: true, message: "One-time pre-keys uploaded." };
  } catch (error) {
    return {
      success: false,
      message: `Failed to refill one-time pre-keys: ${error}`,
    };
  }
}

export async function rotateSignedPreKeyAction(input: {
  deviceId: number;
  signedPreKey: SignedPreKeyInput;
}): Promise<ActionResult> {
  if (!(await globalPOSTRateLimit())) {
    return { success: false, message: "Too many requests" };
  }

  try {
    const user = await requireAuthenticatedUser();
    await getOwnedDeviceOrThrow(user.id, input.deviceId);

    if (!validateSignedPreKeyInput(input.signedPreKey)) {
      return { success: false, message: "Invalid signed pre-key payload." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(signedPreKeys)
        .set({ isActive: false })
        .where(
          and(
            eq(signedPreKeys.deviceId, input.deviceId),
            eq(signedPreKeys.isActive, true),
          ),
        );

      await tx.insert(signedPreKeys).values({
        deviceId: input.deviceId,
        keyId: input.signedPreKey.keyId,
        publicKey: input.signedPreKey.publicKey,
        signature: input.signedPreKey.signature,
        isActive: true,
      });
    });

    return { success: true, message: "Signed pre-key rotated." };
  } catch (error) {
    return {
      success: false,
      message: `Failed to rotate signed pre-key: ${error}`,
    };
  }
}

export async function getCurrentDeviceStateAction(deviceId: number): Promise<{
  success: boolean;
  device?: {
    id: number;
    publicKey: string;
    identitySigningPublicKey: string;
  };
  activeSignedPreKey?: {
    keyId: number;
    publicKey: string;
    signature: string;
    createdAt: string;
  } | null;
  oneTimePreKeyCount?: number;
  requiresUpgrade?: boolean;
  error?: string;
}> {
  if (!(await globalGETRateLimit())) {
    return { success: false, error: "Too many requests" };
  }

  try {
    const user = await requireAuthenticatedUser();
    const device = await getOwnedDeviceOrThrow(user.id, deviceId);
    const activeSignedPreKey = await db.query.signedPreKeys.findFirst({
      where: and(
        eq(signedPreKeys.deviceId, deviceId),
        eq(signedPreKeys.isActive, true),
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      columns: {
        keyId: true,
        publicKey: true,
        signature: true,
        createdAt: true,
      },
    });
    const deviceOneTimePreKeys = await db.query.oneTimePreKeys.findMany({
      where: eq(oneTimePreKeys.deviceId, deviceId),
      columns: {
        id: true,
      },
    });

    return {
      success: true,
      device: {
        id: device.id,
        publicKey: device.publicKey,
        identitySigningPublicKey: device.identitySigningPublicKey,
      },
      activeSignedPreKey: activeSignedPreKey
        ? {
            keyId: activeSignedPreKey.keyId,
            publicKey: activeSignedPreKey.publicKey,
            signature: activeSignedPreKey.signature,
            createdAt: activeSignedPreKey.createdAt.toISOString(),
          }
        : null,
      oneTimePreKeyCount: deviceOneTimePreKeys.length,
      requiresUpgrade:
        device.identitySigningPublicKey.length === 0 ||
        activeSignedPreKey === null,
    };
  } catch (error) {
    return { success: false, error: `Failed to load device state: ${error}` };
  }
}

const MESSAGES_PER_PAGE = 50;

export async function getPaginatedMessages(
  chatId: string,
  cursor: string | null,
): Promise<{ messages: Message[]; nextCursor: string | null }> {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const [userId1, userId2] = chatId.split("--").map(Number);
  if (user.id !== userId1 && user.id !== userId2) {
    throw new Error("You are not allowed to access this chat.");
  }
  const chatPartnerId = user.id === userId1 ? userId2 : userId1;

  const canAccessChat = await areUsersFriends(user.id, chatPartnerId);
  if (!canAccessChat) {
    throw new Error("You are not allowed to access this chat.");
  }

  const query = db
    .select()
    .from(messages)
    .where(
      and(
        or(
          and(
            eq(messages.senderId, user.id),
            eq(messages.recipientId, chatPartnerId),
          ),
          and(
            eq(messages.senderId, chatPartnerId),
            eq(messages.recipientId, user.id),
          ),
        ),
        cursor ? lt(messages.createdAt, new Date(cursor)) : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(MESSAGES_PER_PAGE);

  const fetchedMessages = await query;

  let nextCursor: string | null = null;
  if (fetchedMessages.length === MESSAGES_PER_PAGE) {
    nextCursor = fetchedMessages[MESSAGES_PER_PAGE - 1].createdAt.toISOString();
  }

  return { messages: fetchedMessages, nextCursor };
}

export async function getVerifiedDeviceIdsForContact(
  contactUserId: number,
): Promise<number[]> {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("Not authenticated");
  }

  if (contactUserId !== user.id) {
    const canAccessContact = await areUsersFriends(user.id, contactUserId);
    if (!canAccessContact) {
      throw new Error("You are not allowed to view these devices.");
    }
  }

  const contactDevices = await db.query.devices.findMany({
    where: eq(devices.userId, contactUserId),
    columns: { id: true },
  });

  if (contactDevices.length === 0) {
    return [];
  }

  const contactDeviceIds = contactDevices.map((d) => d.id);

  const verifications = await db
    .select({ verifiedDeviceId: deviceVerifications.verifiedDeviceId })
    .from(deviceVerifications)
    .where(
      and(
        eq(deviceVerifications.verifierUserId, user.id),
        inArray(deviceVerifications.verifiedDeviceId, contactDeviceIds),
      ),
    );

  return verifications.map((v) => v.verifiedDeviceId);
}

/**
 * Marks a set of devices as trusted by the current user.
 * @param deviceIdsToVerify An array of device IDs to mark as verified.
 * @returns ActionResult indicating success or failure.
 */
export async function verifyDevicesAction(
  deviceIdsToVerify: number[],
): Promise<ActionResult> {
  const { user } = await getCurrentSession();
  if (!user) {
    return { success: false, message: "Not authenticated" };
  }

  if (!Array.isArray(deviceIdsToVerify) || deviceIdsToVerify.length === 0) {
    return { success: false, message: "No device IDs provided" };
  }

  try {
    const valuesToInsert = deviceIdsToVerify.map((deviceId) => ({
      verifierUserId: user.id,
      verifiedDeviceId: deviceId,
    }));

    // 'onConflictDoNothing' handles cases where a device is already verified.
    await db
      .insert(deviceVerifications)
      .values(valuesToInsert)
      .onConflictDoNothing();

    return { success: true, message: "Devices verified successfully." };
  } catch (error) {
    console.error("Failed to verify devices:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}
