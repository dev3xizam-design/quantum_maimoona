/**
 * Alabama: state 4% + local SELLERS USE tax, as a remote seller filing Form 2100
 * (ONE SPOT) collects it.
 *
 * Law: a remote seller over $250k must either (a) enroll in the Simplified Sellers
 * Use Tax program and collect a flat 8% (Form 2620; it replaces all state and local
 * tax, Code of Ala. 40-23-191..199), or (b) collect state + local sellers use tax at
 * the destination (Form 2100 / ONE SPOT). Quantum has this store registered on
 * Form 2100 (src/lib/seed-data.ts), i.e. (b). Never state-only - see sources/AL.md.
 * If the store is in fact enrolled in SSUT, switch to SSUT_RATE below.
 *
 * Rates: ALDOR "taxrates_current.csv" (Updated for October 2026), TaxType SU,
 * Rate Type GENER, from https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/
 * saved in raw/AL/. Layout per https://www.revenue.alabama.gov/sales-use/taxrates-file-help/
 * (Rate is a percentage; LocalityCode 7xxx = county, 9xxx = municipality; a municipality
 * row per county it lies in, whose CountyCode names the county locality code that
 * applies inside its corporate limits).
 *
 * Per Census piece:
 *  - incorporated place with a municipal SU row -> City = that rate, County = the rate
 *    of the county locality its CountyCode names (for the piece's county).
 *  - incorporated place without a municipal SU row (the town levies no sellers use) ->
 *    County = the county's corporate-limits code when the county has exactly one, else
 *    its general code.
 *  - outside places -> County = the county's general (70xx, unless it names CL/PJ) plus
 *    every UNINC/EXC/"county-wide" code of that county.
 * Police-jurisdiction rates are not applied: PJs have no Census geography (boundary
 * ambiguity, noted in sources/AL.md).
 */
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { AS_OF, AS_OF_NUM, normCity, rawFile, round6, titleCase, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { zipRowsFromPieces, type Piece } from "../lib/geo";

/** Flat SSUT rate (Code of Ala. 40-23-193(a)) - used only if the store is enrolled in SSUT. */
export const SSUT_RATE = 0.08;

type Loc = { code: string; name: string; countyNo: string; countyCode: string; rate: number };

function readSellersUse(): Loc[] {
  const text = readFileSync(rawFile("AL", "taxrates_current.csv"), "utf8").replace(/^﻿/, "");
  const rows = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data;
  return rows
    .filter((r) => r.TaxType === "SU" && r["Rate Type"] === "GENER")
    .filter((r) => Number(r["Active Date"]) <= AS_OF_NUM && (!r["Inactive Date"] || Number(r["Inactive Date"]) > AS_OF_NUM))
    .map((r) => ({
      code: r["Locality Code"],
      name: r["Locality Name"].trim(),
      countyNo: r["County Number"],
      countyCode: r["County Code"] ?? "",
      rate: round6(Number(r.Rate) / 100),
    }));
}

/** "ST CLAIR COUNTY CL PELL CITY" | "MADISON CO EXC CL HUNTSVILLE" -> "ST CLAIR" | "MADISON" */
const countyOfName = (n: string) => /^(.*?)\s+(COUNTY|CO)\b/.exec(n)?.[1] ?? null;

export async function build(): Promise<StateBuild> {
  const st = directoryRows("AL").find((r) => r.jurisdiction_type === "state");
  const stRate = Number(st?.combined_rate || st?.local_rate);
  if (!(stRate > 0)) throw new Error("AL: no state row with a rate in the jurisdiction directory");
  const state: Juris = { type: "State", name: "Alabama", code: "AL", rate: stRate };

  const su = readSellersUse();
  const county = new Map<string, Loc>(); // locality code -> county row
  const countiesByNo = new Map<string, Loc[]>();
  const munis = new Map<string, Loc[]>(); // normalised name -> one row per county it lies in
  for (const l of su) {
    if (l.code.startsWith("7")) {
      county.set(l.code, l);
      countiesByNo.set(l.countyNo, [...(countiesByNo.get(l.countyNo) ?? []), l]);
    } else munis.set(normCity(l.name), [...(munis.get(normCity(l.name)) ?? []), l]);
  }
  const countyNoOf = (code: string) => county.get(code)?.countyNo;
  // ALDOR county numbers are alphabetical but not FIPS order ("SHELBY" 58 < "ST CLAIR" 59), so match by name
  const noByName = new Map<string, string>();
  for (const l of county.values()) {
    const n = countyOfName(l.name);
    if (n && !noByName.has(normCity(n))) noByName.set(normCity(n), l.countyNo);
  }
  const isCL = (l: Loc) => /\bCL\b/.test(l.name);
  const isPJ = (l: Loc) => /\bPJ\b/.test(l.name);
  const general = (no: string) => (countiesByNo.get(no) ?? []).filter((l) => l.code.slice(0, 2) === "70" && !isCL(l) && !isPJ(l));
  const isUninc = (l: Loc) => /\b(UNINC|UNINCORP)\b/.test(l.name);
  /** Codes that apply outside every municipality: the plain county code plus every
   *  "UNINC" / "EXC <cities>" / "COUNTY-WIDE" code (Escambia 2% + 5% "EXC 5 CITIES"). */
  const unincorporated = (no: string) =>
    (countiesByNo.get(no) ?? []).filter((l) => /\b(UNINC|UNINCORP|EXC|COUNTY-WIDE)\b/.test(l.name) || (l.code.slice(0, 2) === "70" && !isCL(l) && !isPJ(l)));
  /** County codes that apply inside a town's corporate limits: the town's links minus its
   *  police-jurisdiction codes, and minus "UNINC" codes when it also links a CL code. */
  const insideCity = (links: Loc[]) => {
    const notPj = links.filter((l) => !isPJ(l));
    const keep = notPj.some(isCL) ? notPj.filter((l) => !isUninc(l)) : notPj;
    return keep.length ? keep : links;
  };
  const cj = (l: Loc): Juris => ({ type: "County", name: titleCase(l.name), code: l.code, rate: l.rate });

  const stat = { muni: 0, muniNoSu: 0, uninc: 0, noCounty: new Set<string>() };
  const rate = (p: Piece) => {
    const no = noByName.get(normCity(p.countyName)) ?? "";
    if (!countiesByNo.has(no)) stat.noCounty.add(p.countyName);
    const j: Juris[] = [state];
    if (p.placeType === "incorporated") {
      const rows = munis.get(normCity(p.placeName)) ?? [];
      const here = rows.filter((r) => countyNoOf(r.countyCode) === no);
      const m = here[0] ?? (rows.length === 1 && !rows[0].countyCode ? rows[0] : undefined);
      if (m) {
        stat.muni++;
        j.push({ type: "City", name: titleCase(m.name), code: m.code, rate: m.rate });
        j.push(...insideCity(here.map((r) => county.get(r.countyCode)!).filter(Boolean)).map(cj));
        return { jurisdictions: j, effectiveFrom: AS_OF };
      }
      stat.muniNoSu++;
      const cls = (countiesByNo.get(no) ?? []).filter(isCL);
      j.push(...(cls.length === 1 ? cls : general(no)).map(cj));
      return { jurisdictions: j, effectiveFrom: AS_OF };
    }
    stat.uninc++;
    j.push(...unincorporated(no).map(cj));
    return { jurisdictions: j, effectiveFrom: AS_OF };
  };

  const source = "ALDOR taxrates_current.csv (Updated for October 2026), sellers use GENER + state 4%";
  const { rows, unrated } = zipRowsFromPieces("AL", source, rate);
  return {
    state: "AL",
    source,
    rows,
    notes: [
      `${su.length} sellers-use rows; pieces: municipality ${stat.muni}, town without SU ${stat.muniNoSu}, outside towns ${stat.uninc}`,
      `unrated ${unrated.length}${stat.noCounty.size ? `; counties without SU rows: ${[...stat.noCounty].join(", ")}` : ""}`,
    ],
  };
}
