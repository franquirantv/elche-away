import { storageConfig } from "./storage-config";

const releaseErrors = {
  ENVIRONMENT: "VERCEL_ENV must select preview or production.",
  DATABASE: "Review DATABASE_URL, sslmode=verify-full and RELEASE_DATABASE_HOST (direct hostname only).",
  AUTH: "Review NEON_AUTH_BASE_URL and RELEASE_AUTH_ORIGIN (HTTPS origin without path).",
  BOOTSTRAP: "RELEASE_BOOTSTRAP must be 1 in production with ADMIN_USER_ID absent, or be removed.",
  OWNER: "Configure the verified ADMIN_USER_ID, or explicitly use the first-access bootstrap procedure.",
  COOKIE: "NEON_AUTH_COOKIE_SECRET is missing or shorter than 32 characters.",
  TEST_SERVER: "Remove ARCHIVE_TEST_SERVER from deployment configuration.",
  PUBLIC_VARIABLES: "Unexpected NEXT_PUBLIC_* configuration; only reviewed Vercel metadata is allowed.",
  STORAGE: "Review Storage credentials, endpoint, bucket, environment and STORAGE_DATABASE_HOST binding.",
} as const;

class ReleaseConfigError extends Error {
  constructor(readonly code: keyof typeof releaseErrors) { super(code); }
}

// Fixed diagnostic text only: never expose URL parser errors, input values or
// upstream messages, which can contain credentials.
export function releaseFailureMessage(error: unknown) {
  return error instanceof ReleaseConfigError
    ? `Release configuration failed [${error.code}]. ${releaseErrors[error.code]} No values or credentials were logged.`
    : "Release configuration failed [UNKNOWN]. Review docs/RELEASE.md; no values or credentials were logged.";
}

// Exact names from Vercel documentation and observed hosted build metadata.
// Do not allow arbitrary NEXT_PUBLIC_VERCEL_* names or application secrets.
const vercelPublicMetadata = new Set([
  "ENV", "TARGET_ENV", "URL", "BRANCH_URL", "PROJECT_PRODUCTION_URL", "HASH_SALT",
  "GIT_PROVIDER", "GIT_REPO_SLUG", "GIT_REPO_OWNER", "GIT_REPO_ID", "GIT_COMMIT_REF",
  "GIT_COMMIT_SHA", "GIT_COMMIT_MESSAGE", "GIT_COMMIT_AUTHOR_LOGIN", "GIT_COMMIT_AUTHOR_NAME", "GIT_PULL_REQUEST_ID",
  "GIT_PREVIOUS_SHA", "PROJECT_ID", "DEPLOYMENT_ID", "OBSERVABILITY_CLIENT_CONFIG",
].map((name) => `NEXT_PUBLIC_VERCEL_${name}`));

// Offline validation only: bindings must be reviewed against the service consoles.
export function validateReleaseConfig(env: Record<string, string | undefined>) {
  if (!["preview", "production"].includes(env.VERCEL_ENV ?? "")) throw new ReleaseConfigError("ENVIRONMENT");
  let database: URL;
  let auth: URL;
  try { database = new URL(env.DATABASE_URL ?? ""); } catch { throw new ReleaseConfigError("DATABASE"); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.pathname.slice(1)
    || !database.username || !database.password || database.searchParams.get("sslmode") !== "verify-full"
    || database.hostname.replace("-pooler", "") !== env.RELEASE_DATABASE_HOST) throw new ReleaseConfigError("DATABASE");
  try { auth = new URL(env.NEON_AUTH_BASE_URL ?? ""); } catch { throw new ReleaseConfigError("AUTH"); }
  if (auth.protocol !== "https:" || auth.username || auth.password || auth.search || auth.hash
    || auth.origin !== env.RELEASE_AUTH_ORIGIN) throw new ReleaseConfigError("AUTH");
  const bootstrap = env.RELEASE_BOOTSTRAP === "1";
  if (env.RELEASE_BOOTSTRAP !== undefined && env.RELEASE_BOOTSTRAP !== "1") throw new ReleaseConfigError("BOOTSTRAP");
  if (bootstrap) {
    // Missing owner configuration already denies every protected operation.
    // Never accept a placeholder ID or automatically authorize the first login.
    if (env.VERCEL_ENV !== "production" || env.ADMIN_USER_ID) throw new ReleaseConfigError("BOOTSTRAP");
  } else if (!env.ADMIN_USER_ID?.trim() || env.ADMIN_USER_ID !== env.ADMIN_USER_ID.trim()) {
    throw new ReleaseConfigError("OWNER");
  }
  if ((env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) < 32) throw new ReleaseConfigError("COOKIE");
  if (env.ARCHIVE_TEST_SERVER) throw new ReleaseConfigError("TEST_SERVER");
  for (const key of Object.keys(env)) {
    if (key.startsWith("NEXT_PUBLIC_") && !(env.VERCEL === "1" && vercelPublicMetadata.has(key))) throw new ReleaseConfigError("PUBLIC_VARIABLES");
  }
  try { storageConfig(env); } catch { throw new ReleaseConfigError("STORAGE"); }
}
