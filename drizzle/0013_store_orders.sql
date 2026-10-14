CREATE TABLE IF NOT EXISTS "store_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL REFERENCES "integrations"("id") ON DELETE cascade,
	"store_name" text NOT NULL,
	"order_id" text NOT NULL,
	"order_number" text,
	"status" text,
	"fulfillment_status" text,
	"payment_status" text,
	"ordered_at" timestamp with time zone NOT NULL,
	"shipped_at" timestamp with time zone,
	"customer_name" text,
	"email" text,
	"phone" text,
	"state" text,
	"city" text,
	"zip" text,
	"shipping_address" jsonb,
	"billing_address" jsonb,
	"items" jsonb NOT NULL,
	"shipping" jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(18, 4) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_collected" numeric(18, 4) DEFAULT '0' NOT NULL,
	"refunded" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"store_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "refunded" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_orders_order_idx" ON "store_orders" USING btree ("integration_id","order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_orders_ordered_idx" ON "store_orders" USING btree ("ordered_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_orders_state_idx" ON "store_orders" USING btree ("state");
