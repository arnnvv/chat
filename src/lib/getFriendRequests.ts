import { SQL } from "drizzle-orm";
import { db } from "./db";
import { FriendRequest } from "./db/schema";

export const getFriendRequests = async (id: string): Promise<FriendRequest[]> =>
  await db.query.friendRequests.findMany({
    where: (requests, { and, eq }): SQL<unknown> | undefined =>
      and(eq(requests.recipientId, id), eq(requests.status, "pending")),
  });
``;