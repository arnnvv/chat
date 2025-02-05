import { eq } from "drizzle-orm";
import { db } from "./db";
import type { FriendRequest, User } from "./db/schema";
import { resolveIdstoUsers } from "./resolveIdsToUsers";

export const getFriends = async (id: number): Promise<User[]> => {
  const friendships: FriendRequest[] = await db.query.friendRequests.findMany({
    where: (requests, { and, or }) =>
      and(
        or(eq(requests.requesterId, id), eq(requests.recipientId, id)),
        eq(requests.status, "accepted"),
      ),
  });

  const friendIds: number[] = friendships.map((friendship: FriendRequest) =>
    friendship.requesterId === id
      ? friendship.recipientId
      : friendship.requesterId,
  );

  const friends: User[] = await resolveIdstoUsers(friendIds);
  return friends;
};
