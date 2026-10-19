import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import "../scripts/env";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";

// Actual upgrade from the previous committed schema, not just an empty install.
test("crest migration preserves existing clubs and legacy references on upgrade", async () => {
  const configured = localDatabaseUrl("testing");
  const control = createDatabase(configured);
  const name = `elche_away_upgrade_${randomUUID().replaceAll("-", "")}`;
  const target = new URL(configured); target.pathname = `/${name}`;
  const folder = await mkdtemp(join(tmpdir(), "elche-crest-upgrade-"));
  let created = false;
  try {
    await control.pool.query(`CREATE DATABASE "${name}"`); created = true;
    const database = createDatabase(target.toString());
    try {
      const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
      journal.entries = journal.entries.filter((entry) => entry.tag !== "0003_yielding_exodus");
      await mkdir(join(folder, "meta"));
      await writeFile(join(folder, "meta/_journal.json"), JSON.stringify(journal));
      for (const entry of journal.entries) await copyFile(`drizzle/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`));
      await migrate(database.db, { migrationsFolder: folder });
      const id = randomUUID();
      await database.pool.query("insert into clubs (id, name, slug, crest_path) values ($1, $2, $3, $4)", [id, "Legacy synthetic club", "legacy-synthetic-club", "/crests/legacy.webp"]);
      await migrate(database.db, { migrationsFolder: "drizzle" });
      const result = await database.pool.query("select id, name, slug, crest_path, crest_object_key from clubs where id=$1", [id]);
      assert.deepEqual(result.rows, [{ id, name: "Legacy synthetic club", slug: "legacy-synthetic-club", crest_path: "/crests/legacy.webp", crest_object_key: null }]);
      await assert.rejects(database.pool.query("update clubs set crest_object_key=$1 where id=$2", [`https://external.invalid/image.webp`, id]));
    } finally { await database.pool.end(); }
  } finally {
    if (created) await control.pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await control.pool.end(); await rm(folder, { recursive: true, force: true });
  }
});
