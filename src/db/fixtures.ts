import { eq } from "drizzle-orm";
import { attendance, clubs, competitions, matches, seasons, stadiums, tiers } from "./schema";
import type { WriteDatabase } from "./connection";
import { validateMatch } from "./validation";
import { ELCHE_CLUB_ID } from "../lib/identity";
import { availableSlug } from "../lib/slugs";

// Synthetic seed input only. Public pages NEVER import this module.
const id = (group: number, item: number) => `10000000-0000-4000-8${group}00-${String(item).padStart(12, "0")}`;
export const fixtureIds = {
  north: id(1, 1), south: id(1, 2),
  ground: id(2, 1), otherGround: id(2, 2), unvisitedGround: id(2, 3),
  league: id(3, 1), cup: id(3, 2), tier: id(4, 1), season: id(5, 1),
  awayMatch: id(6, 1), homeMatch: id(6, 2), unknownOpponent: id(6, 3), incompleteMatch: id(6, 4),
  unattendedMatch: id(6, 5), undatedMatch: id(6, 6),
};

export const fixtureMatches: (typeof matches.$inferInsert)[] = [
  { id: fixtureIds.awayMatch, homeClubId: fixtureIds.north, awayClubId: ELCHE_CLUB_ID, homeScore: 1, awayScore: 2, playedOn: "2030-02-01", stadiumId: fixtureIds.ground, competitionId: fixtureIds.league, status: "finished" as const },
  { id: fixtureIds.homeMatch, homeClubId: ELCHE_CLUB_ID, awayClubId: fixtureIds.south, homeScore: 2, awayScore: 2, playedOn: "2030-03-01", stadiumId: fixtureIds.ground, competitionId: fixtureIds.cup, phase: "Final de ejemplo en sede neutral", status: "finished" as const },
  { id: fixtureIds.unknownOpponent, awayClubId: ELCHE_CLUB_ID, playedOn: "2030-01-01", stadiumId: fixtureIds.otherGround },
  { id: fixtureIds.incompleteMatch, factualNotes: "Ficha sintética incompleta: designación y fecha desconocidas." },
  { id: fixtureIds.unattendedMatch, homeClubId: fixtureIds.south, awayClubId: ELCHE_CLUB_ID, homeScore: 3, awayScore: 0, playedOn: "2030-04-01", stadiumId: fixtureIds.unvisitedGround, competitionId: fixtureIds.league, status: "finished" as const, factualNotes: "UNATTENDED_FIXTURE_NOT_PUBLIC" },
  { id: fixtureIds.undatedMatch, homeClubId: fixtureIds.south, awayClubId: ELCHE_CLUB_ID, stadiumId: fixtureIds.otherGround },
].map((match) => ({ ...match, seasonId: fixtureIds.season, factsLocked: true }));

export async function seedSyntheticData(db: WriteDatabase) {
  const clubRows = [
    { id: ELCHE_CLUB_ID, name: "Elche CF", slug: "elche-cf" },
    { id: fixtureIds.north, name: "Club Norte (ejemplo)", slug: "club-norte-ejemplo" },
    { id: fixtureIds.south, name: "Club Sur (ejemplo)", slug: "club-sur-ejemplo" },
  ];
  await db.insert(clubs).values(clubRows).onConflictDoNothing();
  await db.insert(stadiums).values([
    { id: fixtureIds.ground, name: "Estadio del Corcho (ejemplo)", slug: "estadio-del-corcho-ejemplo", city: "Ciudad de ejemplo", provinceCode: "03" },
    { id: fixtureIds.otherGround, name: "Campo del Recuerdo (ejemplo)", slug: "campo-del-recuerdo-ejemplo" },
    { id: fixtureIds.unvisitedGround, name: "Estadio no visitado (ejemplo)", slug: "estadio-no-visitado-ejemplo" },
  ]).onConflictDoNothing();
  await db.insert(competitions).values([
    { id: fixtureIds.league, name: "Liga de ejemplo" }, { id: fixtureIds.cup, name: "Copa de ejemplo" },
  ]).onConflictDoNothing();
  await db.insert(tiers).values({ id: fixtureIds.tier, name: "División de ejemplo", level: 2 }).onConflictDoNothing();
  await db.insert(seasons).values({ id: fixtureIds.season, label: "2030/31 (ejemplo)", startYear: 2030, elcheTierId: fixtureIds.tier }).onConflictDoNothing();
  for (const match of fixtureMatches) {
    validateMatch(match);
    await db.insert(matches).values(match).onConflictDoNothing();
  }
  for (const match of fixtureMatches.filter((row) => row.id !== fixtureIds.unattendedMatch)) {
    const matchId = match.id!;
    const [existing] = await db.select({ matchId: attendance.matchId }).from(attendance).where(eq(attendance.matchId, matchId));
    if (existing) continue; // Never rewrite an existing slug or personal correction.
    const home = clubRows.find((club) => club.id === match.homeClubId)?.name ?? "";
    const away = clubRows.find((club) => club.id === match.awayClubId)?.name ?? "";
    const slug = await availableSlug([match.playedOn, home, away].filter(Boolean).join(" "), async (candidate) => {
      const rows = await db.select({ matchId: attendance.matchId }).from(attendance).where(eq(attendance.slug, candidate));
      return rows.length > 0;
    });
    await db.insert(attendance).values({ matchId, slug, notes: "Recuerdo de ejemplo. Estos datos son sintéticos y no representan un partido real.", isSpecial: matchId === fixtureIds.homeMatch });
  }
}
