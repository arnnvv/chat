import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type User } from "./db/schema";
import { PROVIDER } from "./constants";

type Provider = (typeof PROVIDER)[keyof typeof PROVIDER];

type Profile = {
  providerId: string;
  email: string;
  username: string;
  picture: string;
};

async function upsertUser(provider: Provider, profile: Profile): Promise<User> {
  const providerIdColumn =
    provider === "google" ? users.googleId : users.githubId;

  const existingUserByProviderId = await db
    .select()
    .from(users)
    .where(eq(providerIdColumn, profile.providerId))
    .limit(1);

  if (existingUserByProviderId.length > 0) {
    const user = existingUserByProviderId[0];
    if (user.picture !== profile.picture) {
      const [updatedUser] = await db
        .update(users)
        .set({ picture: profile.picture })
        .where(eq(users.id, user.id))
        .returning();
      return updatedUser;
    }
    return user;
  }

  const existingUserByEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (existingUserByEmail.length > 0) {
    const user = existingUserByEmail[0];
    const [linkedUser] = await db
      .update(users)
      .set({ [providerIdColumn.name]: profile.providerId })
      .where(eq(users.id, user.id))
      .returning();
    return linkedUser;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email: profile.email,
      username: `${provider}-${profile.username}`,
      picture: profile.picture,
      [providerIdColumn.name]: profile.providerId,
      verified: true,
    })
    .returning();

  return newUser;
}

export async function upsertUserFromGoogleProfile(
  googleId: string,
  email: string,
  name: string,
  picture: string,
): Promise<User> {
  try {
    return await upsertUser(PROVIDER.GOOGLE, {
      providerId: googleId,
      email,
      username: name.split(" ")[0],
      picture,
    });
  } catch (error) {
    console.error(`Error in upsertUserFromGoogleProfile: ${error}`);
    throw new Error("Could not create or update user profile from Google.");
  }
}

export async function upsertUserFromGitHubProfile(
  githubId: string,
  email: string,
  name: string,
  picture: string,
): Promise<User> {
  try {
    return await upsertUser(PROVIDER.GITHUB, {
      providerId: githubId,
      email,
      username: name,
      picture,
    });
  } catch (error) {
    console.error(`Error in upsertUserFromGitHubProfile: ${error}`);
    throw new Error("Could not create or update user profile from GitHub.");
  }
}
