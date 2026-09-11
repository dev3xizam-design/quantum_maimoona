import "../src/lib/load-env";
import { sql } from "../src/db";
import { fetchTransactions } from "../src/lib/compute";
import { resolveStateConfig, resolveJurisdictionCodes } from "../src/lib/config";
import { computeSales } from "../src/lib/engine/sales";

async function main() {
  const state = process.argv[2] ?? "OK";
  const period = process.argv[3] ?? "2026-08";
  const rows = await fetchTransactions(state, period);
  const config = (await resolveStateConfig(state, "sales", period))!;
  const codes = await resolveJurisdictionCodes(state, period);
  const r = computeSales(rows, { config, codes, period });

  console.log(`${state} ${period}: ${rows.length} rows`);
  console.log(`gross ${r.gross} taxable ${r.taxable} collected ${r.taxCollected} computed ${r.taxComputed}`);
  console.log(`\njurisdiction rows (${r.byJurisdiction.length}):`);
  for (const l of r.byJurisdiction.slice(0, 25)) {
    console.log(
      `  ${(l.type ?? "").padEnd(26)} ${l.name.padEnd(26)} code=${(l.code ?? "-").padEnd(6)}` +
        ` taxable=${String(l.taxable).padStart(10)} rate=${String(l.rate).padStart(9)}` +
        ` tax=${String(l.tax).padStart(9)} computed=${String(l.taxComputed).padStart(9)}`,
    );
  }
  await sql.end();
}
main();
