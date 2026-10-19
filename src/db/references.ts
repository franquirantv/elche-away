import { eq } from "drizzle-orm";
import type { Database } from "./connection";
import { clubs, competitions, seasons, stadiums, tiers, storageCleanup } from "./schema";
import { ELCHE_CLUB_ID } from "../lib/identity";
import { availableSlug } from "../lib/slugs";
import { InvalidReference, validId, validateReference, type ReferenceKind, type ReferenceValues } from "../server/reference-input";

type ReferenceDatabase = Pick<Database, "select" | "insert" | "update" | "delete">;

// Database helpers are not endpoints. Their only application caller is the
// server-only admin boundary, which verifies authorization on every operation.
export async function readReferences(db: ReferenceDatabase) {
  // Sequential reads also work inside a single PostgreSQL test transaction.
  const clubRows = await db.select().from(clubs).orderBy(clubs.name);
  const stadiumRows = await db.select().from(stadiums).orderBy(stadiums.name);
  const competitionRows = await db.select().from(competitions).orderBy(competitions.name);
  const tierRows = await db.select().from(tiers).orderBy(tiers.level, tiers.name);
  const seasonRows = await db.select().from(seasons).orderBy(seasons.startYear, seasons.label);
  return { clubs: clubRows, stadiums: stadiumRows, competitions: competitionRows, tiers: tierRows, seasons: seasonRows };
}

export async function writeReference(db: ReferenceDatabase, kind: ReferenceKind, v: ReferenceValues) {
  const id = v.id ? validId(v.id) : undefined;
  if (!["save", "delete"].includes(v.intent)) throw new InvalidReference({ intent: "Acción no válida." });
  if (v.intent === "delete") {
    if (!id || v.confirmDelete !== "yes") throw new InvalidReference({ confirmDelete: "Confirma el borrado." });
    if (kind === "clubs" && id === ELCHE_CLUB_ID) throw new InvalidReference({ id: "El club de referencia Elche CF no se puede borrar." });
    const table = { clubs, stadiums, competitions, tiers, seasons }[kind];
    if (kind === "clubs") {
      const [club] = await db.select().from(clubs).where(eq(clubs.id, id)).for("update");
      if (club?.crestObjectKey) await db.insert(storageCleanup).values({ objectKey: club.crestObjectKey, notBefore: new Date() }).onConflictDoNothing();
    }
    const removed = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id });
    if (!removed.length) throw new InvalidReference({ id: "La referencia ya no existe." });
    return;
  }
  validateReference(kind, v);
  if (kind === "clubs" || kind === "stadiums") {
    const table = kind === "clubs" ? clubs : stadiums;
    const changes = kind === "clubs"
      ? { name: v.name }
      : { name: v.name, city: v.city || null, provinceCode: v.provinceCode || null, latitude: v.latitude ? Number(v.latitude) : null, longitude: v.longitude ? Number(v.longitude) : null };
    if (id) {
      // Never regenerate a slug when names or location are corrected.
      const rows = await db.update(table).set(changes).where(eq(table.id, id)).returning({ id: table.id });
      if (!rows.length) throw new InvalidReference({ id: "La referencia ya no existe." });
    } else {
      // A conflicting concurrent insert rolls back this statement; retry with
      // the next slug. The DB unique constraint is the final authority.
      for (let attempt = 0; attempt < 5; attempt++) {
        const slug = await availableSlug(v.name, async (candidate) => (await db.select({ id: table.id }).from(table).where(eq(table.slug, candidate))).length > 0);
        const rows = await db.insert(table).values({ ...changes, slug }).onConflictDoNothing({ target: table.slug }).returning({ id: table.id });
        if (rows.length) return;
      }
      throw new InvalidReference({ name: "No se pudo reservar un enlace. Vuelve a intentarlo." });
    }
    return;
  }
  if (kind === "competitions") {
    if (id) {
      const rows = await db.update(competitions).set({ name: v.name }).where(eq(competitions.id, id)).returning();
      if (!rows.length) throw new InvalidReference({ id: "La referencia ya no existe." });
    } else await db.insert(competitions).values({ name: v.name });
  } else if (kind === "tiers") {
    if (id) {
      const rows = await db.update(tiers).set({ name: v.name, level: Number(v.level) }).where(eq(tiers.id, id)).returning();
      if (!rows.length) throw new InvalidReference({ id: "La referencia ya no existe." });
    } else await db.insert(tiers).values({ name: v.name, level: Number(v.level) });
  } else {
    const changes = { label: v.label, startYear: Number(v.startYear), elcheTierId: v.elcheTierId || null };
    if (id) {
      const rows = await db.update(seasons).set(changes).where(eq(seasons.id, id)).returning();
      if (!rows.length) throw new InvalidReference({ id: "La referencia ya no existe." });
    } else await db.insert(seasons).values(changes);
  }
}
