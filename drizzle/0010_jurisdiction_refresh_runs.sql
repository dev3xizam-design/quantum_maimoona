CREATE TABLE "jurisdiction_refresh_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"status" text NOT NULL,
	"source" text,
	"source_urls" jsonb,
	"rows_received" integer DEFAULT 0 NOT NULL,
	"rows_before" integer DEFAULT 0 NOT NULL,
	"codes_added" integer DEFAULT 0 NOT NULL,
	"codes_closed" integer DEFAULT 0 NOT NULL,
	"message" text,
	"changes" jsonb,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "jrr_state_idx" ON "jurisdiction_refresh_runs" USING btree ("state","created_at");