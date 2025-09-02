import { eq } from "drizzle-orm";
import { PROVIDER } from "./constants";
import { db } from "./db";
import { type User, users } from "./db/schema";

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

  const [userByProviderId] = await db
    .select()
    .from(users)
    .where(eq(providerIdColumn, profile.providerId))
    .limit(1);

  if (userByProviderId) {
    if (userByProviderId.picture !== profile.picture) {
      const [updatedUser] = await db
        .update(users)
        .set({ picture: profile.picture })
        .where(eq(users.id, userByProviderId.id))
        .returning();
      return updatedUser;
    }
    return userByProviderId;
  }

  const [userByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (userByEmail) {
    const updateData: Partial<typeof users.$inferInsert> = {
      picture: profile.picture,
    };
    if (provider === "google") {
      updateData.googleId = profile.providerId;
    } else {
      updateData.githubId = profile.providerId;
    }

    const [linkedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userByEmail.id))
      .returning();
    return linkedUser;
  }

  const newUserValues: typeof users.$inferInsert = {
    email: profile.email,
    username: `${provider}-${profile.username}`,
    picture: profile.picture,
    verified: true,
  };

  if (provider === "google") {
    newUserValues.googleId = profile.providerId;
  } else {
    newUserValues.githubId = profile.providerId;
  }

  const [newUser] = await db.insert(users).values(newUserValues).returning();

  return newUser;
}

export async function upsertUserFromGoogleProfile(
  googleId: string,
  email: string,
  name: string,
  picture: string,
): Promise<User> {
  try {
    const username = name.split(" ")[0] || "user";
    return await upsertUser(PROVIDER.GOOGLE, {
      providerId: googleId,
      email,
      username,
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
