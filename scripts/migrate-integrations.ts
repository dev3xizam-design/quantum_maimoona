/**
 * The integrations table went from one row to many. Add the new identity
 * columns with a backfill so the connection already saved survives.
 */
import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";

const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);

async function main() {
  await db.execute(dsql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS slug text`);
  await db.execute(dsql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS name text`);

  // Name the existing connection after its host.
  await db.execute(dsql`
    UPDATE integrations
    SET slug = coalesce(slug, regexp_replace(lower(split_part(regexp_replace(base_url,'^https?://',''), '.', 1)), '[^a-z0-9]+', '-', 'g')),
        name = coalesce(name, split_part(regexp_replace(base_url,'^https?://',''), '.', 1))
    WHERE slug IS NULL OR name IS NULL
  `);
  await db.execute(dsql`UPDATE integrations SET slug = 'store-' || id WHERE slug IS NULL OR slug = ''`);
  await db.execute(dsql`UPDATE integrations SET name = 'Store ' || id WHERE name IS NULL OR name = ''`);
  await db.execute(dsql`ALTER TABLE integrations ALTER COLUMN slug SET NOT NULL`);
  await db.execute(dsql`ALTER TABLE integrations ALTER COLUMN name SET NOT NULL`);

  console.log(rows(await db.execute(dsql`SELECT id, slug, name, base_url, status FROM integrations`)));
  await sql.end();
}
main();
