import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq, count } from "drizzle-orm";
import "../scripts/env";
import { createDatabase, type Database } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { matches, matchSources, attendance, seasons } from "../src/db/schema";
import { fixtureIds } from "../src/db/fixtures";
import { InvalidReference } from "../src/server/reference-input";
import { ELCHE_CLUB_ID } from "../src/lib/identity";
import { parseImport, selectedRecords, digest, decodeImportInput, type ImportInput } from "../src/server/import-input";
import { signImportReview, verifyImportReview } from "../src/server/import-review";
import { previewFixtureImport, applyFixtureImport } from "../src/db/fixture-import";

const base = (changes: Partial<ImportInput> = {}): ImportInput => ({
  repository: "openfootball/football.json", path: "2030-31/es.2.json", revision: "a".repeat(40), format: "json",
  content: JSON.stringify({ matches: [{ date: "2030-10-10", team1: "Elche CF", team2: "Club de prueba", round: "Jornada sintética", score: { ft: [1, 0] } }] }),
  seasonId: fixtureIds.season, competitionId: fixtureIds.league, offset: 0, elcheName: "Elche CF", resultsConfirmed: true,
  mappings: { "Elche CF": ELCHE_CLUB_ID, "Club de prueba": fixtureIds.north }, targets: {}, ...changes,
});
function decide(input: ImportInput, target: string) {
  input.targets = Object.fromEntries(selectedRecords(input).records.map((r) => [digest(r), target]));
  return input;
}
const { db, pool } = createDatabase(localDatabaseUrl("testing"));
after(() => pool.end());
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
async function rolledBack(run: (tx: Transaction) => Promise<void>) {
  const rollback = new Error("Import test rollback");
  try { await db.transaction(async (tx) => { await run(tx); throw rollback; }); }
  catch (error) { if (error !== rollback) throw error; }
}

test("JSON variants normalize consistently, reject malformed facts, and bound Elche batches", () => {
  const plain = parseImport(base());
  const record = { date: "2030-10-10", team1: "Elche CF", team2: "Club de prueba", round: "Jornada sintética", score: [1, 0] };
  assert.deepEqual(parseImport(base({ content: JSON.stringify([record]) })), plain);
  assert.deepEqual(parseImport(base({ content: JSON.stringify({ rounds: [{ name: record.round, matches: [record] }] }) })), plain);
  const et = parseImport(base({ content: JSON.stringify([{ ...record, score: { ft: [1, 1], et: [2, 2], p: [4, 3] } }]) }));
  assert.equal(et[0].homeScore, 2); assert.equal(et[0].awayScore, 2);
  for (const content of ["not-json", JSON.stringify([{ ...record, date: "2030-02-30" }]), JSON.stringify([{ ...record, score: [1] }]), JSON.stringify([{ ...record, score: [-1, 0] }])]) assert.throws(() => parseImport(base({ content })));
  assert.throws(() => decodeImportInput({ ...base(), path: "../secret" }));
  assert.throws(() => decodeImportInput({ ...base(), revision: "main" }));
  assert.throws(() => parseImport(base({ content: "x".repeat(350001) })));
  const large = base({ content: JSON.stringify(Array.from({ length: 45 }, (_, i) => ({ ...record, round: `Round ${i}` }))) });
  assert.equal(selectedRecords(large).records.length, 40);
  assert.equal(selectedRecords({ ...large, offset: 40 }).records.length, 5);
  assert.throws(() => selectedRecords({ ...large, offset: 45 }));
  assert.throws(() => selectedRecords(base({ content: JSON.stringify([record, record]) })));
});

test("Football.TXT covers both fixture layouts, year context, extra time and shootouts without inventing dates", () => {
  const content = `= Spain Copa del Rey 2030/31\n\n▪ Round 1\nWed Oct 30 2030\n  20:30 Elche CF          v Club de prueba           5-4 pen. 2-2 a.e.t. (1-1, 0-0)\n▪ Round 2\nSun Jan 5\n  Elche CF           3-1 (1-0)  Club de prueba\n▪ Round 3\n  Elche CF           v Club de prueba\n`;
  const rows = parseImport(base({ content, format: "txt", repository: "openfootball/espana" }));
  assert.deepEqual(rows.map((r) => [r.playedOn, r.homeScore, r.awayScore]), [["2030-10-30", 2, 2], ["2031-01-05", 3, 1], [null, null, null]]);
  assert.throws(() => parseImport(base({ content: content + "unrecognized fixture", format: "txt" })), /Línea/);
});

test("signed review detects tampering, expiry and cross-environment keys", () => {
  const token = signImportReview(base(), "b".repeat(64), "test-key", 1000);
  assert.deepEqual(verifyImportReview(token, "test-key", 2000).input, base());
  assert.throws(() => verifyImportReview(token, "other-key", 2000));
  assert.throws(() => verifyImportReview(token, "test-key", 1801001));
  assert.throws(() => verifyImportReview(token + "modified", "test-key", 2000));
});

test("initial imports, retries, changed records and revisions keep one stable match and personal record", async () => {
  await rolledBack(async (tx) => {
    let input = base();
    const before = await tx.select({ total: count() }).from(matches);
    let preview = await previewFixtureImport(tx, input);
    assert.equal(preview.rows[0].target, "");
    await assert.rejects(() => applyFixtureImport(tx, input, preview.snapshot), /Decide/);
    input = decide(input, "new"); preview = await previewFixtureImport(tx, input);
    await applyFixtureImport(tx, input, preview.snapshot);
    const [source] = await tx.select().from(matchSources).where(eq(matchSources.externalFixtureId, preview.rows[0].sourceId));
    const [created] = await tx.select().from(matches).where(eq(matches.id, source.matchId));
    assert.equal(created.factsLocked, false);
    assert.equal((await tx.select().from(attendance).where(eq(attendance.matchId, created.id))).length, 0);
    await tx.insert(attendance).values({ matchId: created.id, slug: "import-synthetic-trip", notes: "Memoria intacta", isSpecial: true });
    const [personal] = await tx.select().from(attendance).where(eq(attendance.matchId, created.id));
    await assert.rejects(() => applyFixtureImport(tx, input, preview.snapshot), /han cambiado|vínculo histórico/);
    input = base({ revision: "c".repeat(40) }); preview = await previewFixtureImport(tx, input);
    assert.equal(preview.rows[0].category, "unchanged");
    assert.equal(preview.rows[0].target, created.id);
    await applyFixtureImport(tx, input, preview.snapshot);
    const [observed] = await tx.select().from(matchSources).where(eq(matchSources.id, source.id));
    assert.deepEqual(observed.revisions, ["a".repeat(40), "c".repeat(40)]);
    const changed = base({ content: JSON.stringify([{ date: "2030-10-12", team1: "Elche CF", team2: "Club de prueba", score: { ft: [2, 0] } }]) });
    preview = await previewFixtureImport(tx, changed);
    assert.equal(preview.rows[0].category, "conflict");
    assert.equal(preview.rows[0].target, "");
    decide(changed, created.id); preview = await previewFixtureImport(tx, changed);
    assert.equal(preview.rows[0].category, "update");
    await applyFixtureImport(tx, changed, preview.snapshot);
    const [updated] = await tx.select().from(matches).where(eq(matches.id, created.id));
    assert.equal(updated.playedOn, "2030-10-12");
    assert.deepEqual(updated.createdAt, created.createdAt);
    assert.ok(updated.updatedAt > created.updatedAt);
    assert.deepEqual((await tx.select().from(attendance).where(eq(attendance.matchId, created.id)))[0], personal);
    assert.equal((await tx.select({ total: count() }).from(matches))[0].total, before[0].total + 1);
    const old = await previewFixtureImport(tx, base());
    assert.equal(old.rows[0].target, created.id); // Old version remains linked; no new match.
    assert.equal((await tx.select().from(matchSources).where(eq(matchSources.matchId, created.id))).length, 2);
  });
});

test("missing fields preserve known facts; local locks protect every fixture fact and all attendance metadata", async () => {
  await rolledBack(async (tx) => {
    const [prior] = await tx.select().from(matches).where(eq(matches.id, fixtureIds.homeMatch));
    const [personal] = await tx.select().from(attendance).where(eq(attendance.matchId, prior.id));
    const input = decide(base(), prior.id);
    let preview = await previewFixtureImport(tx, input);
    assert.equal(preview.rows[0].category, "protected");
    await applyFixtureImport(tx, input, preview.snapshot);
    assert.deepEqual((await tx.select().from(matches).where(eq(matches.id, prior.id)))[0], prior);
    assert.deepEqual((await tx.select().from(attendance).where(eq(attendance.matchId, prior.id)))[0], personal);
    const fresh = decide(base({ path: "2030-31/other.json" }), "new");
    preview = await previewFixtureImport(tx, fresh); await applyFixtureImport(tx, fresh, preview.snapshot);
    const [source] = await tx.select().from(matchSources).where(eq(matchSources.externalFixtureId, preview.rows[0].sourceId));
    await tx.update(matches).set({ stadiumId: fixtureIds.ground, factualNotes: "Hecho conocido" }).where(eq(matches.id, source.matchId));
    const absent = decide(base({ path: fresh.path, content: JSON.stringify([{ team1: "Elche CF", team2: "Club de prueba" }]), resultsConfirmed: false }), source.matchId);
    preview = await previewFixtureImport(tx, absent);
    assert.equal(preview.rows[0].category, "unchanged");
    await applyFixtureImport(tx, absent, preview.snapshot);
    const [preserved] = await tx.select().from(matches).where(eq(matches.id, source.matchId));
    assert.equal(preserved.homeScore, 1); assert.equal(preserved.status, "finished"); assert.equal(preserved.playedOn, "2030-10-10");
    assert.equal(preserved.stadiumId, fixtureIds.ground); assert.equal(preserved.factualNotes, "Hecho conocido");
    const { writeFixture } = await import("../src/db/admin-fixtures");
    await assert.rejects(() => writeFixture(tx, { id: source.matchId, intent: "delete", confirmDelete: "yes" }), (error: unknown) => error instanceof InvalidReference && /procedencia/.test(error.errors.id));
  });
});

test("stale reviews, duplicate targets and invalid reference mappings never mutate local data", async () => {
  await rolledBack(async (tx) => {
    const input = decide(base(), "new");
    const preview = await previewFixtureImport(tx, input);
    const beforeSources = await tx.select().from(matchSources);
    await tx.update(matches).set({ factsLocked: true }).where(eq(matches.id, fixtureIds.awayMatch));
    await assert.rejects(() => applyFixtureImport(tx, input, preview.snapshot), /han cambiado/);
    assert.deepEqual(await tx.select().from(matchSources), beforeSources);
    await assert.rejects(() => previewFixtureImport(tx, { ...input, mappings: { ...input.mappings, "Club de prueba": ELCHE_CLUB_ID } }), /Elche/);
    const duplicate = base({ content: JSON.stringify([{ team1: "Elche CF", team2: "Club de prueba", date: "2030-10-10" }, { team1: "Elche CF", team2: "Club de prueba", date: "2030-10-11" }]) });
    decide(duplicate, fixtureIds.homeMatch);
    await assert.rejects(() => previewFixtureImport(tx, duplicate), /Dos registros/);
  });
});

test("a failure after the first insert rolls the entire batch back; retrying a new preview is safe", async () => {
  await rolledBack(async (tx) => {
    const input = decide(base({ content: JSON.stringify([{ team1: "Elche CF", team2: "Club de prueba", date: "2030-11-10" }, { team1: "Elche CF", team2: "Club de prueba", date: "2030-11-11" }]) }), "new");
    const preview = await previewFixtureImport(tx, input);
    const before = await tx.select({ total: count() }).from(matches);
    let failOnce = true;
    await assert.rejects(() => tx.transaction(async (savepoint) => {
      const wrapped: Parameters<typeof applyFixtureImport>[0] = {
        select: savepoint.select.bind(savepoint), execute: savepoint.execute.bind(savepoint), update: savepoint.update.bind(savepoint),
        insert: ((...args: Parameters<typeof savepoint.insert>) => {
          if (args[0] === matchSources && failOnce) { failOnce = false; throw new Error("Synthetic interruption after fixture insert"); }
          return savepoint.insert(...args);
        }) as typeof savepoint.insert,
      };
      await applyFixtureImport(wrapped, input, preview.snapshot);
    }), /Synthetic interruption/);
    assert.deepEqual(await tx.select({ total: count() }).from(matches), before);
    await applyFixtureImport(tx, input, (await previewFixtureImport(tx, input)).snapshot);
    assert.equal((await tx.select({ total: count() }).from(matches))[0].total, before[0].total + 2);
  });
});


test("future seasons use the same explicit flow without affecting existing season fixtures", async () => {
  await rolledBack(async (tx) => {
    const [future] = await tx.insert(seasons).values({ label: "2041/42 import test", startYear: 2041 }).returning();
    const before = await tx.select().from(matches).where(eq(matches.seasonId, fixtureIds.season)).orderBy(matches.id);
    const input = decide(base({ seasonId: future.id, path: "2041-42/es.1.json", content: JSON.stringify([{ team1: "Elche CF", team2: "Club de prueba", date: "2041-09-10" }]), resultsConfirmed: false }), "new");
    const preview = await previewFixtureImport(tx, input);
    await applyFixtureImport(tx, input, preview.snapshot);
    const repeat = await previewFixtureImport(tx, { ...input, targets: {} });
    assert.equal(repeat.rows[0].category, "unchanged");
    assert.equal(repeat.rows[0].incoming.status, "unknown");
    assert.equal((await tx.select().from(matches).where(eq(matches.seasonId, future.id))).length, 1);
    assert.deepEqual(await tx.select().from(matches).where(eq(matches.seasonId, fixtureIds.season)).orderBy(matches.id), before);
  });
});


test("changed designation without new goals requires manual correction instead of reorienting known scores", async () => {
  await rolledBack(async (tx) => {
    const initial = decide(base(), "new");
    const preview = await previewFixtureImport(tx, initial);
    await applyFixtureImport(tx, initial, preview.snapshot);
    const [source] = await tx.select().from(matchSources).where(eq(matchSources.externalFixtureId, preview.rows[0].sourceId));
    const changed = decide(base({ content: JSON.stringify([{ date: "2030-10-10", team1: "Club de prueba", team2: "Elche CF" }]) }), source.matchId);
    const conflict = await previewFixtureImport(tx, changed);
    assert.equal(conflict.rows[0].category, "conflict");
    assert.ok(conflict.rows[0].issue);
    await assert.rejects(() => applyFixtureImport(tx, changed, conflict.snapshot), /designación/);
    const [preserved] = await tx.select().from(matches).where(eq(matches.id, source.matchId));
    assert.equal(preserved.homeClubId, ELCHE_CLUB_ID);
    assert.equal(preserved.homeScore, 1);
  });
});

test("simultaneous applies cannot create duplicate matches or source versions", async () => {
  const path = `2030-31/concurrent-${Date.now()}.json`;
  const input = decide(base({ path }), "new");
  const preview = await previewFixtureImport(db, input);
  try {
    const results = await Promise.allSettled([
      db.transaction((tx) => applyFixtureImport(tx, input, preview.snapshot)),
      db.transaction((tx) => applyFixtureImport(tx, input, preview.snapshot)),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    const links = await db.select().from(matchSources).where(eq(matchSources.path, path));
    assert.equal(links.length, 1);
    assert.equal((await db.select().from(matches).where(eq(matches.id, links[0].matchId))).length, 1);
  } finally {
    const links = await db.select().from(matchSources).where(eq(matchSources.path, path));
    await db.delete(matchSources).where(eq(matchSources.path, path));
    for (const link of links) await db.delete(matches).where(eq(matches.id, link.matchId));
  }
});
