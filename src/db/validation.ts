import { ELCHE_CLUB_ID } from "../lib/identity";
import type { matches } from "./schema";

export function validateMatch(input: typeof matches.$inferInsert) {
  const home = input.homeClubId ?? null;
  const away = input.awayClubId ?? null;
  const homeScore = input.homeScore ?? null;
  const awayScore = input.awayScore ?? null;
  if (home !== null || away !== null) {
    if ((home === ELCHE_CLUB_ID) === (away === ELCHE_CLUB_ID) || (home !== null && home === away)) {
      throw new Error("A known fixture must contain Elche exactly once.");
    }
  } else if (homeScore !== null || awayScore !== null) {
    throw new Error("Unknown designation cannot have oriented scores.");
  }
  if ((homeScore === null) !== (awayScore === null) || [homeScore, awayScore].some((score) => score !== null && (!Number.isInteger(score) || score < 0))) {
    throw new Error("Scores must both be unknown or nonnegative integers.");
  }
}
