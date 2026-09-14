import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);
async function main() {
  for (const r of rows(await db.execute(dsql`
    SELECT source, coalesce(store_name,'—') store, count(*)::int n,
           count(*) FILTER (WHERE units_sold <> 0)::int sold,
           count(*) FILTER (WHERE wholesale_cost IS NOT NULL)::int with_cost
    FROM products GROUP BY 1,2 ORDER BY 3 DESC`))) {
    console.log(`  ${String(r.source).padEnd(9)} ${String(r.store).padEnd(24)} ${String(r.n).padStart(6)} products  ${String(r.sold).padStart(5)} sold  ${String(r.with_cost).padStart(5)} with cost`);
  }
  console.log("\nsold SKUs still missing cost:", rows(await db.execute(dsql`
    SELECT count(*)::int n FROM products WHERE units_sold <> 0 AND contains_nicotine AND wholesale_cost IS NULL`))[0].n);
  await sql.end();
}
main();
