import { encodeBase64urlNoPadding } from "./encoding";
import { Google } from "./google";
import { GitHub } from "./github";

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

const getOAuthCredentials = (
  provider: "google" | "github",
): {
  clientId: string;
  clientSecret: string;
  redirectURL: string;
} => {
  const providerUpperCase = provider.toUpperCase();
  const clientIdEnv = `${providerUpperCase}_CLIENT_ID`;
  const clientSecretEnv = `${providerUpperCase}_CLIENT_SECRET`;
  const redirectUrlEnv = `${providerUpperCase}_REDIRECT_URL`;

  const clientId = process.env[clientIdEnv];
  const clientSecret = process.env[clientSecretEnv];
  const redirectURL = process.env[redirectUrlEnv];

  if (!clientId) throw new Error(`${clientIdEnv} is not set.`);
  if (!clientSecret) throw new Error(`${clientSecretEnv} is not set.`);
  if (!redirectURL) throw new Error(`${redirectUrlEnv} is not set.`);

  return { clientId, clientSecret, redirectURL };
};

const googleCreds = getOAuthCredentials("google");
export const google = new Google(
  googleCreds.clientId,
  googleCreds.clientSecret,
  googleCreds.redirectURL,
);

const githubCreds = getOAuthCredentials("github");
export const github = new GitHub(
  githubCreds.clientId,
  githubCreds.clientSecret,
  githubCreds.redirectURL,
);
