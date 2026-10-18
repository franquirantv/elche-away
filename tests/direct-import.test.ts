import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { count, eq } from "drizzle-orm";
import "../scripts/env";
import { createDatabase, type Database } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { clubs, matches, matchSources, attendance } from "../src/db/schema";
import { newGlobalPlan, previewGlobalImport, applyGlobalBatch, resumeGlobalImport, globalProgress, globalSnapshot } from "../src/db/global-import";
import { obtainOpenFootball, type Acquisition } from "../src/server/openfootball";
import { signGlobalPlan, verifyGlobalPlan } from "../src/server/global-review";

const { db, pool } = createDatabase(localDatabaseUrl("testing"));
after(() => pool.end());
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
async function rolledBack(run: (tx: Transaction) => Promise<void>) {
  const rollback = new Error("Global import test rollback");
  try { await db.transaction(async (tx) => { await run(tx); throw rollback; }); }
  catch (error) { if (error !== rollback) throw error; }
}
function acquisition(size = 2): Acquisition {
  return { startYear: 2018, endYear: 2019, coverage: [], revisions: { "openfootball/football.json": "a".repeat(40) }, files: [{ repository: "openfootball/football.json", path: `2018-19/synthetic-${randomUUID()}.json`, revision: "a".repeat(40), year: 2018, competition: "Competición directa sintética", records: Array.from({ length: size }, (_, i) => ({ home: "Elche CF", away: "Rival directo sintético", playedOn: `2018-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + i % 28).padStart(2, "0")}`, homeScore: 1, awayScore: 0, phase: `Jornada sintética ${i + 1}` })) }] };
}
async function reviewed(tx: Transaction, data = acquisition()) {
  const plan = await newGlobalPlan(tx, data, true);
  const preview = await previewGlobalImport(tx, plan);
  for (const b of preview.batches) for (const r of b.rows) if (!r.target) plan.targets[r.sourceId] = "new";
  assert.equal((await previewGlobalImport(tx, plan)).applicable, true);
  return plan;
}
function mockGitHub(options: { rateLimit?: boolean; brokenFile?: boolean; truncated?: boolean } = {}) {
  const requests: string[] = [];
  const fetcher: typeof fetch = async (resource, init) => {
    const url = String(resource); requests.push(url);
    assert.ok(url.startsWith("https://api.github.com/repos/openfootball/") || url.startsWith("https://raw.githubusercontent.com/openfootball/"));
    assert.equal(init?.redirect, "error"); assert.equal(init?.credentials, "omit");
    assert.equal(new Headers(init?.headers).has("authorization"), false);
    if (options.rateLimit) return new Response("limited", { status: 403 });
    const repository = url.includes("football.json") ? "openfootball/football.json" : "openfootball/espana";
    const sha = repository.endsWith("espana") ? "b".repeat(40) : "a".repeat(40);
    if (url.endsWith("/git/ref/heads/master")) return Response.json({ object: { type: "commit", sha } });
    if (url.includes("/git/trees/")) {
      assert.ok(url.includes(sha));
      const paths = repository.endsWith("espana") ? ["2018-19/cup.txt"] : ["2018-19/es.2.json", "2019-20/es.2.json"];
      return Response.json({ truncated: options.truncated ?? false, tree: paths.map((path) => ({ type: "blob", path })) });
    }
    assert.ok(url.includes(sha)); assert.ok(!url.includes("/master/"));
    if (options.brokenFile) return new Response("missing upstream", { status: 404 });
    if (url.endsWith("cup.txt")) return new Response("= Spain Copa del Rey 2018/19\n▪ Round 1\nWed Oct 10 2018\n  Elche CF    1-0  Rival sintético\n");
    return Response.json([{ team1: "Elche CF", team2: "Rival sintético", date: "2018-10-10", score: { ft: [1, 0] } }, { team1: "Otros", team2: "Otros dos", date: "2018-10-10" }]);
  };
  return { fetcher, requests };
}

test("direct acquisition pins one revision per allowlisted repository, uses JSON/TXT and exposes coverage gaps", async () => {
  const mock = mockGitHub();
  const obtained = await obtainOpenFootball(2018, 2019, mock.fetcher);
  assert.equal(mock.requests.filter((u) => u.includes("/git/ref/")).length, 2);
  assert.equal(obtained.files.length, 3);
  assert.ok(obtained.files.every((f) => f.records.length === 1 && f.records[0].home === "Elche CF"));
  assert.ok(obtained.coverage.some((c) => c.status === "missing"));
  assert.ok(obtained.coverage.some((c) => c.competition.includes("Playoffs") && c.status === "unverified"));
  assert.ok(obtained.coverage.some((c) => c.competition.includes("Segunda B") && c.status === "unverified"));
  await assert.rejects(() => obtainOpenFootball(2016, 2019, mock.fetcher));
});

test("GitHub errors, missing declared blobs and truncated catalogs are NEVER reported as absent coverage", async () => {
  for (const options of [{ rateLimit: true }, { truncated: true }]) {
    const obtained = await obtainOpenFootball(2018, 2018, mockGitHub(options).fetcher);
    assert.equal(obtained.files.length, 0);
    assert.ok(obtained.coverage.some((r) => r.status === "error"));
    assert.ok(!obtained.coverage.some((r) => r.status === "missing"));
  }
  const broken = await obtainOpenFootball(2018, 2018, mockGitHub({ brokenFile: true }).fetcher);
  assert.ok(broken.coverage.some((r) => r.status === "error" && r.path === "2018-19/es.2.json"));
});

test("global preview proposes new references without writes; no batch applies before global confirmation", async () => {
  await rolledBack(async (tx) => {
    const before = await globalSnapshot(tx);
    const plan = await reviewed(tx);
    const preview = await previewGlobalImport(tx, plan);
    assert.ok(preview.references.some((r) => r.kind === "seasons" && r.choice === "new"));
    assert.ok(preview.references.some((r) => r.kind === "clubs" && r.choice === "new"));
    assert.ok(preview.references.some((r) => r.kind === "competitions" && r.choice === "new"));
    assert.equal(await globalSnapshot(tx), before);
    await assert.rejects(() => applyGlobalBatch(tx, plan, false), /Confirma/);
    assert.equal(await globalSnapshot(tx), before);
    const token = signGlobalPlan(plan, "synthetic-key", 1000);
    assert.deepEqual(verifyGlobalPlan(token, "synthetic-key", 2000), plan);
    assert.throws(() => verifyGlobalPlan(token + "tamper", "synthetic-key", 2000));
    assert.throws(() => verifyGlobalPlan(token, "synthetic-key", 1801001));
  });
});

test("a lost response replays its batch receipt, and explicit resume preserves references, matches and provenance", async () => {
  await rolledBack(async (tx) => {
    const plan = await reviewed(tx, acquisition(41));
    const before = await tx.select({ count: count() }).from(matches);
    const first = await applyGlobalBatch(tx, plan, true);
    assert.equal(first.outcome.result.created, 40);
    const after = await globalSnapshot(tx);
    const replay = await applyGlobalBatch(tx, plan, true);
    assert.equal(replay.outcome.replayed, true);
    assert.equal(await globalSnapshot(tx), after);
    const resume = await resumeGlobalImport(tx, plan);
    assert.equal(resume.batchIndex, 1);
    const second = await applyGlobalBatch(tx, resume, true);
    assert.equal(second.outcome.result.created, 1);
    assert.equal((await tx.select({ count: count() }).from(matches))[0].count, before[0].count + 41);
    assert.equal((await globalProgress(tx, second.next)).length, 2);
    const nextCheck = await newGlobalPlan(tx, plan.acquisition, true);
    assert.ok(nextCheck.references.every((r) => r.choice !== "new"));
    const unchanged = await previewGlobalImport(tx, nextCheck);
    assert.ok(unchanged.batches.every((b) => b.rows.every((r) => r.category === "unchanged")));
    await applyGlobalBatch(tx, nextCheck, true);
    assert.equal((await tx.select({ count: count() }).from(matches))[0].count, before[0].count + 41);
  });
});

test("later-batch failure rolls back that batch only; receipts permit a safe explicit retry", async () => {
  await rolledBack(async (tx) => {
    const plan = await reviewed(tx, acquisition(41));
    const { next } = await applyGlobalBatch(tx, plan, true);
    const checkpoint = await globalSnapshot(tx);
    await assert.rejects(() => tx.transaction(async (savepoint) => { await applyGlobalBatch(savepoint, next, true); throw new Error("Synthetic late failure"); }), /Synthetic/);
    assert.equal(await globalSnapshot(tx), checkpoint);
    assert.equal((await globalProgress(tx, next)).length, 1);
    await applyGlobalBatch(tx, next, true);
    assert.equal((await globalProgress(tx, next)).length, 2);
  });
});

test("local edits stop later batches without reverting earlier batches or bypassing protected facts", async () => {
  await rolledBack(async (tx) => {
    const plan = await reviewed(tx, acquisition(41));
    const { next } = await applyGlobalBatch(tx, plan, true);
    const source = (await tx.select().from(matchSources).where(eq(matchSources.path, plan.acquisition.files[0].path)))[0];
    await tx.update(matches).set({ factsLocked: true, factualNotes: "Corrección local" }).where(eq(matches.id, source.matchId));
    await tx.insert(attendance).values({ matchId: source.matchId, slug: `global-${randomUUID()}`, notes: "Recuerdo intacto", isSpecial: true });
    await assert.rejects(() => applyGlobalBatch(tx, next, true), /cambiaron/);
    assert.equal((await globalProgress(tx, next)).length, 1);
    const changed = structuredClone(plan.acquisition);
    changed.files[0].records[0].homeScore = 5;
    const fresh = await newGlobalPlan(tx, changed, true);
    const preview = await previewGlobalImport(tx, fresh);
    const changedRow = preview.batches.flatMap((b) => b.rows).find((r) => r.incoming.homeScore === 5)!;
    assert.equal(changedRow.category, "conflict");
    fresh.targets[changedRow.sourceId] = source.matchId;
    const protectedPreview = await previewGlobalImport(tx, fresh);
    assert.equal(protectedPreview.batches.flatMap((b) => b.rows).find((r) => r.incoming.homeScore === 5)?.category, "protected");
    assert.equal((await tx.select().from(attendance).where(eq(attendance.matchId, source.matchId)))[0].notes, "Recuerdo intacto");
  });
});

test("ambiguous references require a choice; an unresolved later record blocks the entire global approval", async () => {
  await rolledBack(async (tx) => {
    await tx.insert(clubs).values([{ name: "Rival directo sintético", slug: `global-a-${randomUUID()}` }, { name: "Rival directo sintético", slug: `global-b-${randomUUID()}` }]);
    const plan = await newGlobalPlan(tx, acquisition(41), true);
    const preview = await previewGlobalImport(tx, plan);
    assert.equal(preview.applicable, false);
    assert.equal(plan.references.find((r) => r.name === "Rival directo sintético")?.choice, "");
    await assert.rejects(() => applyGlobalBatch(tx, plan, true), /todo el preview/);
  });
});

test("exact source links retain a locally renamed club across future checks without proposing a duplicate reference", async () => {
  await rolledBack(async (tx) => {
    const plan = await reviewed(tx);
    await applyGlobalBatch(tx, plan, true);
    const rival = plan.references.find((r) => r.kind === "clubs" && r.name !== "Elche CF")!;
    await tx.update(clubs).set({ name: "Nombre local corregido" }).where(eq(clubs.id, rival.id));
    const fresh = await newGlobalPlan(tx, plan.acquisition, true);
    assert.equal(fresh.references.find((r) => r.key === rival.key)?.choice, rival.id);
    assert.ok((await previewGlobalImport(tx, fresh)).batches.every((b) => b.rows.every((r) => r.category === "unchanged")));
  });
});

test("one global review handles multiple seasons and reuses shared references without assigning a tier", async () => {
  await rolledBack(async (tx) => {
    const data = acquisition(1);
    data.files.push({ ...structuredClone(data.files[0]), path: `2019-20/synthetic-${randomUUID()}.json`, year: 2019, records: [{ ...data.files[0].records[0], playedOn: "2019-10-10" }] });
    const plan = await reviewed(tx, data);
    const preview = await previewGlobalImport(tx, plan);
    assert.equal(preview.batches.length, 2);
    const first = await applyGlobalBatch(tx, plan, true);
    await applyGlobalBatch(tx, first.next, true);
    const seasonsToCreate = plan.references.filter((r) => r.kind === "seasons" && r.choice === "new");
    assert.equal(seasonsToCreate.length, 2);
    const { seasons, competitions } = await import("../src/db/schema");
    for (const ref of seasonsToCreate) assert.equal((await tx.select().from(seasons).where(eq(seasons.id, ref.id)))[0].elcheTierId, null);
    assert.equal((await tx.select().from(competitions).where(eq(competitions.name, data.files[0].competition))).length, 1);
    assert.equal((await tx.select().from(clubs).where(eq(clubs.name, "Rival directo sintético"))).length, 1);
  });
});

test("new files with coinciding teams/date are manual conflicts across the global preview", async () => {
  await rolledBack(async (tx) => {
    const data = acquisition(1);
    data.files.push({ ...structuredClone(data.files[0]), path: `2018-19/other-${randomUUID()}.json`, competition: "Otra competición sintética" });
    const plan = await newGlobalPlan(tx, data, true);
    const preview = await previewGlobalImport(tx, plan);
    assert.ok(preview.batches.every((b) => b.rows.every((r) => r.category === "conflict" && !r.target)));
    assert.equal(preview.applicable, false);
    await assert.rejects(() => applyGlobalBatch(tx, plan, true), /todo el preview/);
  });
});

test("manual source aliases can share one proposed reference before any database write", async () => {
  await rolledBack(async (tx) => {
    const data = acquisition(1);
    data.files.push({ ...structuredClone(data.files[0]), year: 2019, path: `2019-20/alias-${randomUUID()}.json`, records: [{ ...data.files[0].records[0], away: "Otra grafía del rival sintético", playedOn: "2019-10-10" }] });
    const plan = await newGlobalPlan(tx, data, true);
    const canonical = plan.references.find((r) => r.name === "Rival directo sintético")!;
    const alias = plan.references.find((r) => r.name === "Otra grafía del rival sintético")!;
    alias.choice = canonical.id;
    let preview = await previewGlobalImport(tx, plan);
    for (const b of preview.batches) for (const r of b.rows) if (!r.target) plan.targets[r.sourceId] = "new";
    preview = await previewGlobalImport(tx, plan);
    assert.equal(preview.applicable, true);
    assert.ok(preview.batches.every((b) => b.rows.every((r) => r.incoming.awayClubId === canonical.id)));
    const first = await applyGlobalBatch(tx, plan, true);
    await applyGlobalBatch(tx, first.next, true);
    assert.equal((await tx.select().from(clubs).where(eq(clubs.id, canonical.id))).length, 1);
    assert.equal((await tx.select().from(clubs).where(eq(clubs.id, alias.id))).length, 0);
    const again = await newGlobalPlan(tx, data, true);
    assert.equal(again.references.find((r) => r.key === alias.key)?.choice, canonical.id);
  });
});
