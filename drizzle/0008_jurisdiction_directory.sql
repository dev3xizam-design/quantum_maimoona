CREATE TABLE "jurisdiction_directory" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"state" text NOT NULL,
	"jurisdiction_name" text NOT NULL,
	"jurisdiction_type" text NOT NULL,
	"official_code" text NOT NULL,
	"code_system" text NOT NULL,
	"county_name" text,
	"paired_code" text,
	"paired_name" text,
	"local_rate" numeric(12, 8),
	"combined_rate" numeric(12, 8),
	"rate_includes_state" boolean DEFAULT false NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"source_url" text,
	"notes" text
);
--> statement-breakpoint
CREATE INDEX "jd_state_cat_idx" ON "jurisdiction_directory" USING btree ("state","category","jurisdiction_type");--> statement-breakpoint
CREATE INDEX "jd_code_idx" ON "jurisdiction_directory" USING btree ("official_code");