import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const cookieOption = {
  path: "/",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax",
} as const satisfies Partial<ResponseCookie>;
