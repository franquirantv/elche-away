import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { storageConfig } from "../src/server/storage-config";

function preflight(env: Record<string, string | undefined>) {
  // No inherited credentials, .env.local or network access; run the real entrypoint.
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/release-check.ts"], {
    env: { NODE_ENV: "production", ...env }, encoding: "utf8", timeout: 10_000,
  });
}

test("Vercel Preview build needs no database, Auth, Storage or production release bindings", () => {
  for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "preview", DATABASE_URL: "synthetic-invalid-url" }]) {
    const result = preflight(env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /production release preflight skipped/);
  }
  // Skipping build-time preflight does not permit production Storage at runtime.
  assert.throws(() => storageConfig({ VERCEL_ENV: "preview", STORAGE_ENVIRONMENT: "production" }));
});

test("Production still fails preflight without its database configuration", () => {
  const result = preflight({ VERCEL_ENV: "production" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[DATABASE\]/);
  assert.doesNotMatch(result.stdout, /skipped/);
});

test("missing or unknown Vercel environment never bypasses release checks", () => {
  for (const env of [{}, { VERCEL_ENV: "development" }, { VERCEL_ENV: "prod" }]) {
    const result = preflight(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[ENVIRONMENT\]/);
  }
});
