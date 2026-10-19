import { releaseFailureMessage, validateReleaseConfig } from "../src/server/release-config";

// Do not load .env.local: inspect only the selected deployment's environment.
try {
  validateReleaseConfig(process.env);
  console.log(process.env.RELEASE_BOOTSTRAP === "1"
    ? "Bootstrap configuration passed. Admin access is disabled: verify your Google identity, then remove RELEASE_BOOTSTRAP, configure ADMIN_USER_ID and redeploy. This is not final release acceptance."
    : "Release configuration passed offline checks. Console review and smoke acceptance remain required.");
} catch (error) {
  console.error(releaseFailureMessage(error));
  process.exitCode = 1;
}
