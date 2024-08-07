"use server";
import { generateId, LegacyScrypt } from "lucia";
import { ActionResult } from "./app/_components/FormComponent";
import { db } from "./lib/db";
import {
  friendReqStatusEnum,
  type FriendRequest,
  friendRequests,
  users,
  type User,
} from "./lib/db/schema";
import lucia, { validateRequest } from "./lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validatedEmail } from "./validate";
import { fetchRedis } from "./helpers/redis";
import { CACHE_TTL, redis } from "./lib/db/cache";
import { eq, and } from "drizzle-orm";
import { ZodError, ZodIssue } from "zod";

export const logInAction = async (
  _: any,
  formData: FormData,
): Promise<ActionResult> => {
  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required" };
  if (!validatedEmail(email)) return { error: "Invalid email" };
  const password = formData.get("password");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 64
  )
    return { error: "Invalid password" };
  try {
    const cachedUser = await fetchRedis("get", `user:${email}`);
    let existingUser: User | undefined;
    if (cachedUser) existingUser = JSON.parse(cachedUser) as User;
    else {
      existingUser = (await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email),
      })) as User | undefined;

      if (existingUser)
        await redis.set(`user:${email}`, JSON.stringify(existingUser), {
          ex: CACHE_TTL,
        });
    }
    if (!existingUser) return { error: "User not found" };
    const validPassword = await new LegacyScrypt().verify(
      existingUser.password,
      password,
    );
    if (!validPassword) return { error: "Incorrect Password" };
    const session = await lucia.createSession(existingUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
  } catch {
    return { error: "Something went wrong" };
  }
  return redirect("/");
};

export const signUpAction = async (
  _: any,
  formData: FormData,
): Promise<ActionResult> => {
  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required" };
  if (!validatedEmail(email)) return { error: "Invalid email" };
  const password = formData.get("password");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 64
  )
    return { error: "Invalid password" };
  const id = generateId(10);
  try {
    const cachedUser = await fetchRedis("get", `user:${email}`);
    if (cachedUser) return { error: "User already exists" };
    const hashedPassword = await new LegacyScrypt().hash(password);
    const existingUser = (await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    })) as User | undefined;
    if (existingUser) return { error: "User already exists" };

    const newUser = {
      id,
      password: hashedPassword,
      email,
    };

    await db.insert(users).values(newUser);

    await redis.set(`user:${email}`, JSON.stringify(newUser), {
      ex: CACHE_TTL,
    });

    const session = await lucia.createSession(id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
  } catch {
    return { error: "Unexpected error" };
  }
  return redirect("/");
};

export const signOutAction = async (): Promise<ActionResult> => {
  const { session } = await validateRequest();
  if (!session) return { error: "not logged in" };
  await lucia.invalidateSession(session.id);
  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );
  return redirect("/login");
};

export const addFriendAction = async (
  _: any,
  formData: FormData,
): Promise<ActionResult> => {
  const { user } = await validateRequest();
  if (!user) return { error: "not logged in" };
  const receiverEmail = formData.get("friend-email") as string;
  if (typeof receiverEmail !== "string") return { error: "Invalid email" };
  if (!validatedEmail(receiverEmail)) return { error: "Invalid email" };
  try {
    let friend = await fetchRedis("get", `user:${receiverEmail}`);
    if (!friend) {
      friend = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, receiverEmail),
      });

      if (friend)
        await redis.set(`user:${receiverEmail}`, JSON.stringify(friend), {
          ex: CACHE_TTL,
        });
    } else friend = JSON.parse(friend);

    if (!friend) return { error: "User not found" };

    if (friend.id === user.id)
      return { error: "You can't add yourself as a friend" };

    const cacheKey = `friendRequest:${user.id}:${friend.id}`;
    let existingRequest = await fetchRedis("get", cacheKey);

    if (!existingRequest) {
      existingRequest = await db.query.friendRequests.findFirst({
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
        await redis.set(cacheKey, JSON.stringify(existingRequest), {
          ex: CACHE_TTL,
        });
    } else existingRequest = JSON.parse(existingRequest);

    if (existingRequest)
      if (existingRequest.status === "pending")
        return { error: "Friend request already sent" };
      else return { error: "You are already friends with this user" };

    const newFriendRequest = {
      id: generateId(21),
      requesterId: user.id,
      recipientId: friend.id,
      status: friendReqStatusEnum.enumValues[0],
    };

    await db.insert(friendRequests).values(newFriendRequest);

    await redis.set(cacheKey, JSON.stringify(newFriendRequest), {
      ex: CACHE_TTL,
    });

    return { message: "Friend request sent" };
  } catch (e) {
    if (e instanceof ZodError) {
      const errors = e.issues.map((issue: ZodIssue): string => issue.message);
      return { error: errors.join(", ") };
    }
    console.error(e);
    return { error: "unexpected error check Server logs" };
  }
};

export const getFriendRequestsAction = async (
  id: string,
): Promise<
  | { data: FriendRequest[]; error?: undefined }
  | { data?: undefined; error: string }
> => {
  const { user } = await validateRequest();
  if (!user) return { error: "not logged in" };
  try {
    const cachedRequests = (await fetchRedis(
      "get",
      `pendingFriendRequests:${id}`,
    )) as string;
    if (cachedRequests)
      return { data: JSON.parse(cachedRequests) as FriendRequest[] };
    const pendingRequests: FriendRequest[] =
      await db.query.friendRequests.findMany({
        where: (requests, { and, eq }) =>
          and(eq(requests.recipientId, id), eq(requests.status, "pending")),
      });

    await redis.set(
      `pendingFriendRequests:${id}`,
      JSON.stringify(pendingRequests),
      {
        ex: CACHE_TTL,
      },
    );

    return { data: pendingRequests };
  } catch (e) {
    console.error(`Get pending friend requests error: ${e}`);
    throw new Error(`Get pending friend requests error: ${e}`);
  }
};

export const acceptFriendRequest = async (
  friendRequestId: string,
  sessionId: string,
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
      .set({ status: "accepted" })
      .where(
        and(
          eq(friendRequests.requesterId, friendRequestId),
          eq(friendRequests.recipientId, sessionId),
        ),
      );

    await redis.del(`pendingFriendRequests:${sessionId}`);
    await redis.del(`friendRequests:${friendRequest.requesterId}`);
    await redis.del(`friendRequests:${sessionId}`);

    return { message: "Friend request accepted" };
  } catch (e) {
    return { error: `failed to accept friend request: ${e}` };
  }
};

export const rejectFriendRequest = async (
  friendRequestId: string,
  sessionId: string,
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

    await redis.del(`pendingFriendRequests:${sessionId}`);
    await redis.del(`friendRequests:${friendRequest.requesterId}`);
    await redis.del(`friendRequests:${sessionId}`);

    return { message: "Friend request rejected" };
  } catch (e) {
    return { error: `failed to reject friend request: ${e}` };
  }
};

export const resolveIdstoUserAction = async (
  ids: string[],
): Promise<User[]> => {
  let users: User[] = [];
  for (const id of ids) {
    const user = (await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, id),
    })) as User | undefined;
    if (user) users.push(user);
  }
  return users;
};

export const getFriendsAction = async (id: string): Promise<User[]> => {
  try {
    const cachedFriends = (await fetchRedis("get", `friends:${id}`)) as string;
    if (cachedFriends) return JSON.parse(cachedFriends) as User[];

    const friendships: FriendRequest[] = await db.query.friendRequests.findMany(
      {
        where: (requests, { and, or }) =>
          and(
            or(eq(requests.requesterId, id), eq(requests.recipientId, id)),
            eq(requests.status, "accepted"),
          ),
      },
    );

    const friendIds: string[] = friendships.map(
      (friendship: FriendRequest): string =>
        friendship.requesterId === id
          ? friendship.recipientId
          : friendship.requesterId,
    );

    const friends: User[] = await resolveIdstoUserAction(friendIds);

    await redis.set(`friends:${id}`, JSON.stringify(friends), {
      ex: CACHE_TTL,
    });

    return friends;
  } catch (e) {
    throw new Error(`Failed to fetch friends ${e}`);
  }
};
