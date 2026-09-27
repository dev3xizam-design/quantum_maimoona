/**
 * Multi-platform store connectors: provider-specific config and push-key
 * columns on `integrations`. Additive and nullable - existing Medusa rows are
 * untouched. Neon has no drizzle migrations table, so this is applied directly.
 *
 *   npx tsx scripts/migrate-connectors.ts
 */
import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";

async function main() {
  await db.execute(dsql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS config jsonb`);
  await db.execute(dsql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS push_key_hash text`);
  await db.execute(dsql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS push_key_last4 text`);
  await db.execute(dsql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_push_at timestamptz`);
  await db.execute(dsql`CREATE UNIQUE INDEX IF NOT EXISTS integration_push_key_idx ON integrations (push_key_hash)`);
  const r = await db.execute(dsql`SELECT id, slug, provider, status FROM integrations ORDER BY id`);
  console.log(Array.isArray(r) ? r : (r as { rows: unknown[] }).rows);
  await sql.end();
}
main();
