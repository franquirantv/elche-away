export type StorageConfig = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
const databaseHost = (value: string) => new URL(value).hostname.replace("-pooler", "");

// Explicit DB/Storage binding prevents a preview/local server from using production storage.
export function storageConfig(env: Record<string, string | undefined> = process.env): StorageConfig {
  const target = env.STORAGE_ENVIRONMENT || "development";
  if (!["development", "testing", "production"].includes(target)) throw new Error("Configura el entorno de Storage.");
  if ((target === "production") !== (env.VERCEL_ENV === "production")) throw new Error("Storage de producción no está permitido en este entorno.");
  if (env.VERCEL_ENV === "preview" && target !== "testing") throw new Error("Preview requiere Storage de testing.");
  const prefix = target === "testing" ? "TEST_" : "";
  const endpoint = env[`${prefix}AWS_ENDPOINT_URL_S3`];
  const region = env[`${prefix}AWS_REGION`];
  const bucket = env[`${prefix}STORAGE_BUCKET`];
  const accessKeyId = env[`${prefix}AWS_ACCESS_KEY_ID`];
  const secretAccessKey = env[`${prefix}AWS_SECRET_ACCESS_KEY`];
  const binding = env[`${prefix}STORAGE_DATABASE_HOST`];
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey || !binding || !env.DATABASE_URL) throw new Error("Storage no está configurado para este entorno.");
  const url = new URL(endpoint);
  const neon = url.protocol === "https:" && url.hostname.includes(".storage.") && url.hostname.endsWith(".neon.tech");
  // A loopback S3 fixture can be used in local tests; never on Vercel/production.
  const local = target === "testing" && !env.VERCEL && env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "127.0.0.1";
  if ((!neon && !local) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || binding !== databaseHost(env.DATABASE_URL)) throw new Error("Storage no corresponde a la base de datos configurada.");
  if (target !== "production" && (env.AWS_ENDPOINT_URL_S3 === env.TEST_AWS_ENDPOINT_URL_S3 || env.AWS_ACCESS_KEY_ID === env.TEST_AWS_ACCESS_KEY_ID)) throw new Error("Development y testing requieren Storage aislado.");
  return { endpoint: url.origin, region, bucket, accessKeyId, secretAccessKey };
}
