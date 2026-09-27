ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "config" jsonb;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "push_key_hash" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "push_key_last4" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "last_push_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_push_key_idx" ON "integrations" USING btree ("push_key_hash");
