/**
 * Real-time tax tables: tax_rates, tax_rate_areas, tax_rate_plus4, tax_settings, tax_documents. Additive only.
 * Neon has no drizzle migrations table, so drizzle/0012_realtime_tax.sql is
 * applied directly, statement by statement.
 *
 *   npx tsx scripts/migrate-realtime-tax.ts
 */
import "../src/lib/load-env";
import { readFileSync } from "node:fs";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";

async function main() {
  const file = readFileSync(new URL("../drizzle/0012_realtime_tax.sql", import.meta.url), "utf8");
  for (const stmt of file.split("--> statement-breakpoint")) {
    if (stmt.trim()) await db.execute(dsql.raw(stmt));
  }
  const r = await db.execute(
    dsql`SELECT table_name FROM information_schema.tables WHERE table_name IN ('tax_rates','tax_settings','tax_documents','tax_rate_areas','tax_rate_plus4') ORDER BY 1`,
  );
  console.log(Array.isArray(r) ? r : (r as { rows: unknown[] }).rows);
  await sql.end();
}
main();
