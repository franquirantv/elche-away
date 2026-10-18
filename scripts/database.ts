import "./env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { seedSyntheticData } from "../src/db/fixtures";

async function main() {
  const [command, target] = process.argv.slice(2);
  if (!["migrate", "seed"].includes(command) || !["development", "testing"].includes(target)) {
    throw new Error("Use database.ts migrate|seed development|testing.");
  }
  const { db, pool } = createDatabase(localDatabaseUrl(target as "development" | "testing"));
  try {
    if (command === "migrate") await migrate(db, { migrationsFolder: "./drizzle" });
    else await db.transaction((tx) => seedSyntheticData(tx));
    console.log(`${command} completed on ${target}.`);
  } finally { await pool.end(); }
}

main().catch(() => {
  // Driver/ORM errors may include connection strings or SQL parameters.
  console.error("Database command failed. Check local environment, branch access and migration/seed prerequisites. No credentials were logged.");
  process.exitCode = 1;
});
