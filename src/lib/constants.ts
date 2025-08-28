export const SESSION_COOKIE_NAME = "session" as const;

export const OAUTH_COOKIE_MAX_AGE_SECONDS = 600 as const; // 60 * 10
export const SESSION_MAX_AGE_SECONDS = 2592000 as const; // 60 * 60 * 24 * 30
export const SESSION_REFRESH_THRESHOLD_SECONDS = 1296000 as const; // 60 * 60 * 24 * 15

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google_oauth_state" as const;
export const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME =
  "google_code_verifier" as const;
export const GOOGLE_OAUTH_NONCE_COOKIE_NAME = "google_oauth_nonce" as const;
export const GOOGLE_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token" as const;
export const GOOGLE_ACCOUNTS_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth" as const;
export const GOOGLE_OID_ENDPOINT =
  "https://accounts.google.com/.well-known/openid-configuration" as const;

export const GITHUB_OAUTH_STATE_COOKIE_NAME = "github_oauth_state" as const;
export const GITHUB_OAUTH_CODE_VERIFIER_COOKIE_NAME =
  "github_code_verifier" as const;
export const GITHUB_TOKEN_ENDPOINT =
  "https://github.com/login/oauth/access_token" as const;
export const GITHUB_USER_ENDPOINT = "https://api.github.com/user" as const;
export const GITHUB_USER_EMAILS_ENDPOINT =
  "https://api.github.com/user/emails" as const;
export const GITHUB_AUTHORIZE_ENDPOINT =
  "https://github.com/login/oauth/authorize" as const;

export const PROVIDER = {
  GOOGLE: "google",
  GITHUB: "github",
} as const;
