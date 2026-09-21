import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);

async function main() {
  console.log("=== excise rules configured ===");
  const byStruct = rows(await db.execute(dsql`
    SELECT structure, basis, count(*)::int n FROM excise_config WHERE active GROUP BY 1,2 ORDER BY 1,2`));
  for (const r of byStruct) console.log(`  structure ${r.structure}  ${r.basis}  ${r.n} state(s)`);
  const total = rows(await db.execute(dsql`SELECT count(*)::int n FROM excise_config WHERE active`))[0];
  console.log(`  total: ${total.n} states with a vapor excise rule`);

  console.log("\n=== August 2026: what excise actually computed ===");
  const f = rows(await db.execute(dsql`
    SELECT count(*)::int returns,
           count(*) FILTER (WHERE tax_computed::numeric > 0)::int nonzero,
           count(*) FILTER (WHERE tax_computed::numeric = 0)::int zero,
           round(sum(tax_computed::numeric),2) total
    FROM filings WHERE tax_type = 'excise' AND period = '2026-08'`))[0];
  console.log(`  ${f.returns} excise returns · ${f.nonzero} with tax · ${f.zero} at zero · $${f.total} total`);

  console.log("\n  states with a non-zero excise:");
  for (const r of rows(await db.execute(dsql`
    SELECT state, tax_computed FROM filings
    WHERE tax_type='excise' AND period='2026-08' AND tax_computed::numeric > 0
    ORDER BY tax_computed::numeric DESC`))) {
    console.log(`    ${r.state}  $${Number(r.tax_computed).toFixed(2)}`);
  }

  console.log("\n  states computing ZERO (rule exists but data is missing):");
  const zeros = rows(await db.execute(dsql`
    SELECT state FROM filings
    WHERE tax_type='excise' AND period='2026-08' AND tax_computed::numeric = 0 ORDER BY state`));
  console.log("    " + zeros.map((z) => z.state).join(", "));

  console.log("\n=== what is blocking them ===");
  const gaps = rows(await db.execute(dsql`
    SELECT count(*) FILTER (WHERE units_sold <> 0 AND contains_nicotine AND wholesale_cost IS NULL)::int no_cost,
           count(*) FILTER (WHERE units_sold <> 0 AND contains_nicotine AND liquid_ml IS NULL)::int no_ml,
           count(*) FILTER (WHERE units_sold <> 0 AND contains_nicotine AND system_type IS NULL)::int no_system
    FROM products`))[0];
  console.log(`  sold SKUs with no wholesale cost : ${gaps.no_cost}`);
  console.log(`  sold SKUs with no mL             : ${gaps.no_ml}`);
  console.log(`  sold SKUs with no open/closed    : ${gaps.no_system}`);
  const purch = rows(await db.execute(dsql`SELECT count(*)::int n FROM purchases`))[0];
  console.log(`  purchase rows loaded (Kansas EC-2 basis): ${purch.n}`);
  await sql.end();
}
main();
