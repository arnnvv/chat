export const SESSION_COOKIE_NAME = "session";

export const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google_oauth_state";
export const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME = "google_code_verifier";
export const GOOGLE_OAUTH_NONCE_COOKIE_NAME = "google_oauth_nonce";

export const GITHUB_OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
export const GITHUB_OAUTH_CODE_VERIFIER_COOKIE_NAME = "github_code_verifier";

export const PROVIDER = {
  GOOGLE: "google",
  GITHUB: "github",
} as const;
