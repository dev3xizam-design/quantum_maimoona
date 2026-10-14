/**
 * Builds data/rates/us-tax-rates.csv - the nationwide ZIP / ZIP+4 sales-tax
 * rate table - from the official source files under data/rates/raw.
 *
 *   npx tsx scripts/rates/build-rates.ts               # every state, then merge
 *   npx tsx scripts/rates/build-rates.ts --only CA,TX  # rebuild some states, then merge
 *   npx tsx scripts/rates/build-rates.ts --merge       # only re-merge data/rates/build/*.csv
 *
 * Each state is built into data/rates/build/<ST>.csv (gitignored) and the
 * merge concatenates them. Builders:
 *   - scripts/rates/states/<ST>.ts exporting `build(): Promise<StateBuild>`
 *   - otherwise SST member states go through scripts/rates/states/sst.ts
 * Prerequisite: data/rates/derived/zcta-geo.csv (scripts/rates/prepare-census.ts).
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { DERIVED, RATE_CHANGES, ROOT, STATE_NAMES, round6, sumBy, type RateRow, type StateBuild } from "./lib/common";
import { buildSst } from "./states/sst";

export const SST_STATES = ["AR", "GA", "IN", "IA", "KS", "KY", "MI", "MN", "NE", "NV", "NJ", "NC", "ND", "OH", "OK", "RI", "SD", "TN", "UT", "VT", "WA", "WV", "WI", "WY"];

const BUILD = path.join(ROOT, "data/rates/build");
const OUT = path.join(ROOT, "data/rates/us-tax-rates.csv");

export const CSV_COLUMNS = [
  "state", "zip5", "plus4_low", "plus4_high", "county_name", "city_name",
  "state_rate", "county_rate", "city_rate", "special_rate", "total_rate",
  "jurisdictions", "is_primary", "source", "effective_from", "effective_to", "prev_total_rate",
] as const;

export function toCsvRecord(r: RateRow) {
  // a 0-rate local entry is noise for the API; the State entry is always kept (0 in no-tax states)
  r = { ...r, jurisdictions: r.jurisdictions.filter((j) => j.type === "State" || j.rate !== 0) };
  return {
    state: r.state,
    zip5: r.zip5,
    plus4_low: r.plus4Low ?? "",
    plus4_high: r.plus4High ?? "",
    county_name: r.countyName ?? "",
    city_name: r.cityName ?? "",
    state_rate: sumBy(r.jurisdictions, "State"),
    county_rate: sumBy(r.jurisdictions, "County"),
    city_rate: sumBy(r.jurisdictions, "City"),
    special_rate: sumBy(r.jurisdictions, "Special"),
    total_rate: sumBy(r.jurisdictions),
    jurisdictions: JSON.stringify(r.jurisdictions),
    is_primary: r.isPrimary ? "true" : "false",
    source: r.source,
    effective_from: r.effectiveFrom,
    effective_to: r.effectiveTo ?? "",
    prev_total_rate: r.prevTotal == null ? "" : round6(r.prevTotal),
  };
}

async function builderFor(state: string): Promise<() => Promise<StateBuild>> {
  const file = path.join(ROOT, "scripts/rates/states", `${state}.ts`);
  if (existsSync(file)) {
    const mod = (await import(file)) as { build: () => Promise<StateBuild> };
    return mod.build;
  }
  if (SST_STATES.includes(state)) return async () => ({ state, ...(await buildSst(state)) });
  throw new Error(`${state}: no builder (add scripts/rates/states/${state}.ts)`);
}

/** Sanity rules every state must pass before it is written. */
function check(state: string, rows: RateRow[]) {
  const problems: string[] = [];
  const prim = new Map<string, number>();
  for (const r of rows) {
    if (r.state !== state) problems.push(`row for ${r.state} in ${state} build`);
    if (!/^\d{5}$/.test(r.zip5)) problems.push(`bad zip ${r.zip5}`);
    const t = sumBy(r.jurisdictions);
    if (!(t >= 0 && t < 0.2)) problems.push(`${r.zip5}: total ${t} out of range`);
    if (r.plus4Low == null && r.isPrimary) prim.set(r.zip5, (prim.get(r.zip5) ?? 0) + 1);
    if (r.plus4Low != null && r.isPrimary) problems.push(`${r.zip5}: plus4 row marked primary`);
  }
  const zips = new Set(rows.filter((r) => r.plus4Low == null).map((r) => r.zip5));
  for (const z of zips) if (prim.get(z) !== 1) problems.push(`${z}: ${prim.get(z) ?? 0} primary rows`);
  if (problems.length) throw new Error(`${state} failed checks:\n  ${problems.slice(0, 20).join("\n  ")}${problems.length > 20 ? `\n  (+${problems.length - 20} more)` : ""}`);
}

export function writeStateCsv(state: string, rows: RateRow[]) {
  mkdirSync(BUILD, { recursive: true });
  writeFileSync(path.join(BUILD, `${state}.csv`), Papa.unparse(rows.map(toCsvRecord), { columns: [...CSV_COLUMNS] }) + "\n");
}

function merge() {
  const files = readdirSync(BUILD).filter((f) => /^[A-Z]{2}\.csv$/.test(f)).sort();
  // appended state by state: the whole table (~2M rows with ZIP+4 ranges) is past V8's max string length
  writeFileSync(OUT, CSV_COLUMNS.join(",") + "\n");
  for (const f of files) {
    const text = readFileSync(path.join(BUILD, f), "utf8").replace(/\n+$/, "");
    const nl = text.indexOf("\n");
    if (nl > 0) appendFileSync(OUT, text.slice(nl + 1) + "\n");
  }
  const missing = Object.keys(STATE_NAMES).filter((s) => !files.includes(`${s}.csv`));
  console.log(`merged ${files.length} states -> ${path.relative(ROOT, OUT)}${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--merge")) return merge();
  const onlyArg = args[args.indexOf("--only") + 1];
  const states = args.includes("--only") ? onlyArg.split(",").map((s) => s.trim().toUpperCase()) : Object.keys(STATE_NAMES);
  if (!existsSync(path.join(DERIVED, "zcta-geo.csv"))) throw new Error("run scripts/rates/prepare-census.ts first");
  const failed: string[] = [];
  for (const st of states) {
    const t0 = Date.now();
    try {
      const b = await (await builderFor(st))();
      check(st, b.rows);
      writeStateCsv(st, b.rows);
      const z = new Set(b.rows.map((r) => r.zip5)).size;
      console.log(`${st}: ${b.rows.length.toLocaleString()} rows, ${z.toLocaleString()} ZIPs (${((Date.now() - t0) / 1000).toFixed(1)}s) - ${b.source}`);
      for (const n of b.notes ?? []) console.log(`    ${n}`);
    } catch (e) {
      failed.push(st);
      console.error(`${st}: FAILED - ${(e as Error).message}`);
    }
  }
  if (RATE_CHANGES.length) {
    const file = path.join(DERIVED, "rate-changes.json");
    const prev = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as typeof RATE_CHANGES) : [];
    const keep = prev.filter((c) => !states.includes(c.state));
    writeFileSync(file, JSON.stringify([...keep, ...RATE_CHANGES], null, 1));
  }
  merge();
  if (failed.length) {
    console.error(`failed: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main();
