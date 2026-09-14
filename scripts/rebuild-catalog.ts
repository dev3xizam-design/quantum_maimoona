/** Rebuild the product catalog from the stored transactions. */
import "../src/lib/load-env";
import { sql } from "../src/db";
import { refreshProductCatalog } from "../src/lib/products/catalog";

async function main() {
  const r = await refreshProductCatalog();
  console.log(`SKUs seen        ${r.skusSeen}`);
  console.log(`priced           ${r.withPrice}`);
  console.log(`with cost        ${r.withCost}`);
  console.log(`with mL          ${r.withMl}`);
  console.log(`open / closed    ${r.classifiedOpen} / ${r.classifiedClosed}`);
  console.log(`unclassified     ${r.unclassified}`);
  console.log(`NEEDS REVIEW     ${r.needsReview}`);
  await sql.end();
}
main();
