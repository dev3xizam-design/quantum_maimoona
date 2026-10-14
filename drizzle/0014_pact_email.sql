CREATE TABLE IF NOT EXISTS "email_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL UNIQUE,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"secret_cipher" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"last_error" text,
	"last_scan_at" timestamp with time zone,
	"connected_by" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pact_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL UNIQUE,
	"to_addresses" jsonb NOT NULL,
	"cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"attachment_template" text,
	"past_attachment_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learned_from" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learned_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pact_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"state" text NOT NULL,
	"status" text NOT NULL,
	"to_addresses" jsonb,
	"subject" text,
	"attachment_name" text,
	"shipment_count" integer,
	"message_id" text,
	"detail" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pact_sends_period_state_idx" ON "pact_sends" USING btree ("period","state");
