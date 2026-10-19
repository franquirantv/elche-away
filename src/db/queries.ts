import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { QueryDatabase } from "./connection";
import { attendance, clubs, competitions, matches, seasons, stadiums, tiers } from "./schema";

import { ELCHE_CLUB_ID } from "../lib/identity";

const home = alias(clubs, "home_club");
const away = alias(clubs, "away_club");
const opponent = alias(clubs, "visited_opponent");

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
  // Representation of attended opponents only, never stadium ownership.
  const unanimousOpponent = sql`count(distinct ${opponent.id}) = 1 and count(${opponent.id}) = count(*)`;
  return db.select({
    id: stadiums.id, slug: stadiums.slug, name: stadiums.name, city: stadiums.city, provinceCode: stadiums.provinceCode,
    latitude: stadiums.latitude, longitude: stadiums.longitude,
    isSpecial: sql<boolean>`bool_or(${attendance.isSpecial})`,
    markerCrestPath: sql<string | null>`case when ${unanimousOpponent} then min(${opponent.crestPath}) end`,
    markerClubName: sql<string | null>`case when ${unanimousOpponent} then min(${opponent.name}) end`,
    visits: sql<number>`count(*)::integer`,
  }).from(stadiums)
    .innerJoin(matches, eq(matches.stadiumId, stadiums.id))
    .innerJoin(attendance, eq(attendance.matchId, matches.id))
    .leftJoin(opponent, eq(opponent.id, sql`case when ${matches.homeClubId} = ${ELCHE_CLUB_ID} then ${matches.awayClubId} when ${matches.awayClubId} = ${ELCHE_CLUB_ID} then ${matches.homeClubId} end`))
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

// Aggregate only attended local fixtures; unknowns never become results or venues.
export async function readHomeSummary(db: QueryDatabase) {
  const elcheScore = sql`case when ${matches.homeClubId} = ${ELCHE_CLUB_ID} then ${matches.homeScore} when ${matches.awayClubId} = ${ELCHE_CLUB_ID} then ${matches.awayScore} end`;
  const opponentScore = sql`case when ${matches.homeClubId} = ${ELCHE_CLUB_ID} then ${matches.awayScore} when ${matches.awayClubId} = ${ELCHE_CLUB_ID} then ${matches.homeScore} end`;
  const completed = sql`${matches.status} = 'finished' and ${elcheScore} is not null and ${opponentScore} is not null`;
  const [summary] = await db.select({
    trips: sql<number>`count(*)::integer`,
    stadiums: sql<number>`count(distinct ${matches.stadiumId})::integer`,
    knownVenues: sql<number>`count(${matches.stadiumId})::integer`,
    knownResults: sql<number>`count(*) filter (where ${completed})::integer`,
    wins: sql<number>`count(*) filter (where ${completed} and ${elcheScore} > ${opponentScore})::integer`,
    draws: sql<number>`count(*) filter (where ${completed} and ${elcheScore} = ${opponentScore})::integer`,
    losses: sql<number>`count(*) filter (where ${completed} and ${elcheScore} < ${opponentScore})::integer`,
  }).from(attendance).innerJoin(matches, eq(attendance.matchId, matches.id));
  return summary;
}
