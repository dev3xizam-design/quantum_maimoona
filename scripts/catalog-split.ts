import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);

async function main() {
  console.log("=== SKUs that actually SOLD (from Avalara) ===");
  for (const r of rows(await db.execute(dsql`
    SELECT sku, left(coalesce(description,''),52) d, revenue
    FROM products WHERE units_sold <> 0 ORDER BY revenue DESC LIMIT 8`))) {
    console.log(`  ${String(r.sku).padEnd(16)} ${String(r.d).padEnd(54)} $${r.revenue}`);
  }

  console.log("\n=== SKUs from the uploaded master that NEVER sold ===");
  for (const r of rows(await db.execute(dsql`
    SELECT sku, left(coalesce(description,''),52) d, wholesale_cost
    FROM products WHERE units_sold = 0 ORDER BY sku LIMIT 8`))) {
    console.log(`  ${String(r.sku).padEnd(16)} ${String(r.d).padEnd(54)} cost=${r.wholesale_cost}`);
  }

  console.log("\n=== brand words, sold vs never-sold ===");
  for (const word of ["TYSON", "SUORIN", "GEEK", "ELF", "LOST MARY", "RAZ", "POD"]) {
    const r = rows(await db.execute(dsql`
      SELECT count(*) FILTER (WHERE units_sold <> 0)::int sold,
             count(*) FILTER (WHERE units_sold = 0)::int never
      FROM products WHERE upper(coalesce(description,'')) LIKE ${'%' + word + '%'}`))[0];
    console.log(`  ${word.padEnd(10)} sold=${String(r.sold).padStart(4)}  never sold=${String(r.never).padStart(5)}`);
  }
  await sql.end();
}
main();
