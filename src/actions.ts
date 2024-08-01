"use server";
import { generateId, LegacyScrypt } from "lucia";
import { ActionResult } from "./app/_components/FormComponent";
import { db } from "./lib/db";
import { users, type User } from "./lib/db/schema";
import lucia, { validateRequest } from "./lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validatedEmail } from "./validate";
import { fetchRedis } from "./helpers/redis";
import { CACHE_TTL, redis } from "./lib/db/cache";

export const logInAction = async (
  _: any,
  formData: FormData,
): Promise<ActionResult> => {
  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required" };
  if (!validatedEmail(email)) return { error: "Invalid email" };
  const password = formData.get("password");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 64
  )
    return { error: "Invalid password" };
  try {
    const cachedUser = await fetchRedis("get", `user:${email}`);
    let existingUser: User | undefined;
    if (cachedUser) existingUser = JSON.parse(cachedUser) as User;
    else {
      existingUser = (await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email),
      })) as User | undefined;

      if (existingUser)
        await redis.set(`user:${email}`, JSON.stringify(existingUser), {
          ex: CACHE_TTL,
        });
    }
    if (!existingUser) return { error: "User not found" };
    const validPassword = await new LegacyScrypt().verify(
      existingUser.password,
      password,
    );
    if (!validPassword) return { error: "Incorrect Password" };
    const session = await lucia.createSession(existingUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
  } catch {
    throw new Error("Something went wrong");
  }
  return redirect("/");
};

export const signUpAction = async (
  _: any,
  formData: FormData,
): Promise<ActionResult> => {
  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required" };
  if (!validatedEmail(email)) return { error: "Invalid email" };
  const password = formData.get("password");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 64
  )
    return { error: "Invalid password" };
  const id = generateId(10);
  try {
    const cachedUser = await fetchRedis("get", `user:${email}`);
    if (cachedUser) return { error: "User already exists" };
    const hashedPassword = await new LegacyScrypt().hash(password);
    const existingUser = (await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    })) as User | undefined;
    if (existingUser) return { error: "User already exists" };

    const newUser = {
      id,
      password: hashedPassword,
      email,
    };

    await db.insert(users).values(newUser);

    await redis.set(`user:${email}`, JSON.stringify(newUser), {
      ex: CACHE_TTL,
    });

    const session = await lucia.createSession(id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
  } catch {
    throw new Error("Unexpected error");
  }
  return redirect("/");
};

export const signOutAction = async (): Promise<ActionResult> => {
  const { session } = await validateRequest();
  if (!session) return { error: "not logged in" };
  await lucia.invalidateSession(session.id);
  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );
  return redirect("/login");
};
