import assert from "node:assert/strict";
import { test } from "node:test";
import { assertMigrationPrefix, directProductionUrl, recoveryDeletions, releaseInOrder, type ReleaseSteps } from "../scripts/cd/policy";
import { assertFreeUsage, assertRecoveryCapacity } from "../scripts/cd/budget";

test("CD never migrates after failed recovery or deploys after failed migration", async () => {
  const stages = ["preflight", "recovery", "migrate", "deploy", "smoke", "success"] as const;
  for (const failure of stages) {
    const calls: string[] = [];
    const step = async (name: string) => { calls.push(name); if (name === failure) throw new Error("synthetic failure"); };
    const steps: ReleaseSteps = {
      preflight: async () => { await step("preflight"); return true; },
      recovery: () => step("recovery"), migrate: () => step("migrate"), deploy: () => step("deploy"),
      smoke: () => step("smoke"), success: () => step("success"),
    };
    await assert.rejects(releaseInOrder(steps));
    assert.deepEqual(calls, stages.slice(0, stages.indexOf(failure) + 1));
  }
});

test("obsolete or already published SHAs do not create a recovery or touch production", async () => {
  const unexpected = async () => { assert.fail("must not execute"); };
  await releaseInOrder({ preflight: async () => false, recovery: unexpected, migrate: unexpected,
    deploy: unexpected, smoke: unexpected, success: unexpected });
});

test("recovery cleanup protects newest two, failures, foreign parents, unknown names and young points", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const record = (id: string, hours: number, state = "success", parentId = "br-production") => ({
    id, parentId, state, name: `recovery/${id}-${"a".repeat(40)}`, createdAt: new Date(now - hours * 3600_000).toISOString(),
  });
  const records = [record("1", 1), record("2", 2), record("3", 3), record("4", 25),
    record("5", 26, "failure"), record("6", 27, "in_progress"), record("7", 28, "success", "br-development"),
    { ...record("8", 29), name: "recovery/not-owned" }];
  assert.deepEqual(recoveryDeletions(records, "br-production", now).map((item) => item.id), ["4"]);
  assert.deepEqual(recoveryDeletions([record("1", 48), record("2", 49)], "br-production", now), []);
});

test("production migrator rejects pooled, wrong target, insecure TLS and connection overrides", () => {
  const host = "ep-production.eu-central-1.aws.neon.tech";
  const url = `postgresql://synthetic:synthetic@${host}/archive?sslmode=verify-full`;
  assert.equal(directProductionUrl(url, host, "archive").hostname, host);
  for (const value of [url.replace("ep-production", "ep-other"), url.replace(host, host.replace(".eu-", "-pooler.eu-")),
    url.replace("verify-full", "require"), url.replace("archive", "other"), `${url}&ssl=false`, `${url}&options=unsafe`]) {
    assert.throws(() => directProductionUrl(value, host, "archive"));
  }
});

test("migration history rejects changed SQL, missing entries and newer schema before running DDL", () => {
  const migrations = [{ hash: "first", folderMillis: 1 }, { hash: "second", folderMillis: 2 }];
  assert.doesNotThrow(() => assertMigrationPrefix([{ hash: "first", created_at: "1" }], migrations));
  assert.throws(() => assertMigrationPrefix([{ hash: "changed", created_at: "1" }], migrations));
  assert.throws(() => assertMigrationPrefix([{ hash: "second", created_at: "2" }], migrations));
  assert.throws(() => assertMigrationPrefix([{ hash: "first", created_at: "1" }], []));
});

test("CD blocks paid plans, exhausted or unknown usage, branch pressure and insufficient storage headroom", () => {
  const project = { owner: { subscription_type: "free_v3", branches_limit: 10 }, compute_time_seconds: 100, data_transfer_bytes: 100 };
  const branch = { id: "br-production", logical_size: 1000 };
  assert.doesNotThrow(() => assertFreeUsage(project));
  assert.doesNotThrow(() => assertRecoveryCapacity(project, [branch], branch.id));
  for (const change of [{ owner: { subscription_type: "launch" } }, { compute_time_seconds: 90 * 3600 },
    { data_transfer_bytes: 4_000_000_000 }, { compute_time_seconds: undefined }]) {
    assert.throws(() => assertFreeUsage({ ...project, ...change }));
  }
  assert.throws(() => assertRecoveryCapacity(project, Array.from({ length: 9 }, () => branch), branch.id));
  assert.throws(() => assertRecoveryCapacity(project, [{ ...branch, logical_size: 300_000_000 }], branch.id));
  assert.throws(() => assertRecoveryCapacity(project, [{ id: branch.id }], branch.id));
});
