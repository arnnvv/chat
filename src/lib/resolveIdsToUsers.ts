import { db } from "./db";
import { User } from "./db/schema";

export const resolveIdstoUsers = async (ids: number[]): Promise<User[]> => {
  let users: User[] = [];
  for (const id of ids) {
    const user = (await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, id),
    })) as User | undefined;
    if (user) users.push(user);
  }
  return users;
};
