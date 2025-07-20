import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import type { Device, FriendRequest, User } from "./db/schema";
import { users } from "./db/schema";

export type UserWithDevices = User & {
  devices: Pick<Device, "id" | "publicKey">[];
};

export const getFriends = async (id: number): Promise<UserWithDevices[]> => {
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

  if (friendIds.length === 0) {
    return [];
  }

  const friends: UserWithDevices[] = await db.query.users.findMany({
    where: inArray(users.id, friendIds),
    with: {
      devices: {
        columns: {
          id: true,
          publicKey: true,
        },
      },
    },
  });

  return friends;
};
