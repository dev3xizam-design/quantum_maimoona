/** Sanity check against the linked Neon branch. Read-only. */
import "../src/lib/load-env";
import { sql } from "../src/db";
import { resolveStateConfig, resolveExciseConfig } from "../src/lib/config";
import { buildCalendar } from "../src/lib/calendar";

async function main() {
  const ks = await resolveStateConfig("KS", "sales", "2026-08");
  const ksE = await resolveExciseConfig("KS", "2026-08");
  const scJul = await resolveExciseConfig("SC", "2026-07");
  const scOct = await resolveExciseConfig("SC", "2026-10");

  console.log("KS sales frequency :", ks?.frequency, "| form", ks?.formName);
  console.log("KS excise          :", ksE?.frequency, ksE?.basis, `$${ksE?.rate}/mL`, "| form", ksE?.formName);
  console.log("SC excise Jul 2026 :", scJul ? "exists" : "none (correct - starts 1 Oct 2026)");
  console.log("SC excise Oct 2026 :", scOct ? `$${scOct.rate} per mL` : "none");

  const cells = await buildCalendar("2026-08");
  const registrations = cells.length;
  const states = new Set(cells.map((c) => c.state)).size;
  console.log(`\nCalendar 2026-08   : ${registrations} registrations across ${states} states`);
  console.log("Sample rows:");
  for (const c of cells.filter((c) => ["KS", "IL", "NJ", "IN"].includes(c.state))) {
    console.log(`  ${c.state} ${c.taxType.padEnd(6)} ${c.frequency.padEnd(9)} period ${c.period.padEnd(7)} due ${c.dueDate}`);
  }
  const { db } = await import("../src/db");
  const { sql: dsql } = await import("drizzle-orm");
  const cols = await db.execute(dsql`
    select column_name from information_schema.columns
    where table_name = 'products' order by ordinal_position
  `);
  const names = (Array.isArray(cols) ? cols : (cols as { rows: Record<string, unknown>[] }).rows)
    .map((c) => String(c.column_name));
  const required = [
    "observed_unit_price", "observed_unit_cost", "units_sold", "revenue", "line_count",
    "states_sold", "price_source", "cost_source", "ml_source", "system_type_source",
    "locked_fields", "needs_review",
  ];
  const missing = required.filter((c) => !names.includes(c));
  console.log(`\nproducts table    : ${names.length} columns`);
  console.log(`catalog columns   : ${missing.length === 0 ? "all present" : "MISSING " + missing.join(", ")}`);

  const { products } = await import("../src/db/schema");
  const rows = await db.select().from(products);
  console.log(`products stored   : ${rows.length}`);

  await sql.end();
}
main();
