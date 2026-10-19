import { validateReleaseConfig } from "../src/server/release-config";

// Do not load .env.local: inspect only the selected deployment's environment.
try {
  validateReleaseConfig(process.env);
  console.log("Release configuration passed offline checks. Console review and smoke acceptance remain required.");
} catch {
  console.error("Release configuration failed. Review docs/RELEASE.md; no values or credentials were logged.");
  process.exitCode = 1;
}
