import { eq } from "drizzle-orm";
import { db } from "./db";
import { FriendRequest, User } from "./db/schema";
import { resolveIdstoUsers } from "./resolveIdsToUsers";

export const getFriends = async (id: string): Promise<User[]> => {
  const friendships: FriendRequest[] = await db.query.friendRequests.findMany({
    where: (requests, { and, or }) =>
      and(
        or(eq(requests.requesterId, id), eq(requests.recipientId, id)),
        eq(requests.status, "accepted"),
      ),
  });

  const friendIds: string[] = friendships.map(
    (friendship: FriendRequest): string =>
      friendship.requesterId === id
        ? friendship.recipientId
        : friendship.requesterId,
  );

  const friends: User[] = await resolveIdstoUsers(friendIds);
  return friends;
};
