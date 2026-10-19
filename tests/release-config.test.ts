import assert from "node:assert/strict";
import { test } from "node:test";
import { releaseFailureMessage, validateReleaseConfig } from "../src/server/release-config";
import { AccessDenied, assertAdminIdentity } from "../src/server/admin-policy";

const preview = {
  VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: "postgresql://synthetic:synthetic@ep-test-pooler.neon.tech/archive?sslmode=verify-full",
  RELEASE_DATABASE_HOST: "ep-test.neon.tech", NEON_AUTH_BASE_URL: "https://test.neonauth.example/neondb/auth",
  RELEASE_AUTH_ORIGIN: "https://test.neonauth.example", ADMIN_USER_ID: "synthetic-owner",
  NEON_AUTH_COOKIE_SECRET: "synthetic-cookie-secret-for-tests-only", STORAGE_ENVIRONMENT: "testing",
  TEST_AWS_ENDPOINT_URL_S3: "https://test.storage.eu-central-1.neon.tech", TEST_AWS_REGION: "eu-central-1",
  TEST_STORAGE_BUCKET: "synthetic-bucket", TEST_AWS_ACCESS_KEY_ID: "synthetic-id", TEST_AWS_SECRET_ACCESS_KEY: "synthetic-secret",
  TEST_STORAGE_DATABASE_HOST: "ep-test.neon.tech",
};

test("release preflight rejects missing bindings, mismatched storage, test mode and exposed configuration", () => {
  assert.doesNotThrow(() => validateReleaseConfig(preview));
  for (const change of [
    { RELEASE_DATABASE_HOST: "ep-other.neon.tech" }, { RELEASE_AUTH_ORIGIN: "https://other.example" },
    { ADMIN_USER_ID: "" }, { NEON_AUTH_COOKIE_SECRET: "short" }, { STORAGE_ENVIRONMENT: "production" },
    { VERCEL_ENV: "development" }, { TEST_STORAGE_DATABASE_HOST: "other.neon.tech" },
    { ARCHIVE_TEST_SERVER: "1" }, { NEXT_PUBLIC_SECRET: "synthetic" }, { DATABASE_URL: preview.DATABASE_URL.replace("verify-full", "require") },
  ]) assert.throws(() => validateReleaseConfig({ ...preview, ...change }));
});

test("Vercel public framework metadata does not block releases; unrecognized public secrets still fail", () => {
  // Full set of names from the owner's failed Vercel build, synthetic values only.
  const names = [
    "GIT_COMMIT_REF", "GIT_PULL_REQUEST_ID", "GIT_PREVIOUS_SHA", "GIT_COMMIT_MESSAGE", "GIT_COMMIT_AUTHOR_NAME",
    "GIT_REPO_ID", "GIT_REPO_OWNER", "PROJECT_ID", "DEPLOYMENT_ID", "ENV", "GIT_COMMIT_AUTHOR_LOGIN",
    "BRANCH_URL", "GIT_COMMIT_SHA", "OBSERVABILITY_CLIENT_CONFIG", "URL", "GIT_REPO_SLUG", "GIT_PROVIDER",
    "PROJECT_PRODUCTION_URL", "TARGET_ENV",
  ];
  const metadata = Object.fromEntries(names.map((name) => [`NEXT_PUBLIC_VERCEL_${name}`, "synthetic-public-metadata"]));
  assert.doesNotThrow(() => validateReleaseConfig({ ...preview, ...metadata }));
  for (const key of ["NEXT_PUBLIC_DATABASE_URL", "NEXT_PUBLIC_VERCEL_SECRET", "NEXT_PUBLIC_VERCEL_AWS_SECRET_ACCESS_KEY"]) {
    assert.throws(() => validateReleaseConfig({ ...preview, ...metadata, [key]: "synthetic-secret" }));
  }
  assert.throws(() => validateReleaseConfig({ ...preview, ...metadata, VERCEL: undefined }));
});

test("preflight diagnostics identify failing blocks without reflecting credentials or raw parser errors", () => {
  const secret = "synthetic-sensitive-value-must-never-appear";
  for (const [change, code] of [
    [{ DATABASE_URL: secret }, "DATABASE"], [{ RELEASE_DATABASE_HOST: secret }, "DATABASE"],
    [{ NEON_AUTH_BASE_URL: secret }, "AUTH"], [{ RELEASE_AUTH_ORIGIN: secret }, "AUTH"],
    [{ ADMIN_USER_ID: "" }, "OWNER"], [{ NEON_AUTH_COOKIE_SECRET: "short" }, "COOKIE"],
    [{ RELEASE_BOOTSTRAP: secret }, "BOOTSTRAP"], [{ TEST_AWS_ENDPOINT_URL_S3: secret }, "STORAGE"],
    [{ NEXT_PUBLIC_SECRET: secret }, "PUBLIC_VARIABLES"],
  ] as const) {
    assert.throws(() => validateReleaseConfig({ ...preview, ...change }), (error: unknown) => {
      const message = releaseFailureMessage(error);
      assert.ok(message.includes(`[${code}]`));
      assert.ok(!message.includes(secret));
      return true;
    });
  }
  assert.ok(!releaseFailureMessage(new Error(secret)).includes(secret));
});

test("production requires its explicitly bound production storage", () => {
  const production = { ...preview, VERCEL_ENV: "production", STORAGE_ENVIRONMENT: "production",
    AWS_ENDPOINT_URL_S3: "https://production.storage.eu-central-1.neon.tech", AWS_REGION: "eu-central-1",
    STORAGE_BUCKET: "synthetic-production", AWS_ACCESS_KEY_ID: "synthetic-production-id", AWS_SECRET_ACCESS_KEY: "synthetic-production-secret",
    STORAGE_DATABASE_HOST: preview.RELEASE_DATABASE_HOST };
  assert.doesNotThrow(() => validateReleaseConfig(production));
  assert.throws(() => validateReleaseConfig({ ...production, STORAGE_ENVIRONMENT: "testing" }));
});

test("explicit first-access bootstrap permits no owner, grants nobody admin and retains release isolation checks", () => {
  const bootstrap = { ...preview, VERCEL_ENV: "production", STORAGE_ENVIRONMENT: "production", RELEASE_BOOTSTRAP: "1", ADMIN_USER_ID: "",
    AWS_ENDPOINT_URL_S3: "https://production.storage.eu-central-1.neon.tech", AWS_REGION: "eu-central-1",
    STORAGE_BUCKET: "synthetic-production", AWS_ACCESS_KEY_ID: "synthetic-production-id", AWS_SECRET_ACCESS_KEY: "synthetic-production-secret",
    STORAGE_DATABASE_HOST: preview.RELEASE_DATABASE_HOST };
  assert.doesNotThrow(() => validateReleaseConfig(bootstrap));
  assert.doesNotThrow(() => validateReleaseConfig({ ...bootstrap, ADMIN_USER_ID: undefined }));
  for (const user of [undefined, "first-google-user", "owner", "another-user"]) {
    assert.throws(() => assertAdminIdentity(user, bootstrap.ADMIN_USER_ID), AccessDenied);
  }
  for (const change of [
    { ADMIN_USER_ID: "owner" }, { ADMIN_USER_ID: " " }, { RELEASE_BOOTSTRAP: "true" },
    { RELEASE_BOOTSTRAP: "0" }, { RELEASE_BOOTSTRAP: undefined }, { VERCEL_ENV: "preview" },
    { STORAGE_DATABASE_HOST: "wrong.neon.tech" }, { NEON_AUTH_COOKIE_SECRET: "short" },
    { RELEASE_DATABASE_HOST: "wrong.neon.tech" }, { ARCHIVE_TEST_SERVER: "1" },
  ]) assert.throws(() => validateReleaseConfig({ ...bootstrap, ...change }));
  const completed = { ...bootstrap, RELEASE_BOOTSTRAP: undefined, ADMIN_USER_ID: "verified-owner" };
  assert.doesNotThrow(() => validateReleaseConfig(completed));
  assert.doesNotThrow(() => assertAdminIdentity("verified-owner", completed.ADMIN_USER_ID));
  assert.throws(() => assertAdminIdentity("first-google-user", completed.ADMIN_USER_ID), AccessDenied);
});
