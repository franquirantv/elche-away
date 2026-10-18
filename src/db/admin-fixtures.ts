import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "./connection";
import { attendance, clubs, matches, matchSources } from "./schema";
import { fixtureFacts } from "../server/fixture-input";
import { InvalidReference, validId, type ReferenceValues } from "../server/reference-input";
import { availableSlug } from "../lib/slugs";

type FixtureDatabase = Pick<Database, "select" | "insert" | "update" | "delete">;
export async function readAdminFixtures(db: FixtureDatabase, filters: { seasonId?: string; competitionId?: string } = {}) {
  for (const id of [filters.seasonId, filters.competitionId]) if (id) validId(id);
  return db.select({ fixture: matches, personal: attendance }).from(matches)
    .leftJoin(attendance, eq(attendance.matchId, matches.id))
    .where(and(filters.seasonId ? eq(matches.seasonId, filters.seasonId) : undefined, filters.competitionId ? eq(matches.competitionId, filters.competitionId) : undefined))
    .orderBy(sql`${matches.playedOn} desc nulls last`, matches.id);
}

// Only the authorized server boundary calls these helpers in the application.
// The caller supplies a transaction so attendance and fixture deletion serialize.
export async function writeFixture(db: FixtureDatabase, v: ReferenceValues) {
  const id = v.id ? validId(v.id) : undefined;
  const intents = ["save", "delete", "attend", "unattend"];
  if (!intents.includes(v.intent)) throw new InvalidReference({ intent: "Acción no válida." });
  let existing: typeof matches.$inferSelect | undefined;
  if (id) {
    [existing] = await db.select().from(matches).where(eq(matches.id, id)).for("update");
    if (!existing) throw new InvalidReference({ id: "El partido ya no existe." });
  } else if (v.intent !== "save") throw new InvalidReference({ id: "Selecciona un partido existente." });
  if (v.intent === "delete" || v.intent === "unattend") {
    if (v.confirmDelete !== "yes") throw new InvalidReference({ confirmDelete: "Confirma la eliminación." });
    if (v.intent === "delete") {
      if ((await db.select().from(attendance).where(eq(attendance.matchId, id!))).length) throw new InvalidReference({ id: "Desmarca primero la asistencia; no se puede eliminar un partido con asistencia." });
      if ((await db.select({ id: matchSources.id }).from(matchSources).where(eq(matchSources.matchId, id!))).length) throw new InvalidReference({ id: "Este partido tiene procedencia importada y no se puede eliminar. Conserva sus vínculos históricos." });
      await db.delete(matches).where(eq(matches.id, id!));
    } else await db.delete(attendance).where(eq(attendance.matchId, id!));
    return;
  }
  if (v.intent === "attend") {
    if (v.notes.length > 10000) throw new InvalidReference({ notes: "Máximo 10000 caracteres." });
    if (v.isSpecial && v.isSpecial !== "yes") throw new InvalidReference({ isSpecial: "Valor no válido." });
    const personal = { notes: v.notes || null, isSpecial: v.isSpecial === "yes" };
    const [prior] = await db.select().from(attendance).where(eq(attendance.matchId, id!));
    if (prior) { await db.update(attendance).set(personal).where(eq(attendance.matchId, id!)); return; }
    const names = await db.select({ name: clubs.name }).from(clubs).where(sql`${clubs.id} in (${existing!.homeClubId}, ${existing!.awayClubId})`).orderBy(desc(clubs.name));
    const label = [existing!.playedOn, ...names.map((club) => club.name), "viaje"].filter(Boolean).join(" ");
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await availableSlug(label, async (candidate) => (await db.select().from(attendance).where(eq(attendance.slug, candidate))).length > 0);
      const inserted = await db.insert(attendance).values({ matchId: id!, slug, ...personal }).onConflictDoNothing({ target: attendance.slug }).returning();
      if (inserted.length) return;
    }
    throw new InvalidReference({ id: "No se pudo reservar el enlace. Reinténtalo." });
  }
  const facts = fixtureFacts(v);
  // Incomplete dates/opponents cannot establish uniqueness. Warn and allow an
  // explicit owner override, including completely unknown fixture candidates.
  const same = <T>(column: Parameters<typeof isNull>[0], value: T | null | undefined) => value == null ? isNull(column) : eq(column, value);
  const candidates = await db.select({ id: matches.id }).from(matches).where(and(
    id ? ne(matches.id, id) : undefined,
    same(matches.playedOn, facts.playedOn), same(matches.homeClubId, facts.homeClubId), same(matches.awayClubId, facts.awayClubId),
    same(matches.seasonId, facts.seasonId), same(matches.competitionId, facts.competitionId),
  ));
  if (candidates.length && v.confirmDuplicate !== "yes") throw new InvalidReference({ confirmDuplicate: "Hay partidos con la misma fecha, clubes, temporada y competición (incluidos datos desconocidos). Revisa la lista y confirma si es otro partido." });
  if (id) await db.update(matches).set(facts).where(eq(matches.id, id));
  else await db.insert(matches).values(facts);
}
