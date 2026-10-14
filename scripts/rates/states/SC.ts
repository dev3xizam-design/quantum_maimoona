/**
 * South Carolina: state 6% + SCDOR local taxes, all from the SC rows of
 * data/jurisdictions/us-jurisdictions.csv (ST-389 local tax codes).
 *
 * Per Census piece (county + incorporated place):
 *  - State 6%.
 *  - County-wide taxes (Capital Projects, Education Capital Improvement, School
 *    District, Transportation): every address in the county -> "Special"
 *    (Avalara reports them as Special Tax Jurisdictions).
 *  - Local Option tax, only in counties that levy it (the county has an
 *    "unincorporated" LO code): inside a municipality -> "City" (the
 *    municipality's LO code), outside -> "County" (the unincorporated code).
 *  - Municipal Tourism Development Tax (Myrtle Beach) -> "City", inside that
 *    place only.
 * Not modelled: the Catawba tribal tax (reservation land is not a Census
 * place, so it cannot be located from ZIP evidence).
 */
import { existsSync, readFileSync } from "node:fs";
import { AS_OF, normCity, rawFile, round6, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { zipRowsFromPieces, type Piece } from "../lib/geo";

const countyKey = (s: string) => normCity(s.replace(/\s+County$/i, ""));
/** "Mount Pleasant - Local Option Sales & Use Tax" -> "Mount Pleasant" */
const head = (s: string) => s.split(" - ")[0].replace(/\s*\(unincorporated\)\s*$/i, "").trim();
const inForce = (from: string) => !from || from <= AS_OF;

/**
 * SCDOR's official combined rate per county, from the local-rate table on
 * https://dor.sc.gov/sales-and-use (saved as raw/SC/sales-and-use.html): the newest
 * column whose start date is on or before AS_OF.
 */
function officialCountyTotals(): Map<string, number> | null {
  const file = rawFile("SC", "sales-and-use.html");
  if (!existsSync(file)) return null;
  const html = readFileSync(file, "utf8");
  const table = /<table[\s\S]*?<\/table>/.exec(html)?.[0];
  if (!table) return null;
  const cells = (tr: string) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
  const trs = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => cells(m[0]));
  // header cells look like "5/1/26 & after" | "7/1/25 - 4/30/26": pick the newest start <= AS_OF
  const starts = trs[0].map((h) => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})/.exec(h);
    return m ? `20${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
  });
  const col = starts.reduce<number>((best, d, i) => (d && d <= AS_OF && (best < 0 || d > starts[best]!) ? i : best), -1);
  if (col < 0) return null;
  const out = new Map<string, number>();
  // keyed by the raw name ("Horry-Myrtle Beach" stays splittable)
  for (const r of trs.slice(1)) if (r[col]?.endsWith("%")) out.set(r[0], round6(Number(r[col].replace("%", "")) / 100));
  return out;
}

export async function build(): Promise<StateBuild> {
  // the directory CSV carries effective dates; DirRow just does not declare them
  const dir = (directoryRows("SC") as (ReturnType<typeof directoryRows>[number] & { effective_from?: string; effective_to?: string })[])
    .filter((r) => inForce(r.effective_from ?? "") && !r.effective_to);
  const stRow = dir.find((r) => r.jurisdiction_type === "state");
  const stRate = Number(stRow?.combined_rate || stRow?.local_rate);
  if (!(stRate > 0)) throw new Error("SC: no state rate in the jurisdiction directory");
  const state: Juris = { type: "State", name: "South Carolina", code: "SC", rate: stRate };

  const countywide = new Map<string, Juris[]>();
  const uncLO = new Map<string, Juris>();
  const muniLO = new Map<string, { county: string; j: Juris }[]>();
  const cityExtra = new Map<string, Juris[]>();
  const add = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v]);

  for (const r of dir) {
    const rate = Number(r.local_rate);
    if (!(rate > 0)) continue;
    const co = countyKey(r.county_name);
    const code = r.official_code || null;
    switch (r.jurisdiction_type) {
      case "county":
        add(countywide, co, { type: "Special", name: r.jurisdiction_name, code, rate });
        break;
      case "unincorporated":
        uncLO.set(co, { type: "County", name: r.jurisdiction_name, code, rate });
        break;
      case "municipality":
        add(muniLO, normCity(head(r.jurisdiction_name)), { county: co, j: { type: "City", name: r.jurisdiction_name, code, rate } });
        break;
      case "city":
        add(cityExtra, normCity(head(r.jurisdiction_name)), { type: "City", name: r.jurisdiction_name, code, rate });
        break;
    }
  }

  // the directory must agree with SCDOR's current combined county rates (Myrtle Beach's
  // extra 1% TDT row is "Horry-Myrtle Beach" in the table and is checked by name)
  const official = officialCountyTotals();
  const stale: string[] = [];
  if (official)
    for (const [co, total] of official) {
      const [county, city] = co.split(/\s*-\s*/).map((x) => normCity(x));
      const ours = round6(stRate + (countywide.get(county) ?? []).reduce((t, j) => t + j.rate, 0) + (uncLO.get(county)?.rate ?? 0) + (city ? (cityExtra.get(city) ?? []).reduce((t, j) => t + j.rate, 0) : 0));
      if (ours !== total) stale.push(`${co}: directory ${ours} vs SCDOR ${total}`);
    }
  if (stale.length) throw new Error(`SC: jurisdiction directory disagrees with SCDOR's current county rates - update the SC rows:\n  ${stale.join("\n  ")}`);

  let loGuessed = 0;
  const rate = (p: Piece) => {
    const co = countyKey(p.countyName);
    const j: Juris[] = [state, ...(countywide.get(co) ?? [])];
    const place = p.placeType === "incorporated" ? normCity(p.placeName) : null;
    const lo = uncLO.get(co);
    if (place) {
      const munis = muniLO.get(place) ?? [];
      const own = munis.find((m) => m.county === co);
      // a town's LO code applies where its county levies LO; a code listed under another
      // county still names the town (multi-county towns appear once in the SCDOR list)
      if (lo) {
        const m = own ?? munis[0];
        if (m) j.push(m.j);
        else {
          loGuessed++;
          j.push({ ...lo, type: "City", name: `${p.placeName} (county LO code)` });
        }
      } else if (own) j.push(own.j);
      j.push(...(cityExtra.get(place) ?? []));
    } else if (lo) j.push(lo);
    return { jurisdictions: j, effectiveFrom: AS_OF };
  };

  const source = "us-jurisdictions.csv SC rows (SCDOR ST-389 local tax codes) + Census 2020 ZIP pieces";
  const { rows, unrated } = zipRowsFromPieces("SC", source, rate);
  const notes = [
    official ? `checked against SCDOR combined county rates (${official.size} rows): all agree` : "WARNING: raw/SC/sales-and-use.html missing - county totals not checked",
    `state ${round6(stRate)}; ${countywide.size} counties with county-wide taxes, ${uncLO.size} with Local Option, ${muniLO.size} municipal LO codes`,
    `${loGuessed} incorporated pieces in LO counties had no municipal LO code (county LO rate used); ${unrated.length} unrated pieces`,
  ];
  return { state: "SC", source, rows, notes };
}
