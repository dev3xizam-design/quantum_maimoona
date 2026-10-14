CREATE TABLE IF NOT EXISTS "tax_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"zip5" text NOT NULL,
	"plus4_low" text,
	"plus4_high" text,
	"county_name" text,
	"city_name" text,
	"state_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"county_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"city_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"special_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"total_rate" numeric(10, 6) NOT NULL,
	"jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rates_zip_idx" ON "tax_rates" USING btree ("state","zip5");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer REFERENCES "integrations"("id") ON DELETE set null,
	"document_code" text NOT NULL,
	"order_id" text NOT NULL,
	"order_number" text,
	"status" text DEFAULT 'committed' NOT NULL,
	"document_date" date NOT NULL,
	"period" text NOT NULL,
	"state" text NOT NULL,
	"address" jsonb,
	"subtotal" numeric(18, 4) DEFAULT '0' NOT NULL,
	"sales_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
	"excise_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
	"collected_tax" numeric(18, 4),
	"lines" jsonb,
	"committed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tax_doc_code_idx" ON "tax_documents" USING btree ("document_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_doc_period_idx" ON "tax_documents" USING btree ("period","state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_rate_areas" (
	"id" integer PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"county_name" text,
	"city_name" text,
	"state_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"county_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"city_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"special_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"total_rate" numeric(10, 6) NOT NULL,
	"jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_rate_plus4" (
	"state" text NOT NULL,
	"zip5" text NOT NULL,
	"ranges" integer[] NOT NULL,
	CONSTRAINT "tax_rate_plus4_pk" PRIMARY KEY ("state", "zip5")
);
