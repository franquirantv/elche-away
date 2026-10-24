import { readFile } from "node:fs/promises";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PoolClient } from "pg";
import { array, object, string } from "./http";
import { assertMigrationPrefix, requireCondition } from "./policy";

export async function verifyHistory(client: PoolClient, migrationsFolder = "drizzle") {
  const migrations = readMigrationFiles({ migrationsFolder });
  const exists = await client.query<{ exists: string | null }>("select to_regclass('drizzle.__drizzle_migrations')::text as exists");
  const rows = exists.rows[0].exists
    ? (await client.query<{ hash: string; created_at: string }>("select hash, created_at from drizzle.__drizzle_migrations order by created_at")).rows : [];
  assertMigrationPrefix(rows, migrations);
  return { migrations, applied: rows.length };
}

export async function validateMigrationPolicy(client: PoolClient, successfulShas: Set<string>) {
  const { migrations, applied } = await verifyHistory(client);
  const journal = object(JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")));
  const policies = object(JSON.parse(await readFile("drizzle/release-policy.json", "utf8")));
  const entries = array(journal.entries).map(object);
  requireCondition(entries.length === migrations.length, "MIGRATION_JOURNAL");
  requireCondition(new Set(migrations.map((migration) => migration.folderMillis)).size === migrations.length
    && migrations.every((migration, index) => index === 0 || migration.folderMillis > migrations[index - 1].folderMillis), "MIGRATION_ORDER");
  for (let index = applied; index < migrations.length; index++) {
    const policy = object(policies[string(entries[index].tag)]);
    requireCondition(["expand", "contract"].includes(string(policy.phase)), "MIGRATION_PHASE");
    requireCondition(string(policy.compatibility).length >= 20, "MIGRATION_COMPATIBILITY");
    const sql = migrations[index].sql.join("\n");
    requireCondition(!/\b(?:TRUNCATE|DROP\s+(?:DATABASE|SCHEMA))\b/i.test(sql), "MIGRATION_RESET_FORBIDDEN");
    requireCondition(!/\bneon_auth\b/i.test(sql), "MANAGED_AUTH_FORBIDDEN");
    if (policy.phase === "contract") {
      requireCondition(successfulShas.has(string(policy.compatibleDeploymentSha))
        && string(policy.backfillVerification).length >= 20, "CONTRACT_EVIDENCE_REQUIRED");
    } else {
      // Conservative tripwire; semantic compatibility still requires SQL review in PR.
      requireCondition(!/\b(?:DROP|RENAME|DELETE\s+FROM|ALTER\s+COLUMN)\b/i.test(sql), "EXPAND_DESTRUCTIVE_SQL");
    }
  }
}

export async function migrateProduction(client: PoolClient, migrationsFolder = "drizzle") {
  await verifyHistory(client, migrationsFolder);
  // The same session owns the advisory lock and bounded transactional DDL.
  await client.query("set lock_timeout = '5s'");
  await client.query("set statement_timeout = '120s'");
  await migrate(drizzle(client), { migrationsFolder });
  const result = await verifyHistory(client, migrationsFolder);
  requireCondition(result.applied === result.migrations.length, "MIGRATION_INCOMPLETE");
}
