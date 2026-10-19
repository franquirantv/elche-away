import "./env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { seedSyntheticData } from "../src/db/fixtures";

async function command(executable: string, args: string[], env = process.env) {
  await new Promise<void>((resolve, reject) => {
    // PostgreSQL tools may include connection details in errors: suppress output.
    const child = spawn(executable, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let diagnostic = "";
    child.stderr.on("data", (chunk) => { diagnostic = (diagnostic + chunk).slice(-8000); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) return resolve();
      const category = /certificate|root.crt|SSL/i.test(diagnostic) ? "TLS verification"
        : /version mismatch|unrecognized configuration parameter/i.test(diagnostic) ? "client/server version mismatch"
        : /already exists/i.test(diagnostic) ? "preexisting schema object"
        : /permission denied|must be owner/i.test(diagnostic) ? "database role permissions" : "export/restore";
      console.error(`${executable} failed (${category}); raw diagnostics suppressed.`);
      reject(new Error("PostgreSQL tool failed."));
    });
  });
}

async function snapshot(url: string) {
  const database = createDatabase(url);
  try {
    const tables = await database.pool.query<{ schemaname: string; tablename: string }>("select schemaname, tablename from pg_tables where schemaname in ('public', 'drizzle') order by 1, 2");
    const result: Record<string, unknown> = {};
    for (const { schemaname, tablename } of tables.rows) {
      const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
      const rows = await database.pool.query(`select to_jsonb(t)::text as row from ${quote(schemaname)}.${quote(tablename)} t order by 1`);
      result[`${schemaname}.${tablename}`] = rows.rows;
    }
    return result;
  } finally { await database.pool.end(); }
}

async function main() {
  const configured = localDatabaseUrl("testing");
  // Fail before creating databases if the external clients are unavailable.
  await command("pg_dump", ["--version"]);
  await command("pg_restore", ["--version"]);
  const control = createDatabase(configured);
  const folder = await mkdtemp(join(tmpdir(), "elche-away-backup-"));
  const created: string[] = [];
  try {
    const urls: string[] = [];
    for (const purpose of ["source", "restore"]) {
      const name = `elche_away_${purpose}_${randomUUID().replaceAll("-", "")}`;
      await control.pool.query(`CREATE DATABASE "${name}"`);
      created.push(name);
      console.log(`Created rehearsal database: ${name}`);
      const url = new URL(configured); url.pathname = `/${name}`; urls.push(url.toString());
    }
    const source = createDatabase(urls[0]);
    try {
      await migrate(source.db, { migrationsFolder: "drizzle" });
      await source.db.transaction((tx) => seedSyntheticData(tx));
    } finally { await source.pool.end(); }
    const clientEnv = (value: string) => {
      const url = new URL(value);
      return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
        PGSSLMODE: url.searchParams.has("sslmode") ? "verify-full" : "prefer",
        PGSSLROOTCERT: url.searchParams.has("sslmode") ? "system" : undefined, PGCONNECT_TIMEOUT: "10" };
    };
    const file = join(folder, "synthetic.dump");
    await command("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--schema=public", "--schema=drizzle", `--file=${file}`], clientEnv(urls[0]));
    // --clean is restricted to the empty destination created by this execution.
    await command("pg_restore", ["--exit-on-error", "--clean", "--if-exists", "--no-owner", "--no-acl", `--dbname=${created[1]}`, file], clientEnv(urls[1]));
    assert.deepEqual(await snapshot(urls[1]), await snapshot(urls[0]));
    // The restored migration journal must allow a no-op migration.
    const restored = createDatabase(urls[1]);
    try { await migrate(restored.db, { migrationsFolder: "drizzle" }); } finally { await restored.pool.end(); }
    assert.deepEqual(await snapshot(urls[1]), await snapshot(urls[0]));
    console.log("Backup/restore rehearsal passed: domain rows and migration journal match. Managed Auth and object bytes are outside this rehearsal.");
  } finally {
    try {
      for (const name of created.reverse()) {
        await control.pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
        console.log(`Removed rehearsal database: ${name}`);
      }
    } finally { await control.pool.end(); await rm(folder, { recursive: true, force: true }); }
  }
}

main().catch(() => {
  console.error("Backup rehearsal failed. Requires compatible pg_dump/pg_restore and testing CREATEDB. No configured database was restored/reset. If interrupted, remove only rehearsal databases printed by this run.");
  process.exitCode = 1;
});
