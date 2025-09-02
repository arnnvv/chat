import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import type { Device, FriendRequest, Message, User } from "./db/schema";
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

export interface FriendWithLastMsg extends UserWithDevices {
  lastMessage: Message;
}

export const getFriendsWithLastMessage = async (
  userId: number,
): Promise<FriendWithLastMsg[]> => {
  const friendsWithMessages = await db.execute(sql`
    WITH user_friends AS (
      SELECT
        CASE
          WHEN requester_id = ${userId} THEN recipient_id
          ELSE requester_id
        END AS friend_id
      FROM chat_friend_requests
      WHERE (requester_id = ${userId} OR recipient_id = ${userId})
        AND status = 'accepted'
    ),
    ranked_messages AS (
      SELECT
        m.*,
        ROW_NUMBER() OVER (
          PARTITION BY
            CASE
              WHEN m.sender_id = ${userId} THEN m.recipient_id
              ELSE m.sender_id
            END
          ORDER BY m.created_at DESC
        ) as rn
      FROM chat_messages m
      WHERE m.sender_id = ${userId} OR m.recipient_id = ${userId}
    )
    SELECT
      f.friend_id,
      u.username,
      u.email,
      u.password_hash,
      u.verified,
      u.picture,
      u.google_id as "googleId",
      u.github_id as "githubId",
      lm.id as "lastMessageId",
      lm.sender_id as "lastMessageSenderId",
      lm.recipient_id as "lastMessageRecipientId",
      lm.content as "lastMessageContent",
      lm.created_at as "lastMessageCreatedAt",
      (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT('id', d.id, 'publicKey', d.public_key)
        )
        FROM chat_devices d
        WHERE d.user_id = f.friend_id
      ) as devices
    FROM user_friends f
    JOIN chat_users u ON f.friend_id = u.id
    LEFT JOIN ranked_messages lm ON (
      (lm.sender_id = ${userId} AND lm.recipient_id = f.friend_id) OR
      (lm.sender_id = f.friend_id AND lm.recipient_id = ${userId})
    ) AND lm.rn = 1
  `);

  if (!friendsWithMessages.rows.length) return [];

  const result: FriendWithLastMsg[] = friendsWithMessages.rows.map(
    (row: any) => ({
      id: row.friend_id,
      username: row.username,
      email: row.email,
      password_hash: row.password_hash,
      verified: row.verified,
      picture: row.picture,
      googleId: row.googleId,
      githubId: row.githubId,
      devices: row.devices || [],
      lastMessage: row.lastMessageId
        ? {
            id: row.lastMessageId,
            senderId: row.lastMessageSenderId,
            recipientId: row.lastMessageRecipientId,
            content: row.lastMessageContent,
            createdAt: new Date(row.lastMessageCreatedAt),
          }
        : {
            id: -1,
            senderId: -1,
            recipientId: -1,
            content: " ",
            createdAt: new Date(0),
          },
    }),
  );

  return result;
};
