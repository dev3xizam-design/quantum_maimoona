ALTER TABLE "medusa_products" ADD COLUMN "match_score" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "medusa_products" ADD COLUMN "match_rejected" boolean DEFAULT false NOT NULL;