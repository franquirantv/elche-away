CREATE TABLE "storage_cleanup" (
	"object_key" text PRIMARY KEY NOT NULL,
	"not_before" timestamp with time zone NOT NULL,
	CONSTRAINT "storage_cleanup_crest_key" CHECK ("storage_cleanup"."object_key" ~ '^crests/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.]webp$')
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "crest_object_key" text;--> statement-breakpoint
CREATE INDEX "storage_cleanup_due_idx" ON "storage_cleanup" USING btree ("not_before");--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_crest_object_key_unique" UNIQUE("crest_object_key");--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_crest_object_key" CHECK ("clubs"."crest_object_key" is null or "clubs"."crest_object_key" ~ ('^crests/' || "clubs"."id"::text || '/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.]webp$'));