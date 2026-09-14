import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);
async function main() {
  const a = rows(await db.execute(dsql`
    SELECT count(*)::int total,
           count(*) FILTER (WHERE wholesale_cost IS NOT NULL)::int with_cost,
           count(*) FILTER (WHERE liquid_ml IS NOT NULL)::int with_ml,
           count(*) FILTER (WHERE needs_review)::int needs_review,
           count(*) FILTER (WHERE NOT contains_nicotine)::int non_nicotine,
           count(*) FILTER (WHERE units_sold <> 0)::int sold,
           count(*) FILTER (WHERE units_sold = 0)::int never_sold
    FROM products`))[0];
  console.log("products table:", a);

  const overlap = rows(await db.execute(dsql`
    SELECT count(DISTINCT upper(btrim(t.item_code)))::int tx_skus,
           count(DISTINCT p.sku)::int matched
    FROM transactions t LEFT JOIN products p ON p.sku = upper(btrim(t.item_code))
    WHERE t.item_code IS NOT NULL AND btrim(t.item_code) <> ''`))[0];
  console.log("sku overlap  :", overlap);

  console.log("\nsample SKUs that were never sold (from the CSV master):");
  for (const r of rows(await db.execute(dsql`
    SELECT sku, left(coalesce(description,''),44) d, wholesale_cost, liquid_ml, system_type
    FROM products WHERE units_sold = 0 ORDER BY sku LIMIT 6`))) {
    console.log(`  ${String(r.sku).padEnd(20)} ${String(r.d).padEnd(46)} cost=${r.wholesale_cost ?? "-"} ml=${r.liquid_ml ?? "-"} ${r.system_type ?? "-"}`);
  }
  await sql.end();
}
main();
