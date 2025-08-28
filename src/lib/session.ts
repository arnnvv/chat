import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./constants";
import { appConfig } from "./config";

export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    ...appConfig.oauthCookieOptions,
    expires: expiresAt,
  });
}

export async function deleteSessionTokenCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    ...appConfig.oauthCookieOptions,
    maxAge: 0,
  });
}
