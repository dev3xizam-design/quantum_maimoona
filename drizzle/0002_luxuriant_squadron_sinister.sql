CREATE TABLE "monthly_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"totals" jsonb,
	"states" jsonb,
	"states_with_activity" integer DEFAULT 0 NOT NULL,
	"gross" numeric(18, 4) DEFAULT '0' NOT NULL,
	"taxable" numeric(18, 4) DEFAULT '0' NOT NULL,
	"sales_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
	"excise_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
	"collected" numeric(18, 4) DEFAULT '0' NOT NULL,
	"delta" numeric(18, 4) DEFAULT '0' NOT NULL,
	"pact_shipments" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone,
	"computed_by" text,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_snapshot_month_idx" ON "monthly_snapshots" USING btree ("month");