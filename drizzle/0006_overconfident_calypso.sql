DROP INDEX "integration_provider_idx";--> statement-breakpoint
ALTER TABLE "integrations" ALTER COLUMN "provider" SET DEFAULT 'medusa';--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "sync_orders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "sync_catalog" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "orders_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "order_stats" jsonb;--> statement-breakpoint
ALTER TABLE "medusa_products" ADD COLUMN "integration_id" integer;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "integration_id" integer;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "source_system" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "source_label" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "order_number" text;--> statement-breakpoint
ALTER TABLE "medusa_products" ADD CONSTRAINT "medusa_products_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_slug_idx" ON "integrations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ship_source_idx" ON "shipments" USING btree ("source_system","integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ship_external_idx" ON "shipments" USING btree ("external_id");