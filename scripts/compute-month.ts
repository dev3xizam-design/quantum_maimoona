/** Compute and store a month from the command line. */
import "../src/lib/load-env";
import { sql } from "../src/db";
import { computeAndStoreMonth } from "../src/lib/months";
import { fmtMoney } from "../src/lib/money";

async function main() {
  const month = process.argv[2] ?? "2026-08";
  const started = Date.now();
  const { totals } = await computeAndStoreMonth(month, process.argv[3] ?? "cli");
  console.log(`\n${month} stored in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  states     ${totals.statesWithActivity} of ${totals.states}`);
  console.log(`  gross      ${fmtMoney(totals.gross)}`);
  console.log(`  sales tax  ${fmtMoney(totals.salesTax)}`);
  console.log(`  excise     ${fmtMoney(totals.exciseTax)}`);
  console.log(`  TOTAL      ${fmtMoney(totals.totalTax)}`);
  console.log(`  warnings   ${totals.warnings}`);
  await sql.end();
}
main();
