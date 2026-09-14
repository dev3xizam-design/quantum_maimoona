ALTER TABLE "products" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "reviewed_by" text;