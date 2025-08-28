import { encodeBase64urlNoPadding } from "./encoding";
import { Google } from "./google";
import { GitHub } from "./github";
import { appConfig } from "./config";

export function generateState(): string {
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  return encodeBase64urlNoPadding(randomValues);
}

export function generateCodeVerifier(): string {
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  return encodeBase64urlNoPadding(randomValues);
}

export function generateNonce(): string {
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  return encodeBase64urlNoPadding(randomValues);
}

export const google = new Google(
  appConfig.google.clientId,
  appConfig.google.clientSecret,
  appConfig.google.redirectUrl,
);

export const github = new GitHub(
  appConfig.github.clientId,
  appConfig.github.clientSecret,
  appConfig.github.redirectUrl,
);
