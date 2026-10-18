import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { QueryDatabase } from "./connection";
import { attendance, clubs, competitions, matches, seasons, stadiums, tiers } from "./schema";

const home = alias(clubs, "home_club");
const away = alias(clubs, "away_club");

function attendedFixtures(db: QueryDatabase) {
  return db.select({
    slug: attendance.slug, notes: attendance.notes, isSpecial: attendance.isSpecial,
    playedOn: matches.playedOn, homeName: home.name, awayName: away.name,
    homeClubId: matches.homeClubId, awayClubId: matches.awayClubId,
    homeScore: matches.homeScore, awayScore: matches.awayScore, status: matches.status,
    phase: matches.phase, factualNotes: matches.factualNotes,
    season: seasons.label, competition: competitions.name, tier: tiers.name,
    stadiumId: stadiums.id, stadiumSlug: stadiums.slug, stadiumName: stadiums.name,
    city: stadiums.city, provinceCode: stadiums.provinceCode,
  }).from(attendance)
    .innerJoin(matches, eq(attendance.matchId, matches.id))
    .leftJoin(home, eq(matches.homeClubId, home.id))
    .leftJoin(away, eq(matches.awayClubId, away.id))
    .leftJoin(seasons, eq(matches.seasonId, seasons.id))
    .leftJoin(tiers, eq(seasons.elcheTierId, tiers.id))
    .leftJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(stadiums, eq(matches.stadiumId, stadiums.id));
}

export function listTrips(db: QueryDatabase, stadiumId?: string) {
  return attendedFixtures(db).where(stadiumId ? eq(matches.stadiumId, stadiumId) : undefined)
    .orderBy(sql`${matches.playedOn} desc nulls last`, matches.id);
}

export async function findTrip(db: QueryDatabase, slug: string) {
  const [trip] = await attendedFixtures(db).where(eq(attendance.slug, slug)).limit(1);
  return trip;
}

export function listVisitedStadiums(db: QueryDatabase) {
  return db.select({
    id: stadiums.id, slug: stadiums.slug, name: stadiums.name, city: stadiums.city, provinceCode: stadiums.provinceCode,
    visits: sql<number>`count(*)::integer`,
  }).from(stadiums)
    .innerJoin(matches, eq(matches.stadiumId, stadiums.id))
    .innerJoin(attendance, eq(attendance.matchId, matches.id))
    .groupBy(stadiums.id).orderBy(stadiums.name, stadiums.id);
}

export async function findVisitedStadium(db: QueryDatabase, slug: string) {
  const [stadium] = await db.select({
    id: stadiums.id, slug: stadiums.slug, name: stadiums.name, city: stadiums.city, provinceCode: stadiums.provinceCode,
  }).from(stadiums).innerJoin(matches, eq(matches.stadiumId, stadiums.id))
    .innerJoin(attendance, eq(attendance.matchId, matches.id))
    .where(eq(stadiums.slug, slug)).limit(1);
  return stadium;
}

export type PublicTrip = Awaited<ReturnType<typeof listTrips>>[number];
