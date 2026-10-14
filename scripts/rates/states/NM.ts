/**
 * New Mexico gross receipts tax, destination-sourced. Rates are read from TRD's
 * own schedule, data/rates/raw/NM/GRT-Rate-Schedule-2026-07-01.xlsx ("Gross
 * Receipts and Compensating Tax Rate Schedule, effective July 1, 2026 through
 * June 30, 2027"); location names/types/counties come from Quantum's
 * jurisdiction directory. Schedule rates are TOTAL rates (state + local) per
 * location code. See data/rates/sources/NM.md.
 *
 * Per Census piece: the municipality's location rate when the piece is in one
 * (matched by name + county, e.g. Rio Rancho has a Bernalillo and a Sandoval
 * code), else the county's "remainder of county" rate. Split as Avalara reports
 * it: State 4.875%, local in City for municipalities / County otherwise.
 * Tribal-land, TIF/TID and other district codes follow lines Census places
 * don't carry and are not applied.
 */
import ExcelJS from "exceljs";
import { AS_OF, mustExist, rawFile, round6, type Juris, type StateBuild } from "../lib/common";
import { zipRowsFromPieces, type Piece } from "../lib/geo";
import { byName, forCounty, nameKey, stateRates } from "./_tx-az-nm-util";

const STATE_RATE = 0.04875;
const RATE_FILE = "GRT-Rate-Schedule-2026-07-01.xlsx";
const EFFECTIVE = "2026-07-01";

/** location code -> total rate, from the schedule's (name, code, rate) rows */
async function scheduleRates(): Promise<Map<string, number>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(mustExist(rawFile("NM", RATE_FILE)));
  const m = new Map<string, number>();
  wb.worksheets[0].eachRow((row) => {
    const v = row.values as unknown[];
    const code = String(v[3] ?? "").trim();
    const raw = v[4];
    const rate = typeof raw === "number" ? raw : typeof raw === "object" && raw && "result" in raw ? Number((raw as { result: unknown }).result) : NaN;
    if (/^\d\d-\d{3}$/.test(code) && Number.isFinite(rate)) m.set(code, round6(rate));
  });
  return m;
}

export async function build(): Promise<StateBuild> {
  const sched = await scheduleRates();
  const all = stateRates("NM")
    .filter((r) => r.code && sched.has(r.code))
    .map((r) => ({ ...r, combined: sched.get(r.code!)! }));
  const counties = new Map(all.filter((r) => r.type === "county" && r.combined != null).map((r) => [r.county, r]));
  const cities = byName(all.filter((r) => r.type === "municipality" && r.combined != null));
  const notes: string[] = [];
  const noCity = new Set<string>();
  const noCounty = new Set<string>();

  function rate(p: Piece) {
    const j: Juris[] = [{ type: "State", name: "New Mexico", code: "NM", rate: STATE_RATE }];
    const city = p.placeType === "incorporated" ? forCounty(cities.get(nameKey(p.placeName)), p.countyName) : null;
    if (p.placeType === "incorporated" && !city) noCity.add(`${p.placeName} (${p.countyName})`);
    if (city) j.push({ type: "City", name: city.name.replace(/\s*\(.*\)$/, ""), code: city.code, rate: round6(city.combined! - STATE_RATE) });
    else {
      const county = counties.get(nameKey(p.countyName));
      if (!county) {
        noCounty.add(p.countyName);
        return null;
      }
      j.push({ type: "County", name: county.name.replace(/\s*\(.*\)$/, ""), code: county.code, rate: round6(county.combined! - STATE_RATE) });
    }
    return {
      jurisdictions: j.filter((x) => x.type === "State" || x.rate > 0),
      cityName: city ? city.name.replace(/\s*\(.*\)$/, "") : p.placeType === "none" ? null : p.placeName,
      effectiveFrom: EFFECTIVE,
    };
  }

  const source = `NM TRD ${RATE_FILE} (rates) + Quantum jurisdiction directory (names), Census 2020 ZCTA pieces`;
  notes.push(`${sched.size} location codes in the TRD schedule`);
  const { rows, unrated } = zipRowsFromPieces("NM", source, rate);
  if (unrated.length) notes.push(`${unrated.length} pieces unrated (no county row: ${[...noCounty].join(", ")})`);
  if (noCity.size) notes.push(`incorporated places with no municipality row (rated as county remainder): ${[...noCity].join("; ")}`);
  return { state: "NM", source, rows, notes };
}
