import "server-only";
import { createDatabase } from "./connection";
import { databaseUrl } from "./environment";

const globalDatabase = globalThis as typeof globalThis & { archiveDatabase?: ReturnType<typeof createDatabase> };

export function getDatabase() {
  globalDatabase.archiveDatabase ??= createDatabase(databaseUrl("DATABASE_URL"));
  return globalDatabase.archiveDatabase.db;
}
