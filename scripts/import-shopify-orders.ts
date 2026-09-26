/**
 * Import Shopify order exports (Shopify CSV or Matrixify .xlsx) as PACT
 * shipment rows -- the same parser and upsert the Upload > Shopify screen uses,
 * for loading a backlog of months in one go.
 *
 *   npx tsx --conditions=react-server scripts/import-shopify-orders.ts "<store>" <file>... [--dry-run]
 *
 * Rows are keyed shopify:<store>:<order>:<line>, so re-running with the same
 * store name corrects rows instead of duplicating them. Output is counts and
 * product names only -- never a customer name or address.
 */
import "../src/lib/load-env";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { uploads } from "../src/db/schema";
import { parseShopifyOrders } from "../src/lib/ingest/shopify";
import { readXlsxRecords } from "../src/lib/ingest/xlsx-records";
import { insertShipments } from "../src/lib/ingest/persist";

const BATCH = 400;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [store, ...files] = args.filter((a) => a !== "--dry-run");
  if (!store || !files.length) {
    console.error('usage: import-shopify-orders.ts "<store>" <file>... [--dry-run]');
    process.exit(1);
  }

  for (const file of files) {
    let records: Record<string, string>[];
    let headers: string[];
    if (/\.xlsx$/i.test(file)) {
      const buf = fs.readFileSync(file);
      ({ records, headers } = await readXlsxRecords(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        "Orders",
      ));
    } else {
      const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(file, "utf8"), {
        header: true,
        skipEmptyLines: true,
      });
      records = parsed.data;
      headers = parsed.meta.fields ?? [];
    }

    const result = parseShopifyOrders(records, headers, store);
    const name = path.basename(file);
    if (result.missingColumns.length) {
      console.error(`${name}: missing ${result.missingColumns.join(", ")} -- skipped`);
      continue;
    }
    const qty = result.rows.reduce((s, r) => s + r.quantity, 0);
    const ml = result.rows.reduce((s, r) => s + r.mlTotal, 0);
    console.log(
      `${name}: ${result.periods.join(",")}  orders=${result.orders} lines=${result.rows.length} ` +
        `units=${qty} mL=${ml} states=${new Set(result.rows.map((r) => r.state)).size}  skipped: ` +
        `addon=${result.skippedNonProduct} nonUS=${result.skippedNonUs} ` +
        `refunded=${result.skippedRefunded} noState=${result.skippedNoState}`,
    );
    if (dryRun) continue;

    const [created] = await db
      .insert(uploads)
      .values({ filename: `${store} — ${name}`, kind: "shipments", uploadedBy: "import script", status: "pending" })
      .returning({ id: uploads.id });
    let stored = 0;
    for (let i = 0; i < result.rows.length; i += BATCH) {
      stored += await insertShipments(
        created.id,
        result.rows.slice(i, i + BATCH).map((r) => ({ ...r, sourceSystem: "shopify_csv", sourceLabel: store })),
      );
    }
    await db
      .update(uploads)
      .set({ status: "complete", rowCount: stored, stats: { periods: result.periods, orders: result.orders } })
      .where(eq(uploads.id, created.id));
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
