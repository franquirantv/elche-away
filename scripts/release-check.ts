import { releaseFailureMessage, validateReleaseConfig } from "../src/server/release-config";

// Do not load .env.local: inspect only the selected deployment's environment.
try {
  if (process.env.VERCEL_ENV === "preview") {
    // Vercel's Build Command is shared across environments. Preview builds do not
    // need production release bindings; runtime access remains environment-scoped.
    console.log("Preview build: production release preflight skipped. Runtime requires isolated nonproduction services.");
  } else {
    // Includes unknown/missing environments so they fail closed, never default to preview.
    validateReleaseConfig(process.env);
    console.log(process.env.RELEASE_BOOTSTRAP === "1"
      ? "Bootstrap configuration passed. Admin access is disabled: verify your Google identity, then remove RELEASE_BOOTSTRAP, configure ADMIN_USER_ID and redeploy. This is not final release acceptance."
      : "Release configuration passed offline checks. Console review and smoke acceptance remain required.");
  }
} catch (error) {
  console.error(releaseFailureMessage(error));
  process.exitCode = 1;
}
