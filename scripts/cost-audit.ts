import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);
async function main() {
  console.log("Medusa variants carrying a cost / mL in metadata:");
  for (const r of rows(await db.execute(dsql`
    SELECT i.name, count(m.id)::int variants,
           count(m.id) FILTER (WHERE m.wholesale_cost IS NOT NULL)::int with_cost,
           count(m.id) FILTER (WHERE m.liquid_ml IS NOT NULL)::int with_ml,
           count(m.id) FILTER (WHERE m.barcode IS NOT NULL AND m.barcode <> '')::int with_barcode
    FROM integrations i JOIN medusa_products m ON m.integration_id = i.id
    GROUP BY i.name ORDER BY 2 DESC`))) {
    console.log(`  ${String(r.name).padEnd(24)} ${String(r.variants).padStart(5)} variants · cost ${r.with_cost} · mL ${r.with_ml} · barcode ${r.with_barcode}`);
  }
  console.log("\nsample metadata keys actually present on variants:");
  const keys = new Map<string, number>();
  for (const r of rows(await db.execute(dsql`SELECT metadata FROM medusa_products WHERE metadata IS NOT NULL LIMIT 400`))) {
    for (const k of Object.keys((r.metadata ?? {}) as Record<string, unknown>)) keys.set(k, (keys.get(k) ?? 0) + 1);
  }
  const sorted = [...keys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  console.log(sorted.length ? sorted.map(([k, n]) => `  ${k} (${n})`).join("\n") : "  (no metadata on any variant)");
  await sql.end();
}
main();
