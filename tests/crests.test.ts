import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import sharp from "sharp";
import "../scripts/env";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { clubs, storageCleanup } from "../src/db/schema";
import { cleanupCrest, cleanupCrests, CrestConflict, removeCrest, replaceCrest } from "../src/db/club-crests";
import { writeReference } from "../src/db/references";
import { normalizeCrest, readCrestForm } from "../src/server/crest-input";
import { storageConfig } from "../src/server/storage-config";

const { db, pool } = createDatabase(localDatabaseUrl("testing"));
after(() => pool.end());

test("crest conversion strips metadata, bounds dimensions, and rejects disguised/oversized content", async () => {
  const bytes = await sharp({ create: { width: 1024, height: 256, channels: 4, background: "#155d4380" } }).png().withExif({ IFD0: { Artist: "Synthetic" } }).toBuffer();
  const result = await normalizeCrest(new File([new Uint8Array(bytes)], "synthetic.png", { type: "image/png" }));
  const info = await sharp(result).metadata();
  assert.equal(info.format, "webp"); assert.equal(info.width, 512); assert.equal(info.height, 128); assert.equal(info.exif, undefined); assert.equal(info.icc, undefined); assert.equal(info.xmp, undefined); assert.equal(info.hasAlpha, true);
  for (const [content, type] of [[Buffer.from("<svg/>"), "image/png"], [bytes, "image/jpeg"], [Buffer.alloc(1_000_001), "image/png"], [Buffer.from("<svg/>"), "image/svg+xml"]] as const) {
    await assert.rejects(() => normalizeCrest(new File([new Uint8Array(content)], "invalid", { type })));
  }
  await assert.rejects(() => readCrestForm(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x" }, body: new Uint8Array(1_070_000) })));
});

test("storage configuration rejects environment mixups, unbound databases and production access locally", () => {
  const env = { DATABASE_URL: "postgresql://example:example@ep-dev.eu-central-1.aws.neon.tech/db", AWS_ENDPOINT_URL_S3: "https://br-dev.storage.c-2.eu-central-1.aws.neon.tech", AWS_REGION: "eu-central-1", STORAGE_BUCKET: "public-assets", AWS_ACCESS_KEY_ID: "dev-id", AWS_SECRET_ACCESS_KEY: "dev-secret", STORAGE_DATABASE_HOST: "ep-dev.eu-central-1.aws.neon.tech", TEST_AWS_ENDPOINT_URL_S3: "https://br-test.storage.c-2.eu-central-1.aws.neon.tech", TEST_AWS_ACCESS_KEY_ID: "test-id" };
  assert.equal(storageConfig(env).bucket, "public-assets");
  for (const changes of [{ STORAGE_DATABASE_HOST: "ep-other" }, { STORAGE_ENVIRONMENT: "production" }, { VERCEL_ENV: "production" }, { VERCEL_ENV: "preview" }, { AWS_ENDPOINT_URL_S3: env.TEST_AWS_ENDPOINT_URL_S3 }, { AWS_ACCESS_KEY_ID: "test-id" }, { AWS_ENDPOINT_URL_S3: "https://external.invalid" }]) assert.throws(() => storageConfig({ ...env, ...changes }));
});

test("crest lifecycle preserves active images across conflicts, storage failures and interrupted uploads", async () => {
  const id = randomUUID(); const objects = new Map<string, Uint8Array>();
  let failPut = false, failDelete = false;
  const store = { async put(key: string, bytes: Uint8Array) { objects.set(key, bytes); if (failPut) throw new Error("Synthetic lost upload response"); }, async delete(key: string) { if (failDelete) throw new Error("Synthetic delete failure"); objects.delete(key); } };
  await db.insert(clubs).values({ id, name: "Club Storage sintético", slug: `storage-${id}` });
  try {
    const first = await replaceCrest(db, store, id, null, new Uint8Array([1]));
    await assert.rejects(() => replaceCrest(db, store, id, null, new Uint8Array([2])), CrestConflict);
    assert.equal(objects.has(first), true);
    failPut = true; failDelete = true;
    await assert.rejects(() => replaceCrest(db, store, id, first, new Uint8Array([3])));
    assert.equal((await db.select().from(clubs).where(eq(clubs.id, id)))[0].crestObjectKey, first);
    assert.ok((await db.select().from(storageCleanup)).length);
    failPut = false; failDelete = false;
    // A failed PUT keeps a delay so a late remote write cannot race immediate deletion.
    await db.update(storageCleanup).set({ notBefore: new Date(0) }).where(like(storageCleanup.objectKey, `crests/${id}/%`));
    await cleanupCrests(db, store);
    assert.deepEqual([...objects.keys()], [first]);
    // Even an uncertain COMMIT cleanup intent must never delete the active image.
    await db.insert(storageCleanup).values({ objectKey: first, notBefore: new Date(0) });
    await cleanupCrest(db, store, first); assert.equal(objects.has(first), true);
    // Competing uploads from one form version: only one may become current.
    const results = await Promise.allSettled([replaceCrest(db, store, id, first, new Uint8Array([4])), replaceCrest(db, store, id, first, new Uint8Array([5]))]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const active = (await db.select().from(clubs).where(eq(clubs.id, id)))[0].crestObjectKey!;
    assert.deepEqual([...objects.keys()], [active]);
    failDelete = true;
    await removeCrest(db, store, id, active);
    assert.equal((await db.select().from(clubs).where(eq(clubs.id, id)))[0].crestObjectKey, null);
    assert.equal(objects.has(active), true);
    failDelete = false; await cleanupCrests(db, store); assert.equal(objects.size, 0);
    // Expired reservations recover a process crash between PUT and activation.
    const stranded = `crests/${id}/${randomUUID()}.webp`;
    objects.set(stranded, new Uint8Array([6]));
    await db.insert(storageCleanup).values({ objectKey: stranded, notBefore: new Date(0) });
    await cleanupCrests(db, store); assert.equal(objects.size, 0);
    await replaceCrest(db, store, id, null, new Uint8Array([7]));
    await db.transaction((tx) => writeReference(tx, "clubs", { id, intent: "delete", confirmDelete: "yes" }));
    await cleanupCrests(db, store); assert.equal(objects.size, 0);
  } finally {
    await db.delete(storageCleanup).where(like(storageCleanup.objectKey, `crests/${id}/%`));
    await db.delete(clubs).where(eq(clubs.id, id));
  }
});
