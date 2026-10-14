/**
 * Missouri, from the DOR sales/use tax rate chart rows in the jurisdiction
 * directory (code PPPPP-CCC-SSS: place, county FIPS, district suffix).
 *
 * A remote seller shipping into Missouri collects the VENDOR'S USE TAX, not the
 * sales tax, so the rate used is the chart's use rate (directory combined_rate).
 * Many local sales taxes have no matching use tax - the store's Avalara history
 * agrees (e.g. St. Louis County 0%, Ballwin 0%, Creve Coeur 1.25%).
 *
 * Each Census piece maps to the base (suffix 000) row of its city in its county,
 * or to the county's unincorporated row (place 00000). CID/TDD district rows
 * (suffix > 000) cover single shopping centres and are not mapped by ZIP.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { RAW, round6, STATE_NAMES, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { zipRowsFromPieces, type PieceRate } from "../lib/geo";
import { impliedStateRate, normPlace, num, type DirRow } from "./_il-mo-co-util";

const EFFECTIVE = "2026-10-01";

/**
 * A newer DOR chart dropped into data/rates/raw/MO/ (e.g. october2026.xlsx, from
 * https://dor.mo.gov/pdf/rates/2026/october2026.xlsx) overrides the directory's
 * use rates code by code. dor.mo.gov blocks this machine, so it must be
 * downloaded by hand. Returns code -> use rate, plus the file used.
 */
async function newerChart(): Promise<{ file: string; use: Map<string, number> } | null> {
  const dir = path.join(RAW, "MO");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /^[a-z]+20\d\d\.xlsx$/i.test(f) && !/^july2026/i.test(f));
  const order = ["january", "april", "july", "october"];
  const key = (f: string) => Number(f.match(/(\d{4})/)![1]) * 10 + order.findIndex((m) => f.toLowerCase().startsWith(m));
  const file = files.sort((a, b) => key(b) - key(a))[0];
  if (!file) return null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(dir, file));
  const use = new Map<string, number>();
  for (const ws of wb.worksheets) {
    let iCode = -1, iUse = -1;
    ws.eachRow((row) => {
      const cells = (row.values as unknown[]).map((v) => String((v as { text?: string })?.text ?? v ?? "").trim());
      if (iCode < 0) {
        iCode = cells.findIndex((c) => /jurisdiction code/i.test(c));
        iUse = cells.findIndex((c) => /use tax rate/i.test(c));
        if (iCode < 0 || iUse < 0) iCode = iUse = -1;
        return;
      }
      const code = cells[iCode], r = Number(cells[iUse]);
      if (/^\d{5}-\d{3}-\d{3}$/.test(code) && Number.isFinite(r)) use.set(code, r > 0.15 ? r / 100 : r);
    });
  }
  if (!use.size) throw new Error(`MO: ${file} has no "Jurisdiction Code" / "Use Tax Rate" columns`);
  return { file, use };
}

/** "CREVE COEUR (X1) / ST LOUIS COUNTY / ..." -> "CREVE COEUR" */
const placeOf = (name: string) => name.split(" / ")[0];

export async function build(): Promise<StateBuild> {
  let rows = directoryRows("MO").filter((r) => /^\d{5}-\d{3}-\d{3}$/.test(r.official_code) && num(r.combined_rate) != null);
  const stateRate = impliedStateRate(rows);
  const notes: string[] = [`state rate ${stateRate} (combined - local on the chart rows)`];
  let source = "MO DOR rate chart July 2026 (TA0300, updated 5/22/2026) via data/jurisdictions/us-jurisdictions.csv - October 2026 chart NOT applied";
  const newer = await newerChart();
  if (newer) {
    let changed = 0;
    rows = rows.map((r) => {
      const u = newer.use.get(r.official_code);
      if (u == null || Math.abs(u - num(r.combined_rate)!) < 1e-9) return r;
      changed++;
      return { ...r, combined_rate: String(u), local_rate: String(round6(u - stateRate)) };
    });
    const added = [...newer.use.keys()].filter((c) => !rows.some((r) => r.official_code === c)).length;
    notes.push(`${newer.file}: ${changed} use rates changed vs July 2026, ${added} new codes not in the directory (not mapped)`);
    source = `MO DOR rate chart ${newer.file} over July 2026 directory rows`;
  }

  // base rows (suffix 000) first, so a district row only stands in where no base row exists
  const ordered = rows.slice().sort((a, b) => (a.official_code.slice(-3) < b.official_code.slice(-3) ? -1 : a.official_code.slice(-3) > b.official_code.slice(-3) ? 1 : 0));
  const countyRow = new Map<string, DirRow>(); // county code -> unincorporated row
  const cityRows = new Map<string, DirRow[]>(); // county code|normPlace -> rows (annex variants X1..Xn share the rate)
  for (const r of ordered) {
    const [pl, co, sfx] = r.official_code.split("-");
    if (pl === "00000") {
      // several 00000 rows per county (e.g. "ST LOUIS COUNTY (T1)"): plain base row wins
      const cur = countyRow.get(co);
      const paren = (x: DirRow) => /\(/.test(placeOf(x.jurisdiction_name));
      if (!cur || (cur.official_code.slice(-3) === sfx && paren(cur) && !paren(r))) countyRow.set(co, r);
      continue;
    }
    const k = `${co}|${normPlace(placeOf(r.jurisdiction_name))}`;
    const a = cityRows.get(k) ?? [];
    // villages wholly inside a district (Byrnes Mill, St. Cloud) only have suffix > 000 rows
    if (sfx === "000" || !a.length || !a[0].official_code.endsWith("-000")) a.push(r);
    cityRows.set(k, a);
  }

  const useRate = (r: DirRow) => num(r.combined_rate)!;
  const title = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

  const missCity = new Set<string>();
  // DOR still codes Ste. Genevieve County with its pre-1979 FIPS 193 (Census: 186)
  const dorCounty = (fips: string) => (fips === "186" ? "193" : fips);
  const rate = (p: Parameters<Parameters<typeof zipRowsFromPieces>[2]>[0]): PieceRate | null => {
    const co = countyRow.get(dorCounty(p.countyFips));
    const countyLocal = co ? round6(useRate(co) - stateRate) : 0;
    const countyName = co ? title(placeOf(co.jurisdiction_name)) : p.countyFips === "510" ? "St. Louis City" : `${p.countyName} County`;
    let city: DirRow | undefined;
    if (p.placeType === "incorporated") {
      const cands = cityRows.get(`${dorCounty(p.countyFips)}|${normPlace(p.placeName)}`);
      // prefer the plain row over annex variants "(X1)"; rates are identical in practice
      city = cands?.slice().sort((a, b) => Number(/\(/.test(a.jurisdiction_name)) - Number(/\(/.test(b.jurisdiction_name)))[0];
    }
    if (p.placeType === "incorporated" && !city) missCity.add(`${p.placeName} (${p.countyName})`);
    if (!co && !city) return null;
    const total = city ? useRate(city) : useRate(co!);
    const local = round6(total - stateRate);
    // the chart publishes only the combined use rate; split it as county (its own
    // unincorporated use rate, capped at the total) + city (the rest)
    const county = Math.min(countyLocal, local);
    const j: Juris[] = [{ type: "State", name: STATE_NAMES.MO, code: "MO", rate: stateRate }];
    j.push({ type: "County", name: countyName, code: co?.official_code ?? null, rate: round6(county) });
    if (city) j.push({ type: "City", name: title(placeOf(city.jurisdiction_name).replace(/\s*\([^)]*\)/g, "")), code: city.official_code, rate: round6(local - county) });
    else if (local - county > 1e-9) j.push({ type: "Special", name: `${countyName} districts`, code: co!.official_code, rate: round6(local - county) });
    return { jurisdictions: j, countyName, effectiveFrom: EFFECTIVE };
  };

  const { rows: out, unrated } = zipRowsFromPieces("MO", "MO DOR vendor's use tax rate chart", rate);
  if (unrated.length) notes.push(`${unrated.length} Census pieces unrated (no chart row for county FIPS ${[...new Set(unrated.map((p) => p.countyFips))].join(",")})`);
  return { state: "MO", source, rows: out, notes: [...notes, ...(missCity.size ? [`${missCity.size} incorporated places without a chart row (rated at county): ${[...missCity].slice(0, 12).join("; ")}`] : [])] };
}
