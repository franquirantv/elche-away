import "./env";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { seedSyntheticData } from "../src/db/fixtures";

async function main() {
  // Validate the configured nonproduction targets before creating anything.
  const configuredUrl = localDatabaseUrl("testing");
  const name = `elche_away_test_${randomUUID().replaceAll("-", "")}`;
  const temporaryUrl = new URL(configuredUrl);
  temporaryUrl.pathname = `/${name}`;
  const control = createDatabase(configuredUrl);
  let created = false;
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    // No IF NOT EXISTS: cleanup is allowed only after our own CREATE succeeds.
    await control.pool.query(`CREATE DATABASE "${name}"`);
    created = true;
    console.log(`Created isolated test database: ${name}`);
    const temporary = createDatabase(temporaryUrl.toString());
    try {
      await migrate(temporary.db, { migrationsFolder: "./drizzle" });
      await temporary.db.transaction((tx) => seedSyntheticData(tx));
    } finally { await temporary.pool.end(); }
    abort.signal.throwIfAborted();
    const files = (await readdir("tests")).filter((file) => file.endsWith(".test.ts")).sort();
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", ...files.map((file) => `tests/${file}`)], {
        env: { ...process.env, TEST_DATABASE_URL: temporaryUrl.toString() },
        stdio: "inherit",
      });
      const stop = () => child.kill("SIGTERM");
      abort.signal.addEventListener("abort", stop, { once: true });
      child.once("error", reject);
      child.once("close", (code) => {
        abort.signal.removeEventListener("abort", stop);
        resolve(code ?? 1);
      });
      if (abort.signal.aborted) stop();
    });
    process.exitCode = exitCode;
  } finally {
    try {
      // The generated identifier is never accepted from configuration or input.
      // FORCE closes leaked test-server connections after failed/interrupted runs.
      if (created) {
        await control.pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
        console.log(`Removed isolated test database: ${name}`);
      }
    } finally {
      await control.pool.end();
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    }
  }
}

main().catch(() => {
  // Do not print driver errors: they may contain credentials or query parameters.
  console.error("Isolated tests failed. Check testing access and CREATEDB permission; no configured database was reset. If cleanup failed, remove only the elche_away_test_* database created by this run.");
  process.exitCode = 1;
});
