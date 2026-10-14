/**
 * California: CDTFA tax area rates in force on 2026-10-01.
 *
 * Sources (data/rates/raw/CA, see data/rates/sources/CA.md for how to refetch):
 *   tac-layer.json             CDTFA's "Find Your Tax Rate" ArcGIS layer (California_Sales_and_Use_Tax_Rates,
 *                              DateStamp 2026-10-01): one feature per 12-char tax area code (TAC) with
 *                              RATE = StateRate 7.25% + CountyRate (county-imposed district taxes)
 *                              + CityRate (city/area-imposed district taxes).  PRIMARY.
 *   SalesTaxRates10-1-26.xlsx  CDTFA "Effective Sales and Use Tax Rates" October 2026 city / county list.
 *                              Every city and unincorporated rate must agree with the layer, or the build fails.
 * Quantum's jurisdiction directory (Q3 2026 CDTFA data) is read only for the rate each
 * area had before 2026-10-01 (prev_total_rate, validation only).
 *
 * A local tax area is a city (5-digit code CCnnn) or a county's unincorporated area (CC998).
 * Census pieces map to areas by place: incorporated place -> that city (name match, same
 * county first); anything else (CDP or no place) -> the county's unincorporated area.
 *
 * Jurisdictions mirror how Avalara itemises CA (the cross-check):
 *   State   California                         6.00%
 *   County  <county>                           0.25%  (county Local Transportation Fund)
 *   Special <county> local tax (Bradley-Burns) 1.00%
 *   Special <county> district tax              CountyRate
 *   City    <city>                             CityRate (unincorporated-only taxes -> Special)
 * Avalara names the 0.25% + 1% after the SELLER's county (Orange) because an in-state
 * seller's Bradley-Burns local tax is allocated to its place of business; this table is per
 * destination, so it names the ship-to county.
 *
 * Known limit: district taxes whose boundaries follow neither city nor county lines are not
 * modelled below the TAC level (CDTFA sub-area TACs all carry their city's rate anyway).
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { AS_OF, mustExist, normCity, RATE_CHANGES, RAW, round6, STATE_NAMES, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { statePieces, zipRowsFromPieces, type Piece, type PieceRate } from "../lib/geo";

const SOURCE = "CDTFA tax area rates 2026-10-01 (Find Your Tax Rate layer + October 2026 rate list)";
const LAYER = path.join(RAW, "CA", "tac-layer.json");
const XLSX = path.join(RAW, "CA", "SalesTaxRates10-1-26.xlsx");

type Area = {
  name: string;
  code: string; // 5-digit local tax area code
  county: string; // e.g. "Los Angeles"
  countyRate: number;
  cityRate: number;
  combined: number;
  effectiveFrom: string;
  isCity: boolean;
  prevTotal?: number;
};

type Feature = {
  JURIS_NAME: string;
  County_name: string;
  City_Name_Proper: string | null;
  RATE: number;
  START_DATE: number | null;
  TAC_txt: string;
  DateStamp: number;
  StateRate: number;
  CountyRate: number;
  CityRate: number;
};

const countyKey = (s: string) => normCity(s.replace(/\s+County$/i, ""));
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Census place name -> CDTFA city name, where they differ beyond normalisation. */
const PLACE_ALIASES: Record<string, string> = { ANGELS: "ANGELSCAMP" };

/** Census place names carry alternates and accents: "San Buenaventura (Ventura)", "La Cañada Flintridge". */
function placeKeys(name: string): string[] {
  const plain = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const keys = new Set<string>([normCity(plain)]);
  const m = plain.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (m) {
    keys.add(normCity(m[1]));
    keys.add(normCity(m[2]));
  }
  for (const k of [...keys]) if (PLACE_ALIASES[k]) keys.add(PLACE_ALIASES[k]);
  return [...keys];
}

function loadLayer(): Area[] {
  const doc = JSON.parse(readFileSync(mustExist(LAYER), "utf8")) as { features: { attributes: Feature }[] };
  const feats = doc.features.map((f) => f.attributes);
  // DateStamp is midnight Pacific, i.e. 07:00Z on the day
  const stamps = new Set(feats.map((f) => ymd(f.DateStamp)));
  if (stamps.size !== 1 || !stamps.has(AS_OF)) throw new Error(`CA: tac-layer.json DateStamp ${[...stamps].join(",")} is not ${AS_OF} - refetch it`);
  const byCode = new Map<string, Area>();
  for (const f of feats) {
    if (Math.abs(f.StateRate + f.CountyRate + f.CityRate - f.RATE) > 1e-9) throw new Error(`CA: TAC ${f.TAC_txt} rates do not add up`);
    if (Math.abs(f.StateRate - 0.0725) > 1e-9) throw new Error(`CA: TAC ${f.TAC_txt} state rate ${f.StateRate}`);
    const code = f.TAC_txt.slice(0, 5);
    const isCity = code.slice(2) !== "998";
    const a: Area = {
      name: isCity ? (f.City_Name_Proper ?? titleCase(f.JURIS_NAME)) : `${titleCase(f.County_name)} County Unincorporated Area`,
      code,
      county: titleCase(f.County_name),
      countyRate: round6(f.CountyRate),
      cityRate: round6(f.CityRate),
      combined: round6(f.RATE),
      effectiveFrom: f.START_DATE ? ymd(f.START_DATE) : AS_OF,
      isCity,
    };
    const prev = byCode.get(code);
    // sub-area TACs (last 4 digits != 0000) share their area's codes and rate
    if (prev && prev.combined !== a.combined) throw new Error(`CA: sub-areas of ${code} carry different rates`);
    if (!prev || f.TAC_txt.endsWith("0000")) byCode.set(code, a);
  }
  return [...byCode.values()];
}

/** The October 2026 rate list: "City" rows by name, "County" rows = the unincorporated area. */
async function crossCheck(areas: Area[]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(mustExist(XLSX));
  const ws = wb.worksheets[0];
  const list = new Map<string, number>();
  ws.eachRow((row, i) => {
    if (i < 4) return;
    const [loc, rate, county, type] = (row.values as unknown[]).slice(1, 5).map((v) => (v == null ? "" : String(v)));
    if (!loc || !rate || !type) return;
    // the list says "City of Commerce" / "City of Industry" where the layer says "Commerce" / "Industry"
    const key = type === "County" ? `U#${countyKey(county)}` : `C#${countyKey(county)}#${normCity(loc.replace(/^City of /i, ""))}`;
    list.set(key, Number(rate));
  });
  const problems: string[] = [];
  for (const a of areas) {
    const key = a.isCity ? `C#${countyKey(a.county)}#${normCity(a.name)}` : `U#${countyKey(a.county)}`;
    const r = list.get(key);
    if (r == null) problems.push(`${a.name} (${a.county}) not on the rate list`);
    else if (Math.abs(r - a.combined) > 1e-9) problems.push(`${a.name}: layer ${a.combined} vs rate list ${r}`);
  }
  // naming differences between the two CDTFA files are tolerated (reported); rate disagreements are not
  const rateProblems = problems.filter((p) => p.includes(" vs rate list "));
  if (rateProblems.length) throw new Error(`CA: layer disagrees with the October 2026 rate list:\n  ${rateProblems.join("\n  ")}`);
  return problems;
}

/** Q3 2026 combined rate per 5-digit code, from the directory (validation only). */
function q3Rates() {
  const m = new Map<string, number>();
  for (const r of directoryRows("CA")) if (r.jurisdiction_type === "city" || r.jurisdiction_type === "unincorporated") m.set(r.official_code, Number(r.combined_rate));
  return m;
}

function jurisdictions(a: Area, county: string): Juris[] {
  const cc = a.code.slice(0, 2);
  const j: Juris[] = [
    { type: "State", name: STATE_NAMES.CA, code: "CA", rate: 0.06 },
    { type: "County", name: `${county} County`, code: cc, rate: 0.0025 },
    { type: "Special", name: `${county} County local tax (Bradley-Burns)`, code: cc, rate: 0.01 },
  ];
  if (a.countyRate) j.push({ type: "Special", name: `${county} County district tax`, code: cc, rate: a.countyRate });
  if (a.cityRate) j.push({ type: a.isCity ? "City" : "Special", name: a.isCity ? a.name : `${a.name} district tax`, code: a.code, rate: a.cityRate });
  return j;
}

export async function build(): Promise<StateBuild> {
  const areas = loadLayer();
  const notes = (await crossCheck(areas)).map((p) => `rate list naming: ${p}`);

  const q3 = q3Rates();
  let changed = 0;
  for (const a of areas) {
    const before = q3.get(a.code);
    if (before != null && Math.abs(before - a.combined) > 1e-9) {
      a.prevTotal = before;
      changed++;
      RATE_CHANGES.push({ state: "CA", jurisdiction: a.name, from: before, to: a.combined, effective: AS_OF });
    }
  }
  notes.push(`${areas.length} tax areas; ${changed} changed rate on ${AS_OF}`);

  const cities = new Map<string, Area[]>();
  const unincorporated = new Map<string, Area>();
  for (const a of areas) {
    if (!a.isCity) unincorporated.set(countyKey(a.county), a);
    else
      for (const k of placeKeys(a.name)) {
        const list = cities.get(k) ?? [];
        list.push(a);
        cities.set(k, list);
      }
  }

  const unmatched = new Map<string, number>();
  const rate = (p: Piece): PieceRate | null => {
    const ck = countyKey(p.countyName);
    let area: Area | undefined;
    if (p.placeType === "incorporated") {
      const cands = placeKeys(p.placeName).flatMap((k) => cities.get(k) ?? []);
      area = cands.find((a) => countyKey(a.county) === ck) ?? cands[0];
      if (!area) {
        const k = `${p.placeName} (${p.countyName})`;
        unmatched.set(k, (unmatched.get(k) ?? 0) + p.pop);
      }
    }
    area ??= unincorporated.get(ck);
    if (!area) return null;
    const county = p.countyName.replace(/\s+County$/i, "");
    return {
      jurisdictions: jurisdictions(area, county),
      ...(area.isCity ? { cityName: area.name } : {}),
      countyName: county,
      effectiveFrom: area.effectiveFrom,
      prevTotal: area.prevTotal,
    };
  };

  const { rows, unrated } = zipRowsFromPieces("CA", SOURCE, rate, statePieces("CA"));
  if (unmatched.size) notes.push(`incorporated places with no CDTFA city (rated as unincorporated): ${[...unmatched].map(([k, v]) => `${k} pop ${v}`).join("; ")}`);
  if (unrated.length) notes.push(`${unrated.length} Census pieces in counties with no unincorporated area: ${[...new Set(unrated.map((p) => p.countyName))].join(", ")}`);
  return { state: "CA", source: SOURCE, rows, notes };
}
