CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"tax_type" text NOT NULL,
	"account_number" text,
	"license_number" text,
	"login_field" text,
	"frequency_override" text,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text,
	"table_name" text NOT NULL,
	"row_id" integer,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"effective_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "excise_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"structure" text NOT NULL,
	"basis" text DEFAULT 'SALES' NOT NULL,
	"rate" numeric(12, 8) DEFAULT '0' NOT NULL,
	"rate_unit" text DEFAULT 'pct_wholesale' NOT NULL,
	"open_rate" numeric(12, 8),
	"open_rate_unit" text,
	"closed_rate" numeric(12, 8),
	"closed_rate_unit" text,
	"frequency" text DEFAULT 'MONTHLY' NOT NULL,
	"portal" text,
	"form_name" text,
	"due_day" integer DEFAULT 20,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"tax_type" text NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"gross" numeric(18, 4),
	"exempt" numeric(18, 4),
	"taxable" numeric(18, 4),
	"tax_computed" numeric(18, 4),
	"tax_collected" numeric(18, 4),
	"delta" numeric(18, 4),
	"result" jsonb,
	"filed_at" timestamp with time zone,
	"filed_by" text,
	"confirmation_number" text,
	"amount_paid" numeric(18, 4),
	"notes" text,
	"computed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdiction_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"jurisdiction_name" text NOT NULL,
	"jurisdiction_type" text NOT NULL,
	"official_code" text NOT NULL,
	"paired_code" text,
	"paired_name" text,
	"rate" numeric(12, 8),
	"rate_includes_state" boolean DEFAULT false NOT NULL,
	"avalara_alias" text,
	"notes" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_thresholds" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"amount_threshold" numeric(18, 2),
	"txn_threshold" integer,
	"notes" text,
	"effective_from" date NOT NULL,
	"effective_to" date
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"description" text,
	"wholesale_cost" numeric(18, 4),
	"retail_price" numeric(18, 4),
	"liquid_ml" numeric(12, 4),
	"cartridges_per_unit" numeric(12, 4),
	"system_type" text,
	"contains_nicotine" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer,
	"period" text NOT NULL,
	"state" text,
	"sku" text,
	"description" text,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ml_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"units_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"wholesale_cost" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"actor" text,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer,
	"period" text NOT NULL,
	"state" text NOT NULL,
	"customer_name" text,
	"ship_to_address" text,
	"ship_to_city" text,
	"ship_to_state" text,
	"ship_to_zip" text,
	"invoice_date" date,
	"invoice_number" text,
	"product" text,
	"brand" text,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ml_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_tax_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"tax_type" text NOT NULL,
	"frequency" text DEFAULT 'MONTHLY' NOT NULL,
	"state_rate" numeric(12, 8) DEFAULT '0' NOT NULL,
	"has_local" boolean DEFAULT false NOT NULL,
	"allocation" text DEFAULT 'flat' NOT NULL,
	"rounding" text DEFAULT 'cents' NOT NULL,
	"portal" text,
	"form_name" text,
	"due_day" integer DEFAULT 20,
	"rate_label" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer,
	"source_file" text,
	"document_id" text NOT NULL,
	"line_no" text NOT NULL,
	"ref1" text,
	"document_status" text,
	"doc_type" text,
	"sign" integer DEFAULT 1 NOT NULL,
	"document_date" date,
	"period" text NOT NULL,
	"reporting_date" date,
	"tax_calc_date" date,
	"state" text NOT NULL,
	"dest_county" text,
	"dest_city" text,
	"dest_zip" text,
	"jurisdiction_type" text,
	"jurisdiction_description" text,
	"tax_type_description" text,
	"rate" numeric(12, 8) DEFAULT '0' NOT NULL,
	"line_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"exempt_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"item_code" text,
	"item_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"kind" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stats" jsonb,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ec_lookup_idx" ON "excise_config" USING btree ("state","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "filing_unique_idx" ON "filings" USING btree ("state","tax_type","period");--> statement-breakpoint
CREATE INDEX "jc_lookup_idx" ON "jurisdiction_codes" USING btree ("state","jurisdiction_type","jurisdiction_name");--> statement-breakpoint
CREATE INDEX "purch_period_idx" ON "purchases" USING btree ("period","state");--> statement-breakpoint
CREATE INDEX "ship_period_state_idx" ON "shipments" USING btree ("period","state");--> statement-breakpoint
CREATE INDEX "stc_lookup_idx" ON "state_tax_config" USING btree ("state","tax_type","effective_from");--> statement-breakpoint
CREATE INDEX "tx_state_period_idx" ON "transactions" USING btree ("state","period");--> statement-breakpoint
CREATE INDEX "tx_period_idx" ON "transactions" USING btree ("period");--> statement-breakpoint
CREATE INDEX "tx_doc_idx" ON "transactions" USING btree ("document_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "tx_dedupe_idx" ON "transactions" USING btree ("document_id","line_no","jurisdiction_type","jurisdiction_description","item_code");