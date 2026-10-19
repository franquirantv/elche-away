import "./env";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { storageConfig } from "../src/server/storage-config";
import { createStorageClient, crestStore } from "../src/server/storage-client";
import { localDatabaseUrl } from "../src/db/environment";

async function main() {
  localDatabaseUrl("testing"); // Reject production/shared DB configuration first.
  for (const target of ["development", "testing"] as const) {
    const config = storageConfig({ ...process.env, STORAGE_ENVIRONMENT: target, DATABASE_URL: target === "testing" ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL });
    console.log(`${target}: configuration validated.`);
    const client = createStorageClient(config);
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }), { abortSignal: AbortSignal.timeout(10000) });
      console.log(`${target}: bucket exists.`);
    } finally { client.destroy(); }
    {
      const store = crestStore(config);
      const key = `crests/${randomUUID()}/${randomUUID()}.webp`;
      try {
        const body = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#155d43" } }).webp().toBuffer();
        await store.put(key, body);
        const response = await fetch(`${config.endpoint}/${config.bucket}/${key}`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(body)) { console.error(`${target}: anonymous read failed (HTTP ${response.status}).`); throw new Error("Anonymous read failed."); }
        console.log(`${target}: isolated synthetic image upload and anonymous read passed.`);
      } finally {
        try { await store.delete(key); console.log(`${target}: own synthetic object deleted.`); }
        catch { console.error(`Cleanup required ONLY for ${target} object: ${key}`); process.exitCode = 1; }
        store.close();
      }
    }
  }
}
main().catch((error: unknown) => {
  const failure = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  console.error(`Storage check failed (${failure.name || "Error"}, HTTP ${failure.$metadata?.httpStatusCode || "n/a"}). Check branch credentials, database binding and public_read bucket; secrets were not printed.`);
  process.exitCode = 1;
});
