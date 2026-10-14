/**
 * Runs the scheduled order pull once, by hand.
 *
 *   npx tsx --conditions=react-server scripts/pull-orders.ts            # every store
 *   npx tsx --conditions=react-server scripts/pull-orders.ts 2          # one store (integration id)
 */
import "../src/lib/load-env";
import { sql } from "../src/db";
import { pullAllStores, pullStoreOrders } from "../src/lib/tax/order-pull";

async function main() {
  const id = process.argv[2] ? Number(process.argv[2]) : null;
  const out = id ? await pullStoreOrders(id) : await pullAllStores();
  console.log(JSON.stringify(out, null, 1));
  await sql.end();
}
main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
