import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);
async function main() {
  console.log("products table:", rows(await db.execute(dsql`
    SELECT count(*)::int total,
           count(*) FILTER (WHERE units_sold <> 0)::int sold,
           count(*) FILTER (WHERE needs_review)::int needs_review,
           count(*) FILTER (WHERE reviewed_at IS NOT NULL)::int reviewed,
           count(*) FILTER (WHERE contains_nicotine AND wholesale_cost IS NULL)::int missing_cost
    FROM products`))[0]);

  console.log("medusa mirror :", rows(await db.execute(dsql`
    SELECT count(*)::int variants,
           count(DISTINCT integration_id)::int stores,
           count(*) FILTER (WHERE matched_sku IS NOT NULL)::int matched
    FROM medusa_products`))[0]);

  console.log("\nper store:");
  for (const r of rows(await db.execute(dsql`
    SELECT i.name, i.status, count(m.id)::int variants,
           count(m.id) FILTER (WHERE m.matched_sku IS NOT NULL)::int matched
    FROM integrations i LEFT JOIN medusa_products m ON m.integration_id = i.id
    GROUP BY i.id, i.name, i.status ORDER BY i.name`))) {
    console.log(`  ${String(r.name).padEnd(26)} ${r.status}  variants=${r.variants}  matched=${r.matched}`);
  }
  console.log("\nshipments:", rows(await db.execute(dsql`
    SELECT source_system, count(*)::int n FROM shipments GROUP BY 1`)));
  await sql.end();
}
main();
