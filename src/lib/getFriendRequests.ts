import type { SQL } from "drizzle-orm";
import { db } from "./db";
import type { FriendRequest } from "./db/schema";

export const getFriendRequests = async (id: number): Promise<FriendRequest[]> =>
  await db.query.friendRequests.findMany({
    where: (requests, { and, eq }): SQL<unknown> | undefined =>
      and(eq(requests.recipientId, id), eq(requests.status, "pending")),
  });
``;
