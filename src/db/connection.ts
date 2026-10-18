import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export function createDatabase(connectionString: string) {
  const url = new URL(connectionString);
  // Keep certificate and hostname verification explicit for Neon TLS connections.
  if (["prefer", "require", "verify-ca"].includes(url.searchParams.get("sslmode") ?? "")) url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  pool.on("error", () => console.error("PostgreSQL connection interrupted."));
  return { pool, db: drizzle(pool, { schema }) };
}

export type Database = ReturnType<typeof createDatabase>["db"];
export type QueryDatabase = Pick<Database, "select">;
export type WriteDatabase = Pick<Database, "insert" | "select">;
