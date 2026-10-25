import assert from "node:assert/strict";
import { test, after } from "node:test";
import "../scripts/env";
import { PAGE_SIZE, pageNumber, pageOffset } from "../src/lib/pagination";
import { createDatabase } from "../src/db/connection";
import { localDatabaseUrl } from "../src/db/environment";
import { matches, clubs, attendance } from "../src/db/schema";
import { readAdminFixtures } from "../src/db/admin-fixtures";
import { readReferences } from "../src/db/references";
import { fixtureIds } from "../src/db/fixtures";
import { listTrips, listVisitedStadiums } from "../src/db/queries";

const { db, pool } = createDatabase(localDatabaseUrl("testing"));
after(() => pool.end());

test("pagination rejects unbounded offsets and normalizes invalid URL values", () => {
  for (const value of [undefined, [], "-1", "0", "1.5", "1000000", "1e4", "01"]) assert.equal(pageNumber(value), 1);
  assert.equal(pageNumber("12"), 12);
  assert.equal(pageOffset(2), PAGE_SIZE);
  for (const value of [0, -1, NaN, Infinity, 1.5, 1000000]) assert.throws(() => pageOffset(value));
});

test("SQL windows preserve filters, deterministic chronology, references and attendance boundaries", async () => {
  const rollback = new Error("rollback");
  try {
    await db.transaction(async (tx) => {
      const [club] = await tx.insert(clubs).values({ name: "Pagination club", slug: "pagination-club" }).returning();
      const fixtures = await tx.insert(matches).values(Array.from({ length: PAGE_SIZE * 2 + 3 }, (_, index) => ({ playedOn: index < PAGE_SIZE ? "2090-01-01" : null, factualNotes: `pagination-${index}`, awayClubId: club.id }))).returning();
      await tx.insert(attendance).values(fixtures.slice(0, PAGE_SIZE + 2).map((fixture, index) => ({ matchId: fixture.id, slug: `pagination-${index}` })));
      const filtered = await readAdminFixtures(tx, { seasonId: fixtureIds.season, competitionId: fixtureIds.league, page: 1 });
      assert.ok(filtered.length > 0);
      assert.ok(filtered.every((row) => row.fixture.seasonId === fixtureIds.season && row.fixture.competitionId === fixtureIds.league));
      const first = await readAdminFixtures(tx, { page: 1 });
      const second = await readAdminFixtures(tx, { page: 2 });
      assert.equal(first.length, PAGE_SIZE + 1);
      assert.equal(second.length, PAGE_SIZE + 1);
      assert.equal(first[PAGE_SIZE].fixture.id, second[0].fixture.id);
      assert.equal(new Set([...first.slice(0, PAGE_SIZE), ...second.slice(0, PAGE_SIZE)].map((row) => row.fixture.id)).size, PAGE_SIZE * 2);
      const trips = await listTrips(tx, undefined, { limit: PAGE_SIZE + 1, offset: 0 });
      const next = await listTrips(tx, undefined, { limit: PAGE_SIZE + 1, offset: PAGE_SIZE });
      assert.equal(trips[PAGE_SIZE].slug, next[0].slug);
      const ground = (await listVisitedStadiums(tx))[0];
      assert.ok((await listTrips(tx, ground.id, { limit: 2, offset: 0 })).every((trip) => trip.stadiumId === ground.id));
      await tx.insert(clubs).values(Array.from({ length: PAGE_SIZE + 2 }, (_, index) => ({ name: `Z Pagination ${index}`, slug: `pagination-ref-${index}` })));
      const references = await readReferences(tx, { kind: "clubs", page: 1 });
      const referenceNext = await readReferences(tx, { kind: "clubs", page: 2 });
      assert.equal(references.clubs.length, PAGE_SIZE + 1);
      assert.equal(references.clubs[PAGE_SIZE].id, referenceNext.clubs[0].id);
      assert.deepEqual(references.stadiums, []);
      assert.ok((await readReferences(tx, { kind: "seasons", page: 1 })).tiers.length > 0);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
});
