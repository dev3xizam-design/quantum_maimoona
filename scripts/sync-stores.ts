/** Run a catalog and/or order sync for every connected store. */
import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { integrations } from "../src/db/schema";
import { syncCatalog, syncOrders } from "../src/lib/medusa/sync";
import { refreshProductCatalog } from "../src/lib/products/catalog";

async function main() {
  const what = process.argv[2] ?? "catalog";
  const stores = await db.select().from(integrations);

  for (const s of stores) {
    if (!s.secretCipher) {
      console.log(`${s.name}: no key saved, skipping`);
      continue;
    }
    try {
      if (what === "catalog" || what === "all") {
        const r = await syncCatalog(s.id);
        console.log(
          `${s.name}: ${r.variants} variants · ${r.registered} registered as products · ` +
            `${r.matched} matched (${r.matchedByBarcode} code, ${r.matchedByName} name, ${r.ambiguousNames} ambiguous)`,
        );
      }
      if (what === "orders" || what === "all") {
        const o = await syncOrders(s.id);
        console.log(
          `${s.name}: ${o.ordersRead} orders → ${o.shipmentRows} shipment lines, ` +
            `${o.states} states, ${o.withCustomerName} with a name` +
            (o.periods.length ? `, ${o.periods[0]}–${o.periods[o.periods.length - 1]}` : ""),
        );
      }
    } catch (e) {
      console.log(`${s.name}: FAILED — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (what === "catalog" || what === "all") await refreshProductCatalog();
  await sql.end();
}
main();
