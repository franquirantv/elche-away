import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "../scripts/env";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { migrateProduction, validateMigrationPolicy, verifyHistory } from "../scripts/cd/migrations";

test("CD migrator creates only schema, preserves domain rows on retry and rejects altered migration history", async () => {
  const configured = localDatabaseUrl("testing");
  const control = createDatabase(configured);
  const name = `elche_away_cd_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(configured); url.pathname = `/${name}`;
  let created = false;
  const folder = await mkdtemp(join(tmpdir(), "elche-cd-failure-"));
  try {
    await control.pool.query(`CREATE DATABASE "${name}"`); created = true;
    const database = createDatabase(url.toString());
    try {
      const client = await database.pool.connect();
      try {
        await validateMigrationPolicy(client, new Set());
        await migrateProduction(client);
        assert.equal((await client.query("select count(*)::int as count from clubs")).rows[0].count, 0);
        const id = randomUUID();
        await client.query("insert into clubs(id, name, slug) values ($1, 'Synthetic CD club', 'synthetic-cd-club')", [id]);
        await validateMigrationPolicy(client, new Set());
        await migrateProduction(client);
        assert.equal((await client.query("select id from clubs")).rows[0].id, id);
        // Real transactional failure: an insert before failing DDL must not persist.
        await cp("drizzle", folder, { recursive: true });
        const journal = JSON.parse(await readFile(join(folder, "meta/_journal.json"), "utf8")) as {
          entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
        };
        journal.entries.push({ idx: journal.entries.length, version: "7", when: 9999999999999,
          tag: "9999_synthetic_failure", breakpoints: true });
        await writeFile(join(folder, "meta/_journal.json"), JSON.stringify(journal));
        await writeFile(join(folder, "9999_synthetic_failure.sql"),
          "insert into clubs(name, slug) values ('Must roll back', 'must-roll-back');\n--> statement-breakpoint\nselect * from cd_missing_table;");
        await assert.rejects(migrateProduction(client, folder));
        assert.equal((await client.query("select count(*)::int as count from clubs where slug = 'must-roll-back'")).rows[0].count, 0);
        const history = await verifyHistory(client);
        assert.equal(history.applied, history.migrations.length);
        await client.query("update drizzle.__drizzle_migrations set hash = 'synthetic-tampering' where id = 1");
        await assert.rejects(verifyHistory(client), /MIGRATION_HISTORY_CHANGED/);
      } finally { client.release(); }
    } finally { await database.pool.end(); }
  } finally {
    if (created) await control.pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await control.pool.end();
    await rm(folder, { recursive: true, force: true });
  }
});
