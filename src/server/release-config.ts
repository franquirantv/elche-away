import { storageConfig } from "./storage-config";

// Offline validation only: bindings must be reviewed against the service consoles.
export function validateReleaseConfig(env: Record<string, string | undefined>) {
  if (!["preview", "production"].includes(env.VERCEL_ENV ?? "")) throw new Error("Release requires preview or production.");
  const database = new URL(env.DATABASE_URL ?? "");
  const auth = new URL(env.NEON_AUTH_BASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.pathname.slice(1)
    || !database.username || !database.password || database.searchParams.get("sslmode") !== "verify-full"
    || database.hostname.replace("-pooler", "") !== env.RELEASE_DATABASE_HOST) throw new Error("Review release database binding and TLS.");
  if (auth.protocol !== "https:" || auth.username || auth.password || auth.search || auth.hash
    || auth.origin !== env.RELEASE_AUTH_ORIGIN) throw new Error("Review release Auth binding.");
  const bootstrap = env.RELEASE_BOOTSTRAP === "1";
  if (env.RELEASE_BOOTSTRAP !== undefined && env.RELEASE_BOOTSTRAP !== "1") throw new Error("Invalid bootstrap configuration.");
  if (bootstrap) {
    // Missing owner configuration already denies every protected operation.
    // Never accept a placeholder ID or automatically authorize the first login.
    if (env.VERCEL_ENV !== "production" || env.ADMIN_USER_ID) throw new Error("Bootstrap requires production with no configured owner.");
  } else if (!env.ADMIN_USER_ID?.trim() || env.ADMIN_USER_ID !== env.ADMIN_USER_ID.trim()) {
    throw new Error("Review release owner.");
  }
  if ((env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) < 32) throw new Error("Review release cookie secret.");
  if (env.ARCHIVE_TEST_SERVER) throw new Error("Test server configuration is forbidden in releases.");
  for (const key of Object.keys(env)) {
    if (key.startsWith("NEXT_PUBLIC_")) throw new Error("Review browser-exposed environment variables.");
  }
  storageConfig(env);
}
