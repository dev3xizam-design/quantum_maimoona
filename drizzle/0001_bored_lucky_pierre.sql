ALTER TABLE "products" ADD COLUMN "observed_unit_price" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "observed_unit_cost" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "units_sold" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "revenue" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "line_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "states_sold" text[];--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "first_seen" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_seen" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_source" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_source" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ml_source" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "system_type_source" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "classification_note" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "locked_fields" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;