/** Dev aid: per-key Avalara vs our row for one state's build file (npx tsx scripts/rates/states/_il-mo-co-diff.ts CO). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pickRate } from "../../../src/lib/tax/rate-lookup";
import { DERIVED, readCsv, ROOT } from "../lib/common";

const st = process.argv[2];
const key = JSON.parse(readFileSync(path.join(DERIVED, ".avalara-key.json"), "utf8")).filter((g: { state: string }) => g.state === st);
const rows = readCsv(path.join(ROOT, "data/rates/build", `${st}.csv`));
let docs = 0, docsOk = 0, keysOk = 0;
for (const g of key) {
  const zr = rows.filter((r) => r.zip5 === g.zip5);
  const d = g.docs.slice().sort((a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : -1))[0];
  const pick = pickRate(zr.map((r) => ({ zip5: r.zip5, plus4Low: r.plus4_low || null, plus4High: r.plus4_high || null, cityName: r.city_name || null, countyName: r.county_name || null, isPrimary: r.is_primary === "true", row: r })), { city: g.city, zip4: null });
  const ours = pick ? Number(pick.row.row.total_rate) : null;
  const ok = ours != null && Math.abs(ours - d.rate) < 1e-4;
  if (ok) keysOk++;
  for (const x of g.docs as { rate: number }[]) { docs++; if (ours != null && Math.abs(ours - x.rate) < 1e-4) docsOk++; }
  if (process.argv[3] !== "all" && ok) continue;
  console.log(`${ok ? "OK  " : "DIFF"} ${g.zip5} ${g.city}/${g.county} avalara=${d.rate} ours=${ours} [${pick?.row.row.city_name}/${pick?.row.row.county_name} by ${pick?.matchedBy}]`);
  console.log(`     AV: ${d.comps.filter((c: { rate: number }) => c.rate).map((c: { type: string; name: string; rate: number }) => `${c.type[0]}:${c.name} ${c.rate}`).join(", ")}`);
  console.log(`     US: ${JSON.parse(pick?.row.row.jurisdictions ?? "[]").map((j: { type: string; name: string; rate: number }) => `${j.type[0]}:${j.name} ${j.rate}`).join(", ")}`);
  console.log(`     other rows: ${zr.filter((r) => r !== pick?.row.row).map((r) => `${r.city_name}/${r.county_name} ${r.total_rate}`).join("; ")}`);
}
console.log(`SUMMARY ${st}: keys ${keysOk}/${key.length}, docs ${docsOk}/${docs}`);
