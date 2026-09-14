CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"base_url" text NOT NULL,
	"secret_cipher" text,
	"secret_last4" text,
	"auth_scheme" text,
	"status" text DEFAULT 'unconfigured' NOT NULL,
	"last_error" text,
	"last_tested_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"stats" jsonb,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medusa_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"product_id" text,
	"product_title" text,
	"variant_title" text,
	"sku" text,
	"barcode" text,
	"ean" text,
	"upc" text,
	"wholesale_cost" numeric(18, 4),
	"liquid_ml" numeric(12, 4),
	"system_type" text,
	"metadata" jsonb,
	"matched_sku" text,
	"match_method" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_provider_idx" ON "integrations" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "medusa_variant_idx" ON "medusa_products" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "medusa_barcode_idx" ON "medusa_products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "medusa_sku_idx" ON "medusa_products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "medusa_matched_idx" ON "medusa_products" USING btree ("matched_sku");