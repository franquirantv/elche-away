export class CdError extends Error {}

export function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new CdError(code);
}

export interface RecoveryRecord {
  id: string;
  parentId: string;
  name: string;
  createdAt: string;
  state: string;
}

// Only explicit registry IDs, successful releases, correct parent and >=24h.
// Always preserve the newest two registered points, regardless of their state.
export function recoveryDeletions(records: RecoveryRecord[], parentId: string, now: number) {
  const sorted = [...records].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return sorted.slice(2).filter((record) => record.parentId === parentId
    && /^recovery\/\d+-[a-f0-9]{40}$/.test(record.name)
    && record.state === "success" && Number.isFinite(Date.parse(record.createdAt))
    && now - Date.parse(record.createdAt) >= 24 * 3600_000);
}

export function directProductionUrl(value: string, host: string, database: string) {
  const url = new URL(value);
  requireCondition(url.protocol === "postgresql:" || url.protocol === "postgres:", "DATABASE_PROTOCOL");
  requireCondition(host.endsWith(".neon.tech") && !host.includes("-pooler") && url.hostname === host, "DATABASE_HOST");
  requireCondition(url.username && url.password && decodeURIComponent(url.pathname.slice(1)) === database, "DATABASE_IDENTITY");
  requireCondition(url.searchParams.get("sslmode") === "verify-full" && !url.searchParams.has("ssl"), "DATABASE_TLS");
  requireCondition(!url.port || url.port === "5432", "DATABASE_PORT");
  requireCondition([...url.searchParams.keys()].every((key) => ["sslmode", "channel_binding"].includes(key)), "DATABASE_PARAMETERS");
  return url;
}

export function assertMigrationPrefix(applied: { hash: string; created_at: string | number }[],
  migrations: { hash: string; folderMillis: number }[]) {
  requireCondition(applied.length <= migrations.length, "MIGRATION_HISTORY_AHEAD");
  applied.forEach((row, index) => requireCondition(row.hash === migrations[index].hash
    && Number(row.created_at) === migrations[index].folderMillis, "MIGRATION_HISTORY_CHANGED"));
}

export interface ReleaseSteps {
  preflight(): Promise<boolean>;
  recovery(): Promise<void>;
  migrate(): Promise<void>;
  deploy(): Promise<void>;
  smoke(): Promise<void>;
  success(): Promise<void>;
}

// Failure is deliberately not caught: no later step, SQL compensation or retry.
export async function releaseInOrder(steps: ReleaseSteps) {
  if (!await steps.preflight()) return;
  await steps.recovery();
  await steps.migrate();
  await steps.deploy();
  await steps.smoke();
  await steps.success();
}
