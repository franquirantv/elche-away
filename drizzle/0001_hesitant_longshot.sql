CREATE TABLE "match_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_fixture_id" text NOT NULL,
	"repository" text NOT NULL,
	"path" text NOT NULL,
	"fingerprint" text NOT NULL,
	"revisions" text[] NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_sources_identity" UNIQUE("provider","external_fixture_id"),
	CONSTRAINT "match_sources_provider" CHECK ("match_sources"."provider" = 'openfootball'),
	CONSTRAINT "match_sources_hashes" CHECK ("match_sources"."fingerprint" ~ '^[a-f0-9]{64}$' and "match_sources"."external_fixture_id" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "match_sources_provenance" CHECK ("match_sources"."repository" in ('openfootball/football.json', 'openfootball/espana') and length("match_sources"."path") between 1 and 200 and cardinality("match_sources"."revisions") > 0)
);
--> statement-breakpoint
ALTER TABLE "match_sources" ADD CONSTRAINT "match_sources_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_sources_match_idx" ON "match_sources" USING btree ("match_id");