import { inArray } from "drizzle-orm";
import { db } from "./db";
import { type User, users } from "./db/schema";

export const resolveIdstoUsers = async (ids: number[]): Promise<User[]> => {
  if (ids.length === 0) return [];
  const userList = await db.select().from(users).where(inArray(users.id, ids));
  return userList;
};
