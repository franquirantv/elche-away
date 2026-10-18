import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "./connection";
import { clubs, competitions, matches, matchSources, seasons } from "./schema";
import { ELCHE_CLUB_ID } from "../lib/identity";
import { validId } from "../server/reference-input";
import { digest, ImportError, selectedRecords, type ImportInput, type SourceRecord } from "../server/import-input";
import { validateMatch } from "./validation";

type ImportDatabase = Pick<Database, "select" | "insert" | "update" | "execute">;
export const factKeys = ["homeClubId", "awayClubId", "playedOn", "homeScore", "awayScore", "seasonId", "competitionId", "phase", "status", "stadiumId", "factualNotes"] as const;
export type ImportFacts = Pick<typeof matches.$inferSelect, typeof factKeys[number]>;
export type ImportCategory = "new" | "unchanged" | "update" | "protected" | "conflict";
export type ImportRow = {
  fingerprint: string; sourceId: string; label: string; category: ImportCategory; target: string;
  candidateIds: string[]; issue?: string; incoming: ImportFacts; proposed: ImportFacts; existing: ImportFacts | null; changes: string[];
};
export type ImportPreview = {
  rows: ImportRow[]; candidates: { id: string; label: string }[]; snapshot: string;
  total: number; offset: number; seasonLabel: string; competitionLabel: string;
};
export function sourceIdentity(input: ImportInput, record: SourceRecord) {
  return digest({ repository: input.repository, path: input.path, record });
}
function factsOf(row: ImportFacts): ImportFacts { return Object.fromEntries(factKeys.map((key) => [key, row[key]])) as ImportFacts; }
function mergedFacts(existing: ImportFacts, incoming: ImportFacts): ImportFacts {
  const merged = factsOf(existing);
  for (const key of factKeys) {
    if (incoming[key] !== null && !(key === "status" && incoming[key] === "unknown")) Object.assign(merged, { [key]: incoming[key] });
  }
  validateMatch(merged);
  return merged;
}
export async function previewFixtureImport(db: ImportDatabase, input: ImportInput): Promise<ImportPreview> {
  const batch = selectedRecords(input);
  const seasonId = validId(input.seasonId), competitionId = validId(input.competitionId);
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  const [competition] = await db.select().from(competitions).where(eq(competitions.id, competitionId));
  if (!season || !competition) throw new ImportError("Selecciona una temporada y competición existentes.");
  const clubRows = await db.select().from(clubs);
  const clubMap = new Map(clubRows.map((club) => [club.id, club.name]));
  const localClub = (name: string) => {
    const id = input.mappings[name];
    if (!id || !clubMap.has(validId(id))) throw new ImportError(`Asigna un club local a «${name}».`);
    if ((name === input.elcheName) !== (id === ELCHE_CLUB_ID)) throw new ImportError("Asigna Elche únicamente al nombre exacto elegido para Elche en el archivo.");
    return id;
  };
  const sourceIds = batch.records.map((r) => sourceIdentity(input, r));
  const sources = await db.select().from(matchSources).where(and(eq(matchSources.provider, "openfootball"), inArray(matchSources.externalFixtureId, sourceIds))).orderBy(matchSources.id);
  const linkedIds = sources.map((s) => s.matchId);
  // Include incomplete manual history as candidates, never silently declare it absent.
  const local = await db.select().from(matches).where(or(eq(matches.seasonId, seasonId), sql`${matches.seasonId} is null`, linkedIds.length ? inArray(matches.id, linkedIds) : undefined)).orderBy(matches.id).limit(1001);
  if (local.length > 1000) throw new ImportError("Demasiados candidatos locales. Completa las temporadas desconocidas antes de importar.");
  const rows: ImportRow[] = batch.records.map((record) => {
    const fingerprint = digest(record), sourceId = sourceIdentity(input, record);
    const incoming: ImportFacts = {
      homeClubId: localClub(record.home), awayClubId: localClub(record.away), playedOn: record.playedOn,
      homeScore: record.homeScore, awayScore: record.awayScore, seasonId, competitionId,
      phase: record.phase, status: record.homeScore !== null && input.resultsConfirmed ? "finished" : "unknown", stadiumId: null, factualNotes: null,
    };
    validateMatch(incoming);
    const source = sources.find((s) => s.externalFixtureId === sourceId);
    const requested = input.targets[fingerprint] ?? "";
    if (requested && requested !== "new" && requested !== "skip") validId(requested);
    if (source && requested && requested !== "skip" && requested !== source.matchId) throw new ImportError("Un vínculo histórico reconocido no se puede reasignar desde la importación.");
    const target = source ? requested === "skip" ? "skip" : source.matchId : requested;
    const existing = local.find((m) => m.id === target);
    if (target && target !== "new" && target !== "skip" && !existing) throw new ImportError("El destino ya no existe o está fuera de la temporada. Revisa el preview.");
    const likely = local.filter((m) => (m.homeClubId === incoming.homeClubId && m.awayClubId === incoming.awayClubId) || (record.playedOn !== null && m.playedOn === record.playedOn) || m.homeClubId === null || m.awayClubId === null);
    const proposed = existing ? mergedFacts(existing, incoming) : incoming;
    const orientationConflict = existing && !existing.factsLocked && existing.homeScore !== null && incoming.homeScore === null && (existing.homeClubId !== incoming.homeClubId || existing.awayClubId !== incoming.awayClubId);
    const issue = orientationConflict ? "Cambian los equipos con un resultado local conocido y sin goles nuevos. Omite este registro y corrige su designación mediante 4a antes de revisarlo otra vez." : undefined;
    const changes = existing ? factKeys.filter((key) => existing[key] !== proposed[key]) : [];
    const category: ImportCategory = orientationConflict ? "conflict" : existing ? existing.factsLocked ? "protected" : changes.length ? "update" : "unchanged" : target === "new" ? "new" : likely.length ? "conflict" : "new";
    return { candidateIds: likely.map((m) => m.id), issue, fingerprint, sourceId, label: `${record.playedOn ?? "Fecha desconocida"} · ${record.home} — ${record.away}`, category, target, incoming, proposed, existing: existing ? factsOf(existing) : null, changes };
  });
  const chosen = rows.filter((r) => r.target && !["new", "skip"].includes(r.target)).map((r) => r.target);
  if (new Set(chosen).size !== chosen.length) throw new ImportError("Dos registros del lote apuntan al mismo partido local. Omite uno y revisa el conflicto.");
  return {
    rows, candidates: local.map((m) => ({ id: m.id, label: `${m.playedOn ?? "Sin fecha"} · ${clubMap.get(m.homeClubId ?? "") ?? "Desconocido"} — ${clubMap.get(m.awayClubId ?? "") ?? "Desconocido"} · ${m.phase ?? "Sin fase"} · ${m.id}` })),
    snapshot: digest({ input, local, sources, season, competition, clubs: clubRows.sort((a, b) => a.id.localeCompare(b.id)) }),
    total: batch.total, offset: input.offset, seasonLabel: season.label, competitionLabel: competition.name,
  };
}

// Caller owns the transaction and authorization. Table locks also serialize with
// manual edits/deletion: revalidation and writes cannot race a local correction.
export async function applyFixtureImport(db: ImportDatabase, input: ImportInput, expectedSnapshot: string) {
  await db.execute(sql`lock table matches, match_sources in share row exclusive mode`);
  const preview = await previewFixtureImport(db, input);
  if (preview.snapshot !== expectedSnapshot) throw new ImportError("Los datos han cambiado desde el preview. Genera y revisa uno nuevo; no se ha aplicado el lote.");
  if (preview.rows.some((row) => row.issue && row.target !== "skip")) throw new ImportError("Hay un conflicto de designación que requiere corrección manual; omite ese registro o corrígelo con 4a.");
  if (preview.rows.some((row) => !row.target)) throw new ImportError("Decide vincular, crear u omitir cada registro antes de aplicar.");
  let created = 0, updated = 0, protectedCount = 0, skipped = 0;
  for (const row of preview.rows) {
    if (row.target === "skip") { skipped++; continue; }
    let matchId = row.target;
    if (matchId === "new") {
      const [inserted] = await db.insert(matches).values({ ...row.incoming, factsLocked: false }).returning({ id: matches.id });
      matchId = inserted.id; created++;
    } else if (row.category === "update") {
      await db.update(matches).set(row.proposed).where(eq(matches.id, matchId)); updated++;
    } else if (row.category === "protected") protectedCount++;
    const [prior] = await db.select().from(matchSources).where(and(eq(matchSources.provider, "openfootball"), eq(matchSources.externalFixtureId, row.sourceId)));
    if (prior) {
      if (prior.matchId !== matchId) throw new ImportError("Conflicto de identidad; vuelve a generar el preview.");
      await db.update(matchSources).set({ revisions: [...new Set([...prior.revisions, input.revision])], lastSyncedAt: new Date() }).where(eq(matchSources.id, prior.id));
    } else await db.insert(matchSources).values({ matchId, provider: "openfootball", externalFixtureId: row.sourceId, repository: input.repository, path: input.path, fingerprint: row.fingerprint, revisions: [input.revision] });
  }
  return { created, updated, protectedCount, skipped };
}
