import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "./connection";
import { clubs, competitions, importBatches, matches, matchSources, seasons } from "./schema";
import { previewFixtureImport, applyFixtureImport, sourceIdentity, type PreviewContext } from "./fixture-import";
import { digest, IMPORT_BATCH_SIZE, ImportError, type ImportInput } from "../server/import-input";
import { seasonLabel, type Acquisition } from "../server/openfootball";
import type { GlobalPlan, GlobalPreview, PlannedReference, BatchProgress } from "../server/global-import-types";
import { ELCHE_CLUB_ID } from "../lib/identity";
import { availableSlug } from "../lib/slugs";

type GlobalDatabase = Pick<Database, "select" | "insert" | "update" | "execute">;
export async function readGlobalContext(db: GlobalDatabase) {
  const clubRows = await db.select().from(clubs).orderBy(clubs.id);
  const seasonRows = await db.select().from(seasons).orderBy(seasons.id);
  const competitionRows = await db.select().from(competitions).orderBy(competitions.id);
  const localRows = await db.select().from(matches).orderBy(matches.id).limit(10001);
  const sourceRows = await db.select().from(matchSources).orderBy(matchSources.id).limit(20001);
  if (localRows.length > 10000 || sourceRows.length > 20000) throw new ImportError("El archivo local supera el límite de revisión global. Utiliza el modo avanzado por lotes.");
  return { clubs: clubRows, seasons: seasonRows, competitions: competitionRows, localRows, sourceRows };
}
export async function globalSnapshot(db: GlobalDatabase) { return digest(await readGlobalContext(db)); }
const refKey = (kind: PlannedReference["kind"], name: string) => `${kind}:${name}`;
function refId(reference: PlannedReference) { return reference.choice && reference.choice !== "new" ? reference.choice : reference.id; }
export function globalBatches(plan: GlobalPlan): ImportInput[] {
  const find = (kind: PlannedReference["kind"], name: string) => {
    const reference = plan.references.find((r) => r.key === refKey(kind, name));
    if (!reference) throw new ImportError("Falta una referencia del preview global.");
    return refId(reference);
  };
  return plan.acquisition.files.flatMap((file) => {
    const mappings = Object.fromEntries([...new Set(file.records.flatMap((r) => [r.home, r.away]))].map((name) => [name, find("clubs", name)]));
    // Keep normalized records byte-for-byte equivalent for source fingerprints,
    // while discarding the other clubs' fixtures and the raw downloaded payload.
    const content = JSON.stringify(file.records.map((r) => ({ team1: r.home, team2: r.away, date: r.playedOn, round: r.phase, score: r.homeScore === null ? null : [r.homeScore, r.awayScore] })));
    return Array.from({ length: Math.ceil(file.records.length / IMPORT_BATCH_SIZE) }, (_, i) => {
      const input: ImportInput = { repository: file.repository, path: file.path, revision: file.revision, format: "json", content, seasonId: find("seasons", seasonLabel(file.year)), competitionId: find("competitions", file.competition), elcheName: "Elche CF", offset: i * IMPORT_BATCH_SIZE, resultsConfirmed: plan.resultsConfirmed, mappings, targets: {} };
      input.targets = Object.fromEntries(file.records.slice(input.offset, input.offset + IMPORT_BATCH_SIZE).map((r) => [digest(r), plan.targets[sourceIdentity(input, r)] ?? ""]));
      return input;
    });
  });
}
export async function newGlobalPlan(db: GlobalDatabase, acquisition: Acquisition, resultsConfirmed: boolean): Promise<GlobalPlan> {
  const context = await readGlobalContext(db);
  const references: PlannedReference[] = [];
  // An exact historical source link can retain club identity after a local
  // reference rename. Conflicting hints remain manual; never fuzzy-match names.
  const hints = new Map<string, Set<string>>();
  for (const file of acquisition.files) for (const record of file.records) {
    const source = context.sourceRows.find((s) => s.provider === "openfootball" && s.externalFixtureId === sourceIdentity(file, record));
    const match = source && context.localRows.find((m) => m.id === source.matchId);
    if (!match) continue;
    for (const [name, id] of [[record.home, match.homeClubId], [record.away, match.awayClubId]] as const) {
      if (!id || ((name === "Elche CF") !== (id === ELCHE_CLUB_ID))) continue;
      hints.set(name, new Set([...(hints.get(name) ?? []), id]));
    }
  }
  function add(kind: PlannedReference["kind"], name: string, startYear?: number) {
    if (references.some((r) => r.key === refKey(kind, name))) return;
    const rows = kind === "seasons" ? context.seasons.filter((r) => r.label === name) : context[kind].filter((r) => r.name === name);
    const elche = kind === "clubs" && name === "Elche CF";
    const hinted = kind === "clubs" ? hints.get(name) : undefined;
    const options = elche ? context.clubs.filter((r) => r.id === ELCHE_CLUB_ID) : hinted?.size ? context.clubs.filter((r) => hinted.has(r.id)) : rows;
    references.push({ key: refKey(kind, name), kind, name, ...(startYear === undefined ? {} : { startYear }), id: elche ? ELCHE_CLUB_ID : randomUUID(), choice: options.length === 1 ? options[0].id : options.length ? "" : "new" });
  }
  for (const file of acquisition.files.filter((f) => f.records.length)) {
    add("seasons", seasonLabel(file.year), file.year); add("competitions", file.competition);
    for (const r of file.records) { add("clubs", r.home); add("clubs", r.away); }
  }
  return { id: randomUUID(), acquisition, references, targets: {}, resultsConfirmed, batchIndex: 0, expectedSnapshot: digest(context), approved: false, ready: false };
}
function virtualContext(context: Awaited<ReturnType<typeof readGlobalContext>>, references: PlannedReference[]): PreviewContext {
  const virtual: PreviewContext = { clubs: context.clubs.map(({ id, name }) => ({ id, name })), seasons: context.seasons.map(({ id, label }) => ({ id, label })), competitions: context.competitions.map(({ id, name }) => ({ id, name })), localRows: context.localRows, sourceRows: context.sourceRows };
  // Add proposed creations before validating aliases, so the owner can map
  // multiple source spellings to ONE new club/competition in the same review.
  for (const ref of references.filter((r) => r.choice === "new" || !r.choice)) {
    if (virtual[ref.kind].some((r) => r.id === ref.id)) continue;
    if (ref.kind === "seasons") virtual.seasons.push({ id: ref.id, label: ref.name });
    else virtual[ref.kind].push({ id: ref.id, name: ref.name });
  }
  for (const ref of references) if (!virtual[ref.kind].some((r) => r.id === refId(ref))) throw new ImportError("Una referencia seleccionada no existe o dejó de proponerse como nueva. Revisa sus asignaciones, incluidas las compartidas.");
  return virtual;
}
export async function previewGlobalImport(db: GlobalDatabase, plan: GlobalPlan): Promise<GlobalPreview> {
  if (plan.approved || plan.batchIndex > 0) throw new ImportError("La importación ya se inició. Reanuda sus lotes o solicita una comprobación nueva.");
  const context = await readGlobalContext(db);
  const virtual = virtualContext(context, plan.references);
  const batches = [];
  const sourceIds = new Set<string>(), targetIds = new Set<string>();
  for (const input of globalBatches(plan)) {
    const preview = await previewFixtureImport(db, input, virtual);
    for (const row of preview.rows) {
      if (sourceIds.has(row.sourceId)) throw new ImportError("El conjunto contiene la misma versión de un registro más de una vez. Revisa los archivos.");
      sourceIds.add(row.sourceId);
      if (row.target && !["new", "skip"].includes(row.target)) {
        if (targetIds.has(row.target)) throw new ImportError("Dos registros globales apuntan al mismo partido. Omite uno para conservar una reconciliación inequívoca.");
        targetIds.add(row.target);
      }
    }
    batches.push({ label: `${preview.seasonLabel} · ${preview.competitionLabel} · ${input.offset + 1}–${input.offset + preview.rows.length}`, rows: preview.rows, candidates: preview.candidates });
  }
  // Cross-file date/team coincidences are hints too, never permanent identity.
  // Surface them before proposing multiple new local fixtures for one encounter.
  const grouped = new Map<string, typeof batches[number]["rows"]>();
  for (const batch of batches) for (const row of batch.rows) {
    if (row.incoming.playedOn) {
      const key = digest([row.incoming.seasonId, row.incoming.homeClubId, row.incoming.awayClubId, row.incoming.playedOn]);
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
  }
  for (const group of grouped.values()) if (group.length > 1) for (const row of group) if (!row.target) row.category = "conflict";
  for (const batch of batches) for (const row of batch.rows) {
    if (!row.target && row.category === "new") row.target = "new";
    if (row.target) plan.targets[row.sourceId] = row.target;
  }
  plan.expectedSnapshot = digest(context);
  const applicable = batches.length > 0 && plan.references.every((r) => r.choice) && batches.every((b) => b.rows.every((r) => r.target && !r.issue));
  plan.ready = applicable;
  return { batches, references: plan.references, options: { clubs: virtual.clubs, seasons: virtual.seasons, competitions: virtual.competitions }, applicable, resultsConfirmed: plan.resultsConfirmed, total: batches.reduce((n, b) => n + b.rows.length, 0) };
}
export function globalPlanHash(plan: GlobalPlan) { return digest({ id: plan.id, acquisition: plan.acquisition, references: plan.references, targets: plan.targets, resultsConfirmed: plan.resultsConfirmed }); }
async function createBatchReferences(db: GlobalDatabase, plan: GlobalPlan, input: ImportInput) {
  const needed = new Set([input.seasonId, input.competitionId, ...Object.values(input.mappings)]);
  for (const ref of plan.references.filter((r) => r.choice === "new" && needed.has(r.id))) {
    const table = { clubs, seasons, competitions }[ref.kind];
    if ((await db.select({ id: table.id }).from(table).where(eq(table.id, ref.id))).length) continue;
    if (ref.kind === "seasons") await db.insert(seasons).values({ id: ref.id, label: ref.name, startYear: ref.startYear!, elcheTierId: null });
    else if (ref.kind === "competitions") await db.insert(competitions).values({ id: ref.id, name: ref.name });
    else {
      const slug = await availableSlug(ref.name, async (candidate) => (await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, candidate))).length > 0);
      await db.insert(clubs).values({ id: ref.id, name: ref.name, slug });
    }
  }
}
export async function globalProgress(db: GlobalDatabase, plan: GlobalPlan): Promise<BatchProgress[]> {
  const rows = await db.select().from(importBatches).where(eq(importBatches.planId, plan.id)).orderBy(importBatches.batchIndex);
  if (rows.some((r) => r.planHash !== globalPlanHash(plan))) throw new ImportError("Las decisiones no coinciden con los lotes ya aplicados.");
  if (rows.some((r, i) => r.batchIndex !== i)) throw new ImportError("Progreso de importación no contiguo. Revisa los lotes antes de continuar.");
  return rows.map((r) => ({ index: r.batchIndex, result: r.result, replayed: true }));
}
// Transaction supplied by the authorized action. No writes before confirmation.
export async function applyGlobalBatch(db: GlobalDatabase, plan: GlobalPlan, confirmed: boolean) {
  if (!plan.ready) throw new ImportError("Resuelve y revisa todo el preview global antes de aplicar lotes.");
  if (!confirmed) throw new ImportError("Confirma el preview global antes de aplicar cualquier lote.");
  await db.execute(sql`lock table clubs, competitions, seasons, matches, match_sources, import_batches in share row exclusive mode`);
  const inputs = globalBatches(plan);
  if (plan.batchIndex >= inputs.length) throw new ImportError("Todos los lotes están completados.");
  const planHash = globalPlanHash(plan);
  const [prior] = await db.select().from(importBatches).where(and(eq(importBatches.planId, plan.id), eq(importBatches.batchIndex, plan.batchIndex)));
  if (prior) {
    if (prior.planHash !== planHash) throw new ImportError("Las decisiones del lote no coinciden con su recibo.");
    return { next: { ...plan, approved: true, batchIndex: plan.batchIndex + 1, expectedSnapshot: prior.afterSnapshot }, outcome: { index: plan.batchIndex, result: prior.result, replayed: true } };
  }
  const previous = await globalProgress(db, plan);
  if (previous.length !== plan.batchIndex) throw new ImportError("Reanuda desde el siguiente lote pendiente; no se pueden saltar lotes.");
  if (await globalSnapshot(db) !== plan.expectedSnapshot) throw new ImportError("Los datos locales cambiaron desde el preview o el último lote. No se ha escrito este lote. Solicita una comprobación nueva para revisar los cambios; los anteriores se conservan.");
  if (plan.references.some((r) => !r.choice)) throw new ImportError("Resuelve las referencias ambiguas del preview global.");
  const input = inputs[plan.batchIndex];
  await createBatchReferences(db, plan, input);
  const preview = await previewFixtureImport(db, input);
  const result = await applyFixtureImport(db, input, preview.snapshot);
  const afterSnapshot = await globalSnapshot(db);
  await db.insert(importBatches).values({ planId: plan.id, batchIndex: plan.batchIndex, planHash, afterSnapshot, result });
  return { next: { ...plan, approved: true, batchIndex: plan.batchIndex + 1, expectedSnapshot: afterSnapshot }, outcome: { index: plan.batchIndex, result, replayed: false } };
}
export async function resumeGlobalImport(db: GlobalDatabase, plan: GlobalPlan) {
  const progress = await globalProgress(db, plan);
  if (!progress.length) return plan;
  const [last] = await db.select().from(importBatches).where(and(eq(importBatches.planId, plan.id), eq(importBatches.batchIndex, progress.length - 1)));
  return { ...plan, approved: true, batchIndex: progress.length, expectedSnapshot: last.afterSnapshot };
}
