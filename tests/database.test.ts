import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { count, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import "../scripts/env";
import { createDatabase, type Database } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { attendance, clubs, competitions, matches, stadiums } from "../src/db/schema";
import { readHomeSummary, findTrip, findVisitedStadium, listTrips, listVisitedStadiums } from "../src/db/queries";
import { fixtureIds, seedSyntheticData } from "../src/db/fixtures";
import { validateMatch } from "../src/db/validation";
import { ELCHE_CLUB_ID } from "../src/lib/identity";
import { availableSlug, slugBase } from "../src/lib/slugs";
import { matchDate, tripScore } from "../src/lib/trips";
import { formatLocation } from "../src/lib/geography";

const { db, pool } = createDatabase(localDatabaseUrl("testing"));
after(() => pool.end());
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function rolledBack(run: (tx: Transaction) => Promise<void>) {
  const rollback = new Error("Test rollback");
  try {
    await db.transaction(async (tx) => { await run(tx); throw rollback; });
  } catch (error) { if (error !== rollback) throw error; }
}

async function rejectsSql(tx: Transaction, code: string, run: (savepoint: Transaction) => Promise<unknown>) {
  await assert.rejects(() => tx.transaction(run), (error: unknown) => {
    const failure = error as { code?: string; cause?: { code?: string } };
    const actual = failure.cause?.code ?? failure.code;
    return actual === code || (code === "23503" && actual === "23001");
  });
}

test("migrations and synthetic seeding can be repeated without replacing existing records", async () => {
  const before = await db.select({ total: count() }).from(matches);
  await migrate(db, { migrationsFolder: "./drizzle" });
  assert.deepEqual(await db.select({ total: count() }).from(matches), before);
  await rolledBack(async (tx) => {
    await tx.update(attendance).set({ notes: "Owner correction survives seed" }).where(eq(attendance.matchId, fixtureIds.homeMatch));
    await seedSyntheticData(tx);
    await seedSyntheticData(tx);
    assert.deepEqual(await tx.select({ total: count() }).from(matches), before);
    const [personal] = await tx.select().from(attendance).where(eq(attendance.matchId, fixtureIds.homeMatch));
    assert.equal(personal.notes, "Owner correction survives seed");
  });
});

test("public queries exclude unvisited venues and unattended fixtures, and keep repeated venues", async () => {
  const trips = await listTrips(db);
  assert.equal(trips.length, 5);
  assert.equal(trips.filter((trip) => trip.stadiumId === fixtureIds.ground).length, 2);
  assert.equal(trips.filter((trip) => trip.stadiumId === null).length, 1);
  assert.ok(trips.every((trip) => trip.factualNotes !== "UNATTENDED_FIXTURE_NOT_PUBLIC"));
  const stadiumRows = await listVisitedStadiums(db);
  assert.equal(stadiumRows.length, 2);
  assert.equal(stadiumRows.find((stadium) => stadium.id === fixtureIds.ground)?.visits, 2);
  assert.equal(await findVisitedStadium(db, "estadio-no-visitado-ejemplo"), undefined);
  assert.equal(await findTrip(db, fixtureIds.unattendedMatch), undefined);
  assert.equal(await findTrip(db, "' OR 1=1 --"), undefined);
});

test("cup competition is independent of season tier; date chronology places nulls last", async () => {
  const trips = await listTrips(db);
  assert.equal(trips[0].competition, "Copa de ejemplo");
  assert.equal(trips[0].tier, "División de ejemplo");
  assert.equal(trips[0].isSpecial, true);
  assert.deepEqual(trips.slice(0, 3).map((trip) => trip.playedOn), ["2030-03-01", "2030-02-01", "2030-01-01"]);
  assert.ok(trips.slice(3).every((trip) => trip.playedOn === null));
  assert.deepEqual((await listTrips(db)).map((trip) => trip.slug), trips.map((trip) => trip.slug));
});

test("PostgreSQL rejects invalid scores, duplicated sides, invalid geography, bad slugs and reference deletion", async () => {
  await rolledBack(async (tx) => {
    for (const input of [
      { awayClubId: ELCHE_CLUB_ID, homeScore: 1 },
      { awayClubId: ELCHE_CLUB_ID, homeScore: -1, awayScore: 0 },
      { homeClubId: ELCHE_CLUB_ID, awayClubId: ELCHE_CLUB_ID },
      { homeScore: 1, awayScore: 0 },
    ]) await rejectsSql(tx, "23514", (savepoint) => savepoint.insert(matches).values(input));
    await rejectsSql(tx, "23514", (s) => s.insert(matches).values({ status: "not-a-status" as "unknown" }));
    for (const input of [{ latitude: 12 }, { latitude: 91, longitude: 12 }, { provinceCode: "99" }]) {
      await rejectsSql(tx, "23514", (s) => s.insert(stadiums).values({ name: "Example", slug: "example-ground", ...input }));
    }
    await rejectsSql(tx, "23514", (s) => s.insert(clubs).values({ name: " ", slug: "blank" }));
    await rejectsSql(tx, "23514", (s) => s.insert(clubs).values({ name: "Example", slug: "NOT A SLUG" }));
    await rejectsSql(tx, "23514", (s) => s.insert(clubs).values({ name: "Example", slug: "crest", crestPath: "https://untrusted.example/crest.svg" }));
    await rejectsSql(tx, "23505", (s) => s.insert(attendance).values({ matchId: fixtureIds.homeMatch, slug: "duplicate-attendance" }));
    await rejectsSql(tx, "23503", (s) => s.delete(stadiums).where(eq(stadiums.id, fixtureIds.ground)));
    await rejectsSql(tx, "23503", (s) => s.delete(clubs).where(eq(clubs.id, ELCHE_CLUB_ID)));
    await rejectsSql(tx, "23503", (s) => s.delete(matches).where(eq(matches.id, fixtureIds.homeMatch)));
    await rejectsSql(tx, "23503", (s) => s.delete(competitions).where(eq(competitions.id, fixtureIds.cup)));
  });
});

test("server write validation requires Elche once, while incomplete fixtures remain valid", () => {
  assert.throws(() => validateMatch({ homeClubId: fixtureIds.north, awayClubId: fixtureIds.south }));
  assert.throws(() => validateMatch({ homeClubId: ELCHE_CLUB_ID, awayClubId: ELCHE_CLUB_ID }));
  assert.throws(() => validateMatch({ homeScore: 1, awayScore: 0 }));
  assert.doesNotThrow(() => validateMatch({}));
  assert.doesNotThrow(() => validateMatch({ awayClubId: ELCHE_CLUB_ID }));
  assert.doesNotThrow(() => validateMatch({ homeClubId: ELCHE_CLUB_ID, homeScore: 1, awayScore: 0 }));
});

test("slugs resolve collisions, stay bounded and survive fixture/name corrections", async () => {
  await rolledBack(async (tx) => {
    const label = "Club Norte (ejemplo)";
    const slug = await availableSlug(label, async (candidate) => (await tx.select().from(clubs).where(eq(clubs.slug, candidate))).length > 0);
    assert.equal(slug, "club-norte-ejemplo-2");
    await tx.insert(clubs).values({ id: randomUUID(), name: label, slug });
    await rejectsSql(tx, "23505", (s) => s.insert(clubs).values({ name: "Another club", slug }));
    let collision = true;
    assert.ok((await availableSlug("á".repeat(200), async () => { const exists = collision; collision = false; return exists; })).length <= 160);
    assert.equal(slugBase("Árbol / Estadio"), "arbol-estadio");
    const [prior] = await tx.select().from(attendance).where(eq(attendance.matchId, fixtureIds.homeMatch));
    await tx.update(matches).set({ playedOn: "2030-03-02", factsLocked: true }).where(eq(matches.id, fixtureIds.homeMatch));
    await tx.update(clubs).set({ name: "Renamed synthetic opponent" }).where(eq(clubs.id, fixtureIds.south));
    const corrected = await findTrip(tx, prior.slug);
    assert.equal(corrected?.slug, prior.slug);
    assert.equal(corrected?.awayName, "Renamed synthetic opponent");
  });
});

test("unmarking attendance hides the trip while preserving the fixture", async () => {
  await rolledBack(async (tx) => {
    const [prior] = await tx.select().from(attendance).where(eq(attendance.matchId, fixtureIds.homeMatch));
    await tx.delete(attendance).where(eq(attendance.matchId, fixtureIds.homeMatch));
    assert.equal(await findTrip(tx, prior.slug), undefined);
    const [fixture] = await tx.select().from(matches).where(eq(matches.id, fixtureIds.homeMatch));
    assert.ok(fixture);
  });
});

test("unknown/unfinished scores and dates are displayed honestly, including islands and autonomous cities", () => {
  assert.equal(tripScore({ status: "finished", homeScore: null, awayScore: null }), "Resultado desconocido");
  assert.equal(tripScore({ status: "scheduled", homeScore: 0, awayScore: 0 }), "Resultado desconocido");
  assert.equal(tripScore({ status: "finished", homeScore: 0, awayScore: 0 }), "0 – 0");
  assert.equal(matchDate(null), "Fecha desconocida");
  assert.equal(matchDate("2030-01-01"), "1 de enero de 2030");
  assert.equal(formatLocation(null, null), "Ubicación desconocida");
  assert.match(formatLocation(null, "35"), /Canarias/);
  assert.match(formatLocation(null, "51"), /Ceuta/);
  assert.match(formatLocation(null, "52"), /Melilla/);
});


test("local database commands reject production mode and shared development/testing targets", () => {
  const environment: Record<string, string | undefined> = process.env;
  const mode = environment.NODE_ENV;
  const originalTest = environment.TEST_DATABASE_URL;
  try {
    environment.NODE_ENV = "production";
    assert.throws(() => localDatabaseUrl("testing"), /cannot run in production/);
    environment.NODE_ENV = mode;
    if (mode === undefined) delete environment.NODE_ENV;
    environment.TEST_DATABASE_URL = environment.DATABASE_URL_UNPOOLED;
    assert.throws(() => localDatabaseUrl("testing"), /separate database/);
  } finally {
    if (mode === undefined) delete environment.NODE_ENV; else environment.NODE_ENV = mode;
    if (originalTest === undefined) delete environment.TEST_DATABASE_URL; else environment.TEST_DATABASE_URL = originalTest;
  }
});

// Reference management operates on the existing schema; no auth tables are
// managed by Drizzle. All data below is synthetic and rolled back.
test("reference management preserves slugs, validates fields and protects referenced rows", async () => {
  const { writeReference, readReferences } = await import("../src/db/references");
  const { readReferenceInput } = await import("../src/server/reference-input");
  function input(kind: string, values: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ kind, intent: "save", ...values })) form.set(key, value);
    return readReferenceInput(form);
  }
  await rolledBack(async (tx) => {
    await writeReference(tx, "clubs", input("clubs", { name: "Club Ámbito Sintético" }));
    await writeReference(tx, "clubs", input("clubs", { name: "Club Ámbito Sintético" }));
    const created = (await readReferences(tx)).clubs.filter((club) => club.name === "Club Ámbito Sintético");
    assert.deepEqual(created.map((club) => club.slug).sort(), ["club-ambito-sintetico", "club-ambito-sintetico-2"]);
    await writeReference(tx, "clubs", input("clubs", { id: created[0].id, name: "Club Corregido" }));
    assert.equal((await readReferences(tx)).clubs.find((club) => club.id === created[0].id)?.slug, created[0].slug);
    await assert.rejects(() => writeReference(tx, "clubs", input("clubs", { name: "Example", crestPath: "https://untrusted.invalid/crest.svg" })));
    await assert.rejects(() => writeReference(tx, "clubs", input("clubs", { id: ELCHE_CLUB_ID, intent: "delete", confirmDelete: "yes" })));
    await assert.rejects(() => writeReference(tx, "clubs", input("clubs", { id: created[0].id, intent: "delete" })));
    await rejectsSql(tx, "23503", (s) => writeReference(s, "stadiums", input("stadiums", { id: fixtureIds.ground, intent: "delete", confirmDelete: "yes" })));
    await rejectsSql(tx, "23503", (s) => writeReference(s, "tiers", input("tiers", { id: fixtureIds.tier, intent: "delete", confirmDelete: "yes" })));
    await writeReference(tx, "clubs", input("clubs", { id: created[0].id, intent: "delete", confirmDelete: "yes" }));
    assert.equal((await readReferences(tx)).clubs.some((club) => club.id === created[0].id), false);
    await writeReference(tx, "stadiums", input("stadiums", { id: fixtureIds.otherGround, name: "Campo del Recuerdo (ejemplo)", city: " ", latitude: "", longitude: "" }));
    const ground = (await readReferences(tx)).stadiums.find((row) => row.id === fixtureIds.otherGround)!;
    assert.equal(ground.city, null);
    assert.equal(ground.latitude, null);
    assert.equal(ground.slug, "campo-del-recuerdo-ejemplo");
    await assert.rejects(() => writeReference(tx, "stadiums", input("stadiums", { name: "Bad coordinates", latitude: "90" })));
    await assert.rejects(() => writeReference(tx, "stadiums", input("stadiums", { name: "Bad province", provinceCode: "99" })));
    await writeReference(tx, "seasons", input("seasons", { id: fixtureIds.season, label: "2030/31 (ejemplo)", startYear: "2030", elcheTierId: "" }));
    assert.equal((await listTrips(tx)).find((trip) => trip.competition === "Copa de ejemplo")?.tier, null);
    await writeReference(tx, "seasons", input("seasons", { id: fixtureIds.season, label: "2030/31 (ejemplo)", startYear: "2030", elcheTierId: fixtureIds.tier }));
    assert.equal((await listTrips(tx)).find((trip) => trip.competition === "Copa de ejemplo")?.tier, "División de ejemplo");
  });
});

test("fixture management filters locally, locks corrections and isolates attendance with stable links", async () => {
  const { writeFixture, readAdminFixtures } = await import("../src/db/admin-fixtures");
  const { readFixtureInput } = await import("../src/server/fixture-input");
  const input = (values: Record<string, string>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ intent: "save", status: "unknown", ...values })) form.set(key, value);
    return readFixtureInput(form);
  };
  await rolledBack(async (tx) => {
    const marker = `Synthetic fixture ${randomUUID()}`;
    const facts = { homeClubId: fixtureIds.north, awayClubId: ELCHE_CLUB_ID, stadiumId: fixtureIds.ground, seasonId: fixtureIds.season, competitionId: fixtureIds.cup, factualNotes: marker };
    await writeFixture(tx, input(facts));
    const [created] = await tx.select().from(matches).where(eq(matches.factualNotes, marker));
    assert.equal(created.playedOn, null);
    assert.equal(created.homeScore, null);
    assert.equal(created.factsLocked, true);
    assert.ok((await readAdminFixtures(tx, { seasonId: fixtureIds.season, competitionId: fixtureIds.cup })).some((row) => row.fixture.id === created.id));
    await assert.rejects(() => writeFixture(tx, input(facts)), /Revisa/);
    await writeFixture(tx, input({ ...facts, confirmDuplicate: "yes" }));
    await writeFixture(tx, input({ id: created.id, intent: "attend", notes: "Recuerdo sintético", isSpecial: "yes" }));
    const [personal] = await tx.select().from(attendance).where(eq(attendance.matchId, created.id));
    assert.equal((await findTrip(tx, personal.slug))?.notes, "Recuerdo sintético");
    await writeFixture(tx, input({ ...facts, id: created.id, playedOn: "2035-02-03", homeScore: "0", awayScore: "0", status: "scheduled" }));
    const corrected = await findTrip(tx, personal.slug);
    assert.equal(corrected?.slug, personal.slug);
    assert.equal(corrected?.isSpecial, true);
    assert.equal(tripScore(corrected!), "Resultado desconocido");
    await writeFixture(tx, input({ id: created.id, intent: "attend", notes: "Recuerdo editado" }));
    assert.equal((await findTrip(tx, personal.slug))?.slug, personal.slug);
    await assert.rejects(() => writeFixture(tx, input({ id: created.id, intent: "delete", confirmDelete: "yes" })));
    await assert.rejects(() => writeFixture(tx, input({ id: created.id, intent: "unattend" })));
    await writeFixture(tx, input({ id: created.id, intent: "unattend", confirmDelete: "yes" }));
    assert.equal(await findTrip(tx, personal.slug), undefined);
    assert.ok((await readAdminFixtures(tx)).some((row) => row.fixture.id === created.id && !row.personal));
    await writeFixture(tx, input({ id: created.id, intent: "delete", confirmDelete: "yes" }));
    assert.ok(!(await readAdminFixtures(tx)).some((row) => row.fixture.id === created.id));
    const invalidInputs: Record<string, string>[] = [{ playedOn: "2030-02-30" }, { status: "__proto__" }, { homeScore: "1" }, { homeClubId: fixtureIds.south, awayClubId: fixtureIds.north }];
    for (const bad of invalidInputs) {
      await assert.rejects(() => writeFixture(tx, input(bad)));
    }
    await writeFixture(tx, input({ factualNotes: "Unknown synthetic designation", confirmDuplicate: "yes" }));
  });
});

test("home summary derives totals, coverage and oriented finished results only from attendance", async () => {
  await rolledBack(async (tx) => {
    assert.deepEqual(await readHomeSummary(tx), { trips: 5, stadiums: 2, knownVenues: 4, knownResults: 2, wins: 1, draws: 1, losses: 0 });
    for (const status of ["unknown", "scheduled", "postponed", "cancelled", "abandoned"] as const) {
      await tx.update(matches).set({ status, homeScore: 0, awayScore: 0 }).where(eq(matches.id, fixtureIds.homeMatch));
      assert.equal((await readHomeSummary(tx)).knownResults, 1);
    }
    await tx.update(matches).set({ status: "finished", homeScore: null, awayScore: null }).where(eq(matches.id, fixtureIds.homeMatch));
    assert.equal((await readHomeSummary(tx)).knownResults, 1);
    for (const homeClubId of [ELCHE_CLUB_ID, fixtureIds.south]) {
      const awayClubId = homeClubId === ELCHE_CLUB_ID ? fixtureIds.south : ELCHE_CLUB_ID;
      for (const [homeScore, awayScore, wins, draws, losses] of [
        [2, 0, homeClubId === ELCHE_CLUB_ID ? 2 : 1, 0, homeClubId === ELCHE_CLUB_ID ? 0 : 1],
        [0, 2, homeClubId === ELCHE_CLUB_ID ? 1 : 2, 0, homeClubId === ELCHE_CLUB_ID ? 1 : 0],
        [0, 0, 1, 1, 0],
      ]) {
        await tx.update(matches).set({ homeClubId, awayClubId, homeScore, awayScore, factualNotes: "Decidido en tanda de penaltis" }).where(eq(matches.id, fixtureIds.homeMatch));
        const summary = await readHomeSummary(tx);
        assert.deepEqual([summary.wins, summary.draws, summary.losses], [wins, draws, losses]);
      }
    }
    await tx.delete(attendance).where(eq(attendance.matchId, fixtureIds.homeMatch));
    assert.deepEqual(await readHomeSummary(tx), { trips: 4, stadiums: 2, knownVenues: 3, knownResults: 1, wins: 1, draws: 0, losses: 0 });
    await tx.delete(attendance);
    assert.deepEqual(await readHomeSummary(tx), { trips: 0, stadiums: 0, knownVenues: 0, knownResults: 0, wins: 0, draws: 0, losses: 0 });
  });
});


test("map data follows attendance, deduplicates visits and preserves unknown coordinates", async () => {
  await rolledBack(async (tx) => {
    await tx.update(stadiums).set({ latitude: 28.46, longitude: -16.25 }).where(eq(stadiums.id, fixtureIds.ground));
    await tx.update(stadiums).set({ latitude: 39, longitude: 2 }).where(eq(stadiums.id, fixtureIds.unvisitedGround));
    const rows = await listVisitedStadiums(tx);
    assert.equal(rows.length, 2);
    const ground = rows.find((row) => row.id === fixtureIds.ground)!;
    assert.equal(ground.latitude, 28.46);
    assert.equal(ground.longitude, -16.25);
    assert.equal(ground.visits, 2);
    assert.equal(ground.isSpecial, true);
    assert.equal(rows.find((row) => row.id === fixtureIds.otherGround)?.latitude, null);
    assert.ok(rows.every((row) => row.id !== fixtureIds.unvisitedGround));
    await tx.delete(attendance).where(eq(attendance.matchId, fixtureIds.homeMatch));
    assert.equal((await listVisitedStadiums(tx)).find((row) => row.id === fixtureIds.ground)?.isSpecial, false);
  });
});


test("map crest represents a unanimous known attended opponent, never a stadium club", async () => {
  await rolledBack(async (tx) => {
    // Same file path must not disguise two different opponents as one club.
    await tx.update(clubs).set({ crestPath: "/crests/synthetic-test.svg" }).where(eq(clubs.id, fixtureIds.north));
    await tx.update(clubs).set({ crestPath: "/crests/synthetic-test.svg" }).where(eq(clubs.id, fixtureIds.south));
    const ground = async () => (await listVisitedStadiums(tx)).find((row) => row.id === fixtureIds.ground)!;
    assert.equal((await ground()).markerCrestPath, null);
    assert.equal((await ground()).markerClubName, null);
    // Elche is home in one visit, away in the other: derive the rival in both.
    await tx.update(matches).set({ awayClubId: fixtureIds.north }).where(eq(matches.id, fixtureIds.homeMatch));
    assert.equal((await ground()).markerCrestPath, "/crests/synthetic-test.svg");
    assert.equal((await ground()).markerClubName, "Club Norte (ejemplo)");
    assert.equal((await ground()).visits, 2);
    // A single unknown rival invalidates consensus even with one known rival.
    await tx.update(matches).set({ awayClubId: null }).where(eq(matches.id, fixtureIds.homeMatch));
    assert.equal((await ground()).markerCrestPath, null);
    await tx.update(matches).set({ homeClubId: null, awayClubId: null, homeScore: null, awayScore: null }).where(eq(matches.id, fixtureIds.homeMatch));
    assert.equal((await ground()).markerCrestPath, null);
    // Removing that attendance restores consensus; the fixture is still there.
    await tx.delete(attendance).where(eq(attendance.matchId, fixtureIds.homeMatch));
    assert.equal((await ground()).markerCrestPath, "/crests/synthetic-test.svg");
    await tx.update(clubs).set({ crestPath: null }).where(eq(clubs.id, fixtureIds.north));
    assert.equal((await ground()).markerCrestPath, null);
    assert.equal((await ground()).visits, 1);
  });
});
