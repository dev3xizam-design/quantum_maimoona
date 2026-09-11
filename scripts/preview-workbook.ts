/** Builds the period workbook against the live database and reports what it produced. */
import "../src/lib/load-env";
import { writeFileSync } from "node:fs";
import { sql } from "../src/db";
import { computePeriodEverything } from "../src/lib/period";
import { buildPeriodWorkbook, periodWorkbookFilename } from "../src/lib/excel/period-workbook";
import { fmtMoney } from "../src/lib/money";

async function main() {
  const month = process.argv[2] ?? "2026-08";
  const outDir = process.argv[3] ?? "/tmp";
  const started = Date.now();

  const persist = process.argv.includes("--persist");
  const comp = await computePeriodEverything(month, { persist });
  const t = comp.totals;
  console.log(`\ncomputed in ${((Date.now() - started) / 1000).toFixed(1)}s${persist ? " (stored)" : ""}`);
  console.log(`states with activity : ${t.statesWithActivity} of ${t.states}`);
  console.log(`gross                : ${fmtMoney(t.gross)}`);
  console.log(`taxable              : ${fmtMoney(t.taxable)}`);
  console.log(`sales tax due        : ${fmtMoney(t.salesTax)}`);
  console.log(`excise due           : ${fmtMoney(t.exciseTax)}`);
  console.log(`TOTAL due            : ${fmtMoney(t.totalTax)}`);
  console.log(`collected            : ${fmtMoney(t.collected)}`);
  console.log(`delta                : ${fmtMoney(t.delta)}`);
  console.log(`pact lines           : ${t.pactShipments}`);
  console.log(`action items         : ${t.warnings}`);
  console.log(`reconcile failures   : ${t.reconcileFailures.join(", ") || "none"}`);

  console.log("\nper state:");
  for (const b of comp.bundles.filter((x) => x.hasActivity)) {
    console.log(
      `  ${b.state}  gross ${String(b.sales?.gross ?? "-").padStart(11)}  tax ${String(b.sales?.taxComputed ?? "-").padStart(9)}` +
        `  delta ${String(b.sales?.delta ?? "-").padStart(8)}  excise ${String(b.excise?.taxComputed ?? "-").padStart(8)}` +
        `  recon ${!b.sales ? "n/a (no sales tax in this state)" : b.sales.reconciles ? "ok" : "FAIL"}`,
    );
  }

  const buf = await buildPeriodWorkbook(comp, {
    company: process.env.COMPANY_NAME ?? "Maximum Vapor Inc.",
    fein: process.env.COMPANY_FEIN ?? "82-1098441",
  });
  const path = `${outDir}/${periodWorkbookFilename(month)}`;
  writeFileSync(path, buf);
  console.log(`\nworkbook: ${path}  (${(buf.length / 1024).toFixed(0)} KB)`);

  await sql.end();
}
main();
