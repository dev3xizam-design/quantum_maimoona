ALTER TABLE "products" ADD COLUMN "source" text DEFAULT 'avalara' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "store_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "medusa_variant_id" text;