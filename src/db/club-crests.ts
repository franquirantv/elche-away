import { and, eq, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "./connection";
import { clubs, storageCleanup } from "./schema";
import { isCrestKey } from "../lib/crest-key";

export class CrestConflict extends Error {
  constructor() { super("El club o su escudo han cambiado. Recarga antes de continuar."); }
}
export type CrestStore = { put(key: string, body: Uint8Array): Promise<void>; delete(key: string): Promise<void> };
export async function publishedCrest(db: Pick<Database, "select">, key: string) {
  if (!isCrestKey(key)) return false;
  return (await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.crestObjectKey, key)).limit(1)).length === 1;
}

// Ledger locks always precede club locks for new-key activation. Existing keys
// can never be assigned by a form, so cleanup cannot race with reactivation.
export async function cleanupCrest(db: Database, store: CrestStore, key: string) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(storageCleanup).where(and(eq(storageCleanup.objectKey, key), lte(storageCleanup.notBefore, new Date()))).for("update");
    if (!entry) return false;
    if (!await publishedCrest(tx, key)) await store.delete(key);
    await tx.delete(storageCleanup).where(eq(storageCleanup.objectKey, key));
    return true;
  });
}
export async function cleanupCrests(db: Database, store: CrestStore) {
  const entries = await db.select().from(storageCleanup).where(lte(storageCleanup.notBefore, new Date())).orderBy(storageCleanup.notBefore).limit(10);
  let cleaned = 0;
  for (const entry of entries) {
    try { if (await cleanupCrest(db, store, entry.objectKey)) cleaned++; } catch { /* Persistent intent remains for explicit retry. */ }
  }
  return { cleaned, remaining: (await db.select({ key: storageCleanup.objectKey }).from(storageCleanup).limit(1)).length > 0 };
}
export async function replaceCrest(db: Database, store: CrestStore, clubId: string, expected: string | null, body: Uint8Array) {
  const key = `crests/${clubId}/${randomUUID()}.webp`;
  // Check the club before reserving/uploading bytes; recheck under a lock below.
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId));
  if (!club || club.crestObjectKey !== expected) throw new CrestConflict();
  await db.insert(storageCleanup).values({ objectKey: key, notBefore: new Date(Date.now() + 3_600_000) });
  let previous: string | null = null;
  let uploaded = false;
  try {
    await store.put(key, body);
    uploaded = true;
    await db.transaction(async (tx) => {
      const [reservation] = await tx.select().from(storageCleanup).where(eq(storageCleanup.objectKey, key)).for("update");
      if (!reservation || reservation.notBefore <= new Date()) throw new CrestConflict();
      const [current] = await tx.select().from(clubs).where(eq(clubs.id, clubId)).for("update");
      if (!current || current.crestObjectKey !== expected) throw new CrestConflict();
      previous = current.crestObjectKey;
      if (previous) await tx.insert(storageCleanup).values({ objectKey: previous, notBefore: new Date() }).onConflictDoNothing();
      await tx.update(clubs).set({ crestObjectKey: key }).where(eq(clubs.id, clubId));
      await tx.delete(storageCleanup).where(eq(storageCleanup.objectKey, key));
    });
  } catch (error) {
    // Even an uncertain COMMIT outcome is safe: cleanup checks active references.
    try {
      // A failed PUT may still be finishing remotely: retain its one-hour reservation.
      if (!uploaded) throw error;
      await db.insert(storageCleanup).values({ objectKey: key, notBefore: new Date() }).onConflictDoUpdate({ target: storageCleanup.objectKey, set: { notBefore: new Date() } });
      await cleanupCrest(db, store, key);
    } catch { /* The original reservation remains recoverable after expiry. */ }
    throw error;
  }
  if (previous) { try { await cleanupCrest(db, store, previous); } catch { /* Explicit cleanup retries later. */ } }
  return key;
}
export async function removeCrest(db: Database, store: CrestStore, clubId: string, expected: string | null) {
  const key = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(clubs).where(eq(clubs.id, clubId)).for("update");
    if (!current || current.crestObjectKey !== expected) throw new CrestConflict();
    if (current.crestObjectKey) await tx.insert(storageCleanup).values({ objectKey: current.crestObjectKey, notBefore: new Date() }).onConflictDoNothing();
    await tx.update(clubs).set({ crestObjectKey: null }).where(eq(clubs.id, clubId));
    return current.crestObjectKey;
  });
  if (key) { try { await cleanupCrest(db, store, key); } catch { /* Do not undo a committed unlink on object-store failure. */ } }
}
