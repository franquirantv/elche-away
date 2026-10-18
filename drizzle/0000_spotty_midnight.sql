CREATE TABLE "attendance" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"notes" text,
	"is_special" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_slug_unique" UNIQUE("slug"),
	CONSTRAINT "attendance_slug_format" CHECK ("attendance"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"crest_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug"),
	CONSTRAINT "clubs_name_nonblank" CHECK (length(trim("clubs"."name")) > 0),
	CONSTRAINT "clubs_slug_format" CHECK ("clubs"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "clubs_crest_local" CHECK ("clubs"."crest_path" is null or "clubs"."crest_path" ~ '^/crests/[a-zA-Z0-9_-]+[.](png|webp|jpg|jpeg|svg)$')
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_name_nonblank" CHECK (length(trim("competitions"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_club_id" uuid,
	"away_club_id" uuid,
	"home_score" integer,
	"away_score" integer,
	"played_on" date,
	"season_id" uuid,
	"competition_id" uuid,
	"stadium_id" uuid,
	"phase" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"factual_notes" text,
	"facts_locked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_distinct_clubs" CHECK ("matches"."home_club_id" is null or "matches"."away_club_id" is null or "matches"."home_club_id" <> "matches"."away_club_id"),
	CONSTRAINT "matches_score_pair" CHECK (("matches"."home_score" is null and "matches"."away_score" is null) or ("matches"."home_score" is not null and "matches"."away_score" is not null and "matches"."home_score" >= 0 and "matches"."away_score" >= 0)),
	CONSTRAINT "matches_score_orientation" CHECK ("matches"."home_club_id" is not null or "matches"."away_club_id" is not null or ("matches"."home_score" is null and "matches"."away_score" is null)),
	CONSTRAINT "matches_status" CHECK ("matches"."status" in ('unknown', 'scheduled', 'postponed', 'finished', 'cancelled', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"start_year" integer NOT NULL,
	"elche_tier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_label_unique" UNIQUE("label"),
	CONSTRAINT "seasons_label_nonblank" CHECK (length(trim("seasons"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "stadiums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"city" text,
	"province_code" varchar(2),
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stadiums_slug_unique" UNIQUE("slug"),
	CONSTRAINT "stadiums_name_nonblank" CHECK (length(trim("stadiums"."name")) > 0),
	CONSTRAINT "stadiums_slug_format" CHECK ("stadiums"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "stadiums_city_nonblank" CHECK ("stadiums"."city" is null or length(trim("stadiums"."city")) > 0),
	CONSTRAINT "stadiums_province_code" CHECK ("stadiums"."province_code" is null or "stadiums"."province_code" in ('10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '01', '02', '03', '04', '05', '06', '07', '08', '09')),
	CONSTRAINT "stadiums_coordinates" CHECK (("stadiums"."latitude" is null and "stadiums"."longitude" is null) or ("stadiums"."latitude" is not null and "stadiums"."longitude" is not null and "stadiums"."latitude" between -90 and 90 and "stadiums"."longitude" between -180 and 180))
);
--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"level" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tiers_name_nonblank" CHECK (length(trim("tiers"."name")) > 0),
	CONSTRAINT "tiers_level_positive" CHECK ("tiers"."level" > 0)
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_club_id_clubs_id_fk" FOREIGN KEY ("home_club_id") REFERENCES "public"."clubs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_club_id_clubs_id_fk" FOREIGN KEY ("away_club_id") REFERENCES "public"."clubs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_stadiums_id_fk" FOREIGN KEY ("stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_elche_tier_id_tiers_id_fk" FOREIGN KEY ("elche_tier_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_stadium_idx" ON "matches" USING btree ("stadium_id");--> statement-breakpoint
CREATE INDEX "matches_home_club_idx" ON "matches" USING btree ("home_club_id");--> statement-breakpoint
CREATE INDEX "matches_away_club_idx" ON "matches" USING btree ("away_club_id");--> statement-breakpoint
CREATE INDEX "matches_chronology_idx" ON "matches" USING btree ("played_on" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "matches_season_competition_idx" ON "matches" USING btree ("season_id","competition_id");