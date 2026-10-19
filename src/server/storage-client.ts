import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { isCrestKey } from "../lib/crest-key";
import { storageConfig, type StorageConfig } from "./storage-config";

// Only server entry points/scripts import this client; credentials never leave it.
export function createStorageClient(config: StorageConfig = storageConfig()) {
  return new S3Client({ endpoint: config.endpoint, region: config.region, forcePathStyle: true, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, maxAttempts: 2 });
}
export function crestStore(config: StorageConfig = storageConfig()) {
  const client = createStorageClient(config);
  const assertKey = (key: string) => { if (!isCrestKey(key)) throw new Error("Clave de escudo no válida."); };
  return {
    async put(key: string, body: Uint8Array) {
      assertKey(key);
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }), { abortSignal: AbortSignal.timeout(15000) });
    },
    async delete(key: string) {
      assertKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
    },
    close() { client.destroy(); },
  };
}
