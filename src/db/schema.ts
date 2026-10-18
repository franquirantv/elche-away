import { sql } from "drizzle-orm";
import { boolean, check, date, doublePrecision, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { provinces } from "../lib/geography";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});
const slugPattern = "^[a-z0-9]+(-[a-z0-9]+)*$";

export const clubs = pgTable("clubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  crestPath: text("crest_path"),
  ...timestamps(),
}, (t) => [
  check("clubs_name_nonblank", sql`length(trim(${t.name})) > 0`),
  check("clubs_slug_format", sql`${t.slug} ~ ${sql.raw(`'${slugPattern}'`)}`),
  check("clubs_crest_local", sql`${t.crestPath} is null or ${t.crestPath} ~ '^/crests/[a-zA-Z0-9_-]+[.](png|webp|jpg|jpeg|svg)$'`),
]);

export const stadiums = pgTable("stadiums", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  city: text("city"),
  provinceCode: varchar("province_code", { length: 2 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  ...timestamps(),
}, (t) => [
  check("stadiums_name_nonblank", sql`length(trim(${t.name})) > 0`),
  check("stadiums_slug_format", sql`${t.slug} ~ ${sql.raw(`'${slugPattern}'`)}`),
  check("stadiums_city_nonblank", sql`${t.city} is null or length(trim(${t.city})) > 0`),
  check("stadiums_province_code", sql`${t.provinceCode} is null or ${t.provinceCode} in (${sql.raw(Object.keys(provinces).map((code) => `'${code}'`).join(", "))})`),
  check("stadiums_coordinates", sql`(${t.latitude} is null and ${t.longitude} is null) or (${t.latitude} is not null and ${t.longitude} is not null and ${t.latitude} between -90 and 90 and ${t.longitude} between -180 and 180)`),
]);

export const competitions = pgTable("competitions", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), ...timestamps(),
}, (t) => [check("competitions_name_nonblank", sql`length(trim(${t.name})) > 0`)]);

export const tiers = pgTable("tiers", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), level: integer("level").notNull(), ...timestamps(),
}, (t) => [
  check("tiers_name_nonblank", sql`length(trim(${t.name})) > 0`),
  check("tiers_level_positive", sql`${t.level} > 0`),
]);

export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(), label: text("label").notNull().unique(), startYear: integer("start_year").notNull(),
  elcheTierId: uuid("elche_tier_id").references(() => tiers.id, { onDelete: "restrict" }), ...timestamps(),
}, (t) => [check("seasons_label_nonblank", sql`length(trim(${t.label})) > 0`)]);

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  homeClubId: uuid("home_club_id").references(() => clubs.id, { onDelete: "restrict" }),
  awayClubId: uuid("away_club_id").references(() => clubs.id, { onDelete: "restrict" }),
  homeScore: integer("home_score"), awayScore: integer("away_score"),
  playedOn: date("played_on", { mode: "string" }),
  seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "restrict" }),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "restrict" }),
  stadiumId: uuid("stadium_id").references(() => stadiums.id, { onDelete: "restrict" }),
  phase: text("phase"),
  status: text("status", { enum: ["unknown", "scheduled", "postponed", "finished", "cancelled", "abandoned"] }).default("unknown").notNull(),
  factualNotes: text("factual_notes"),
  factsLocked: boolean("facts_locked").default(true).notNull(),
  ...timestamps(),
}, (t) => [
  check("matches_distinct_clubs", sql`${t.homeClubId} is null or ${t.awayClubId} is null or ${t.homeClubId} <> ${t.awayClubId}`),
  check("matches_score_pair", sql`(${t.homeScore} is null and ${t.awayScore} is null) or (${t.homeScore} is not null and ${t.awayScore} is not null and ${t.homeScore} >= 0 and ${t.awayScore} >= 0)`),
  check("matches_score_orientation", sql`${t.homeClubId} is not null or ${t.awayClubId} is not null or (${t.homeScore} is null and ${t.awayScore} is null)`),
  check("matches_status", sql`${t.status} in ('unknown', 'scheduled', 'postponed', 'finished', 'cancelled', 'abandoned')`),
  index("matches_stadium_idx").on(t.stadiumId),
  index("matches_home_club_idx").on(t.homeClubId),
  index("matches_away_club_idx").on(t.awayClubId),
  index("matches_chronology_idx").on(t.playedOn.desc().nullsLast(), t.id),
  index("matches_season_competition_idx").on(t.seasonId, t.competitionId),
]);

export const attendance = pgTable("attendance", {
  matchId: uuid("match_id").primaryKey().references(() => matches.id, { onDelete: "restrict" }),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  notes: text("notes"),
  isSpecial: boolean("is_special").default(false).notNull(),
  ...timestamps(),
}, (t) => [check("attendance_slug_format", sql`${t.slug} ~ ${sql.raw(`'${slugPattern}'`)}`)]);
