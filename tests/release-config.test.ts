import assert from "node:assert/strict";
import { test } from "node:test";
import { validateReleaseConfig } from "../src/server/release-config";
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
