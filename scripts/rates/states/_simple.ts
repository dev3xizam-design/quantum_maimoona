/**
 * Builders for the states whose rate depends on nothing finer than the county
 * (or the independent city / NYC borough): a flat state rate, plus a county
 * add-on read from Quantum's jurisdiction directory (official DOR rows).
 * Each scripts/rates/states/<ST>.ts for these states is a one-liner into here.
 *
 * Jurisdiction split mirrors how Avalara reports the same addresses, so the
 * validator compares like with like (e.g. NY = State 4% + County/City + MCTD).
 */
import ExcelJS from "exceljs";
import { AS_OF, STATE_NAMES, mustExist, rawFile, round6, stateOnly, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { zipRowsFromPieces, type Piece } from "../lib/geo";

const SRC = (state: string) => `Quantum jurisdiction directory (${state} DOR rows), Census 2020 ZCTA pieces`;

/** "St. Lucie County" / "ST LUCIE" / "Saint Lucie" -> "stlucie" */
export function normPlace(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\b(county|parish|borough|city|town|village)\b/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z]/g, "");
}

const num = (s: string) => (s === "" ? null : Number(s));

function finish(state: string, source: string, rate: (p: Piece) => Juris[] | null, notes: string[] = []): StateBuild {
  const { rows, unrated } = zipRowsFromPieces(state, source, (p) => {
    const j = rate(p);
    return j ? { jurisdictions: j, effectiveFrom: AS_OF } : null;
  });
  if (unrated.length) {
    const names = [...new Set(unrated.map((p) => p.countyName))].slice(0, 10);
    notes.push(`${unrated.length} Census pieces unrated (counties: ${names.join(", ")})`);
  }
  return { state, source, rows, notes };
}

/** One rate everywhere (no local sales taxes, or none that reach a remote seller). */
export function flatState(state: string, rate: number, why: string): StateBuild {
  return finish(state, `${why}`, () => stateOnly(state, STATE_NAMES[state], rate));
}

/**
 * State rate + an add-on per county. `addOn` maps normPlace(county) to the
 * County-level juris for that county; counties missing from it get state only.
 */
export function stateplusCounty(state: string, stateRate: number, addOn: Map<string, Juris[]>, source = SRC(state)): StateBuild {
  const st = stateOnly(state, STATE_NAMES[state], stateRate);
  return finish(state, source, (p) => [...st, ...(addOn.get(normPlace(p.countyName)) ?? [])]);
}

// ---------------------------------------------------------------- per state

export function buildFL(): StateBuild {
  const add = new Map<string, Juris[]>();
  for (const r of directoryRows("FL").filter((r) => r.jurisdiction_type === "county")) {
    const rate = num(r.local_rate);
    if (rate == null) continue;
    add.set(normPlace(r.county_name || r.jurisdiction_name), [{ type: "County", name: r.jurisdiction_name, code: r.official_code || null, rate }]);
  }
  if (add.size !== 67) throw new Error(`FL: expected 67 counties in the directory, got ${add.size}`);
  return stateplusCounty("FL", 0.06, add);
}

export function buildPA(): StateBuild {
  const add = new Map<string, Juris[]>();
  for (const r of directoryRows("PA").filter((r) => r.jurisdiction_type !== "state")) {
    add.set(normPlace(r.county_name), [{ type: r.jurisdiction_type === "city" ? "City" : "County", name: r.jurisdiction_name, code: r.official_code || null, rate: Number(r.local_rate) }]);
  }
  return stateplusCounty("PA", 0.06, add);
}

export function buildHI(): StateBuild {
  // GET 4% + 0.5% county surcharge in every county except Kalawao
  const add = new Map<string, Juris[]>();
  for (const r of directoryRows("HI").filter((r) => r.jurisdiction_type === "county")) {
    add.set(normPlace(r.county_name), [{ type: "County", name: r.jurisdiction_name, code: r.official_code || null, rate: Number(r.local_rate) }]);
  }
  return stateplusCounty("HI", 0.04, add);
}

/**
 * VA: Virginia Tax's own rate workbook (tax.virginia.gov .../sales-tax-rates.xlsx,
 * saved in data/rates/raw/VA). One row per locality keyed by its FIPS code -
 * which is also the Census county FIPS, independent cities included - with
 * each ST-9 component in its own column: state 4.3%, the regional state-levied
 * taxes (NVA / HR / CVA / Historic Triangle), the 1% local tax and the
 * additional local option (school) tax.
 */
const VA_REGIONAL = [
  [6, "Northern Virginia regional"],
  [7, "Hampton Roads regional"],
  [8, "Central Virginia regional"],
  [9, "Historic Triangle regional"],
] as const;

export async function buildVA(): Promise<StateBuild> {
  const file = mustExist(rawFile("VA", "sales-tax-rates.xlsx"));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const cell = (r: ExcelJS.Row, c: number) => {
    const v = r.getCell(c).value;
    return v == null || v === "" ? null : typeof v === "object" && "result" in v ? (v.result as unknown) : v;
  };
  const rate = (r: ExcelJS.Row, c: number) => {
    const v = cell(r, c);
    return v == null ? 0 : round6(Number(v));
  };
  const byFips = new Map<string, { name: string; total: number; j: Juris[] }>();
  ws.eachRow((r) => {
    const fips = String(cell(r, 2) ?? "").padStart(3, "0");
    if (String(cell(r, 1) ?? "") !== "51" || !/^\d{3}$/.test(fips)) return;
    const name = String(cell(r, 3));
    const j: Juris[] = [...stateOnly("VA", "Virginia", rate(r, 6)), { type: "County", name, code: fips, rate: rate(r, 11) }];
    for (const [col, label] of VA_REGIONAL) {
      const x = rate(r, col + 1);
      if (x) j.push({ type: "Special", name: label, code: null, rate: x });
    }
    const opt = rate(r, 12);
    if (opt) j.push({ type: "County", name: `${name} additional local option`, code: fips, rate: opt });
    const total = rate(r, 4);
    const sum = round6(j.reduce((s, x) => s + x.rate, 0));
    if (Math.abs(sum - total) > 1e-6) throw new Error(`VA ${name}: components ${sum} != published total ${total}`);
    byFips.set(fips, { name, total, j });
  });
  if (byFips.size < 130) throw new Error(`VA: only ${byFips.size} localities read from ${file}`);
  return finish("VA", "Virginia Tax sales-tax-rates.xlsx (combined state & local rates by locality FIPS)", (p) => byFips.get(p.countyFips)?.j ?? null);
}

/**
 * NY (Pub 718): combined rate per county, per city with its own tax, and NYC.
 * The MCTD 0.375% applies in NYC + Dutchess, Nassau, Orange, Putnam, Rockland,
 * Suffolk, Westchester and is reported separately, as Avalara does.
 */
const MCTD = new Set(["bronx", "kings", "newyork", "queens", "richmond", "dutchess", "nassau", "orange", "putnam", "rockland", "suffolk", "westchester"]);
const NYC = new Set(["bronx", "kings", "newyork", "queens", "richmond"]);

export function buildNY(): StateBuild {
  const counties = new Map<string, { name: string; code: string; combined: number }>();
  const cities = new Map<string, { name: string; code: string; combined: number }>(); // key: county#city
  for (const r of directoryRows("NY")) {
    const c = num(r.combined_rate);
    if (c == null) continue;
    const row = { name: r.jurisdiction_name, code: r.official_code, combined: c };
    if (r.jurisdiction_type === "county" || r.jurisdiction_type === "borough") counties.set(normPlace(r.county_name), row);
    else if (r.jurisdiction_type === "city") cities.set(`${normPlace(r.county_name)}#${normPlace(r.jurisdiction_name)}`, row);
  }
  const notes: string[] = [];
  const b = finish(
    "NY",
    SRC("NY"),
    (p) => {
      const co = normPlace(p.countyName);
      const city = p.placeType === "incorporated" ? cities.get(`${co}#${normPlace(p.placeName)}`) : undefined;
      const area = city ?? counties.get(co);
      if (!area) return null;
      const mctd = MCTD.has(co) ? 0.00375 : 0;
      const local = round6(area.combined - 0.04 - mctd);
      const j: Juris[] = [...stateOnly("NY", "New York", 0.04)];
      if (NYC.has(co)) j.push({ type: "City", name: "New York City", code: "8081", rate: local });
      else j.push({ type: city ? "City" : "County", name: area.name, code: area.code || null, rate: local });
      if (mctd) j.push({ type: "Special", name: "Metropolitan Commuter Transportation District", code: null, rate: mctd });
      return j;
    },
    notes,
  );
  return b;
}
