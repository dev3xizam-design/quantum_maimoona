/**
 * One-time maintenance: earlier uploads stored the jurisdiction rate exactly as
 * the export wrote it, which for a percentage-format file is 100x too large.
 * The engine normalizes on read, so this only cleans the stored values.
 */
import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";

async function main() {
  const apply = process.argv.includes("--apply");

  const before = await db.execute(dsql`
    SELECT count(*)::int AS n FROM transactions
    WHERE taxable_amount <> 0 AND tax_amount <> 0
      AND abs(rate/100 - abs(tax_amount/taxable_amount)) < abs(rate - abs(tax_amount/taxable_amount))
  `);
  const bare = await db.execute(dsql`
    SELECT count(*)::int AS n FROM transactions
    WHERE (taxable_amount = 0 OR tax_amount = 0) AND rate >= 1
  `);
  const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);
  const a = Number(rows(before)[0].n);
  const b = Number(rows(bare)[0].n);
  console.log(`rows whose arithmetic says the rate is a percentage : ${a}`);
  console.log(`rows with no arithmetic but a rate >= 1             : ${b}`);

  if (!apply) {
    console.log("\ndry run - pass --apply to write");
    await sql.end();
    return;
  }

  await db.execute(dsql`
    UPDATE transactions SET rate = rate / 100
    WHERE taxable_amount <> 0 AND tax_amount <> 0
      AND abs(rate/100 - abs(tax_amount/taxable_amount)) < abs(rate - abs(tax_amount/taxable_amount))
  `);
  await db.execute(dsql`
    UPDATE transactions SET rate = rate / 100
    WHERE (taxable_amount = 0 OR tax_amount = 0) AND rate >= 1
  `);
  console.log(`\nrescaled ${a + b} row(s).`);
  await sql.end();
}
main();
