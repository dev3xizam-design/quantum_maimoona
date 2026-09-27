/** Run a catalog and/or order sync for every connected store. */
import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { integrations } from "../src/db/schema";
import { syncCatalog } from "../src/lib/medusa/sync";
import { syncStoreOrders } from "../src/lib/connectors/store";
import { refreshProductCatalog } from "../src/lib/products/catalog";

async function main() {
  const what = process.argv[2] ?? "catalog";
  const stores = await db.select().from(integrations);

  for (const s of stores) {
    if (s.provider === "push") {
      console.log(`${s.name}: pushes its own orders, skipping`);
      continue;
    }
    if (!s.secretCipher) {
      console.log(`${s.name}: no key saved, skipping`);
      continue;
    }
    try {
      if ((what === "catalog" || what === "all") && s.provider === "medusa") {
        const r = await syncCatalog(s.id);
        console.log(
          `${s.name}: ${r.variants} variants · ${r.registered} registered as products · ` +
            `${r.matched} matched (${r.matchedByBarcode} code, ${r.matchedByName} name, ${r.ambiguousNames} ambiguous)`,
        );
      }
      if (what === "orders" || what === "all") {
        const o = await syncStoreOrders(s.id);
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
