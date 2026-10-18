type DatabaseKey = "DATABASE_URL" | "DATABASE_URL_UNPOOLED" | "TEST_DATABASE_URL";

export function databaseUrl(key: DatabaseKey): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}. See README.md.`);
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) throw new Error();
    if (key !== "DATABASE_URL" && url.hostname.includes("-pooler")) throw new Error();
  } catch { throw new Error(`Invalid ${key}; direct connections are required for migrations/testing.`); }
  return value;
}

function identity(value: string) {
  const url = new URL(value);
  return `${url.hostname.replace("-pooler", "")}:${url.port || "5432"}${url.pathname}`;
}

// Local scripts never accept a production mode or an implicit testing target.
export function localDatabaseUrl(target: "development" | "testing") {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Local database scripts cannot run in production/Vercel.");
  const development = databaseUrl("DATABASE_URL");
  const direct = databaseUrl("DATABASE_URL_UNPOOLED");
  const testing = databaseUrl("TEST_DATABASE_URL");
  if (identity(development) !== identity(direct)) throw new Error("Development connections must identify the same database.");
  if (identity(development) === identity(testing)) throw new Error("Testing must use a separate database from development.");
  return target === "testing" ? testing : direct;
}
