import "./env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";

let stage = "configuration";
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}
function clientEnv(value: string, readOnly: boolean): NodeJS.ProcessEnv {
  const url = new URL(value);
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.has("sslmode") ? "verify-full" : "prefer", PGSSLROOTCERT: "system",
    PGOPTIONS: readOnly ? "-c default_transaction_read_only=on" : "", PGCONNECT_TIMEOUT: "10" };
}
async function command(name: "pg_dump" | "pg_restore", args: string[], env?: NodeJS.ProcessEnv) {
  const executable = process.env.PG_BIN_DIR ? join(process.env.PG_BIN_DIR, name) : name;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { env, stdio: "ignore" });
    child.on("error", () => reject(new Error(`${name} unavailable`)));
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${name} failed`)));
  });
}

async function productionUrl(testing: string) {
  const project = required("NEON_PROJECT_ID");
  const query = new URLSearchParams({ branch_id: required("NEON_PRODUCTION_BRANCH_ID"), database_name: required("PRODUCTION_DATABASE_NAME"), role_name: process.env.PRODUCTION_DATABASE_ROLE ?? decodeURIComponent(new URL(testing).username), pooled: "false" });
  const response = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(project)}/connection_uri?${query}`, {
    headers: { Authorization: `Bearer ${required("NEON_API_KEY")}` }, redirect: "error", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) { console.error(`Neon API: HTTP ${response.status}.`); throw new Error("Neon API rejected request"); }
  const body: unknown = await response.json();
  assert.ok(body && typeof body === "object" && "uri" in body && typeof body.uri === "string");
  const url = new URL(body.uri);
  assert.equal(url.hostname, required("PRODUCTION_DATABASE_HOST"));
  assert.equal(decodeURIComponent(url.pathname.slice(1)), required("PRODUCTION_DATABASE_NAME"));
  return url.toString();
}

async function main() {
  const testing = localDatabaseUrl("testing");
  const productionHost = required("PRODUCTION_DATABASE_HOST");
  for (const value of [testing, localDatabaseUrl("development")]) assert.notEqual(new URL(value).hostname.replace("-pooler", ""), productionHost);
  stage = "PostgreSQL clients";
  await command("pg_dump", ["--version"]);
  await command("pg_restore", ["--version"]);
  stage = "Neon connection URI";
  const sourceUrl = await productionUrl(testing);
  const source = createDatabase(sourceUrl);
  const control = createDatabase(testing);
  const name = `elche_away_prod_copy_${randomUUID().replaceAll("-", "")}`;
  const folder = await mkdtemp(join(tmpdir(), "elche-away-copy-"));
  const destination = new URL(testing); destination.pathname = `/${name}`;
  stage = "production read-only connection";
  const sourceClient = await source.pool.connect();
  let activated = false;
  try {
    // One consistent, read-only production snapshot for both the dump and counts.
    stage = "production read-only snapshot";
    await sourceClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = await sourceClient.query<{ snapshot: string }>("select pg_export_snapshot() as snapshot");
    const tables = await sourceClient.query<{ schemaname: string; tablename: string }>("select schemaname, tablename from pg_tables where schemaname in ('public', 'drizzle') order by 1, 2");
    const counts = new Map<string, string>();
    for (const table of tables.rows) {
      const path = `${quote(table.schemaname)}.${quote(table.tablename)}`;
      const result = await sourceClient.query<{ count: string }>(`select count(*) from ${path}`);
      counts.set(path, table.tablename === "storage_cleanup" && table.schemaname === "public" ? "0" : result.rows[0].count);
    }
    const dump = join(folder, "archive.dump");
    stage = "read-only export";
    await command("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--schema=public", "--schema=drizzle", "--exclude-table-data=public.storage_cleanup", `--snapshot=${snapshot.rows[0].snapshot}`, `--file=${dump}`], clientEnv(sourceUrl, true));
    await sourceClient.query("ROLLBACK");
    // Never restore into any configured database or reset an existing target.
    stage = "create testing copy";
    await control.pool.query(`CREATE DATABASE ${quote(name)}`);
    console.log(`Created testing copy: ${name}`);
    stage = "restore testing copy";
    await command("pg_restore", ["--exit-on-error", "--single-transaction", "--clean", "--if-exists", "--no-owner", "--no-acl", `--dbname=${name}`, dump], clientEnv(destination.toString(), false));
    stage = "verify testing copy";
    const restored = createDatabase(destination.toString());
    try {
      for (const [table, expected] of counts) {
        const actual = await restored.pool.query<{ count: string }>(`select count(*) from ${table}`);
        assert.equal(actual.rows[0].count, expected);
      }
    } finally { await restored.pool.end(); }
    stage = "activate local testing copy";
    const envFile = ".env.local";
    const before = await readFile(envFile, "utf8");
    assert.equal((before.match(/^TEST_DATABASE_URL=/gm) ?? []).length, 1);
    // Keep the previous local configuration; the database itself is untouched.
    const backup = `.env.local.before-production-copy-${name}`;
    const pending = `.env.local.copy-${randomUUID()}`;
    await writeFile(backup, before, { mode: 0o600, flag: "wx" });
    const after = before.replace(/^TEST_DATABASE_URL=.*$/m, () => `TEST_DATABASE_URL=${JSON.stringify(destination.toString())}`);
    await writeFile(pending, after, { mode: 0o600, flag: "wx" });
    await rename(pending, envFile);
    console.log(`Previous local configuration saved in ${backup}.`);
    activated = true;
    console.log(`Verified ${counts.size} tables. TEST_DATABASE_URL now points to the copy. Previous database preserved.`);
    console.log("Auth, object bytes and pending storage deletion jobs are excluded. Production was read-only.");
  } finally {
    await sourceClient.query("ROLLBACK").catch(() => undefined);
    sourceClient.release();
    await Promise.all([source.pool.end(), control.pool.end()]);
    await rm(folder, { recursive: true, force: true });
    if (!activated) console.error(`Copy not activated. If created, the only destination was ${name}; it has not been deleted automatically.`);
  }
}
main().catch(() => { console.error(`Production copy failed at: ${stage}. Raw errors suppressed.`); process.exitCode = 1; });
