CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"batch_index" integer NOT NULL,
	"plan_hash" text NOT NULL,
	"after_snapshot" text NOT NULL,
	"result" jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_plan_index" UNIQUE("plan_id","batch_index"),
	CONSTRAINT "import_batches_index" CHECK ("import_batches"."batch_index" >= 0),
	CONSTRAINT "import_batches_hashes" CHECK ("import_batches"."plan_hash" ~ '^[a-f0-9]{64}$' and "import_batches"."after_snapshot" ~ '^[a-f0-9]{64}$')
);
