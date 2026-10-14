/**
 * Louisiana: state 5% + the destination local rate, as a remote seller collects it.
 *
 * Law: since 2020-07-01 a remote seller over $100k (or 200 transactions) must collect
 * state AND local tax at the actual destination rates and remit both to the Louisiana
 * Sales and Use Tax Commission for Remote Sellers (LA R.S. 47:302(W), 47:340; LDR /
 * Commission Remote Sellers FAQ Q7 + Q9, raw/LA/ldr-remote-sellers-faq.pdf). The old
 * 8.45% flat "direct marketer" rate (R.S. 47:302(K)) is only for sellers under the
 * threshold. A seller with physical presence is a dealer and owes state + local too.
 * So state-only collection is never correct for this store (see sources/LA.md).
 *
 * Local rates: the Commission's "Remittance Rates" table, filing period Oct-2026,
 * scraped from https://remotesellersfiling.louisiana.gov/lookup/lookup.aspx into
 * raw/LA/rsc-rates-2026-10.json (one rate per domicile code = the TOTAL local rate
 * of that area). State rate: LDR state row of the jurisdiction directory (5%).
 *
 * Per Census piece: parish by county name; inside an incorporated place the domicile
 * whose name is that municipality, else the parish's own domicile (code = parish
 * code, the unincorporated rate) - or, where a parish splits its unincorporated area
 * by ward, the ward row matching the Census county subdivision ("Ward 6").
 * EDDs / annexations / school and fire districts have no Census geography and are
 * not assigned (address-level boundaries; noted in sources/LA.md).
 */
import { readFileSync } from "node:fs";
import { AS_OF, normCity, rawFile, round6, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { zipRowsFromPieces, type Piece } from "../lib/geo";

type Dom = { parish_code: string; name: string; domicile: string; rate: number };

const PARISH_NAMES: Record<string, string> = {}; // filled from the Commission's parish list
/** Census "St. John the Baptist" is the Commission's "St. John Parish". */
const parishKey = (n: string) => normCity(n.replace(/\s+Parish$/i, "").replace(/^St\.? John the Baptist$/i, "St. John"));

/** A row describing (part of) the parish's unincorporated area, not a town or a district. */
const UNINC = /\b(unincorporated|rural|parish sales|balance of parish|outside|district \d|^district \d)\b/i;
const NOT_UNINC = /\b(EDD|annex|annexation|inside|within|econ|mall|common)\b/i;

/** "City of Cowley" | "Within the Town of Springfield" | "Jena Sales" | "Winn Parish Within the City of Winnfield" -> municipality name */
function muniName(n: string): string | null {
  let s = n
    .replace(/^.*?\bWithin the\s+/i, "")
    .replace(/^West Carroll Inside\s+/i, "")
    .replace(/^(City|Town|Village) of\s+/i, "")
    .replace(/\s+Inside Town Limits$/i, "")
    .replace(/\s+City limits in .* Parish$/i, "")
    .replace(/\s+(ONLY|Sales)$/i, "")
    .replace(/\s+&\s+Parish Hospital Dist\.?\s*#\d+$/i, "")
    .replace(/\s+including Tax Dist #\d+$/i, "")
    .trim();
  if (/\b(outside|EDD|E\.D\.D|annex|annexation|econ|district|dist\b|dist\.|ward|area|common|parish|school|fire|hosp|mall|corridor|DD)\b/i.test(s)) return null;
  return s || null;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
/** Ward numbers a row names, and whether it is an "except" row. */
function wards(n: string): { nums: number[]; except: boolean } | null {
  // whole-ward rows only: "Ward 1 Tax Dist. No 5" is a district inside a ward
  if (!/\bwards?\b/i.test(n) || /\bdist/i.test(n)) return null;
  const nums: number[] = [];
  for (const m of n.matchAll(/\b(\d{1,2}|I{1,3}|IV|VI{0,3}|IX|X)\b/g)) nums.push(ROMAN[m[1]] ?? Number(m[1]));
  return nums.length ? { nums, except: /\bexcept\b/i.test(n) } : null;
}

export async function build(): Promise<StateBuild> {
  const file = rawFile("LA", "rsc-rates-2026-10.json");
  const doms = JSON.parse(readFileSync(file, "utf8")) as Dom[];
  const stRow = directoryRows("LA").find((r) => r.jurisdiction_type === "state");
  const stRate = Number(stRow?.combined_rate || stRow?.local_rate);
  if (!(stRate > 0)) throw new Error("LA: no state rate in the jurisdiction directory");
  const state: Juris = { type: "State", name: "Louisiana", code: "LA", rate: stRate };

  const byParish = new Map<string, Dom[]>();
  for (const d of doms) byParish.set(d.parish_code, [...(byParish.get(d.parish_code) ?? []), d]);
  // parish names + codes from the Commission's own parish list (raw/LA/rsc-parishes.json)
  const parishes = JSON.parse(readFileSync(rawFile("LA", "rsc-parishes.json"), "utf8")) as { parish_code: string; name: string }[];
  for (const x of parishes) PARISH_NAMES[parishKey(x.name)] = x.parish_code;

  const stat = { muni: 0, parish: 0, ward: 0, noParishRow: new Set<string>(), unknownParish: new Set<string>(), ambiguous: new Set<string>() };
  const juris = (d: Dom, type: Juris["type"]): Juris[] => [state, { type, name: d.name, code: d.domicile, rate: round6(d.rate) }];

  const rate = (p: Piece) => {
    const pc = PARISH_NAMES[parishKey(p.countyName)];
    if (!pc) {
      stat.unknownParish.add(p.countyName);
      return null;
    }
    const rows = byParish.get(pc)!;
    if (p.placeType === "incorporated") {
      const want = normCity(p.placeName);
      const hits = rows.filter((d) => d.domicile !== pc && muniName(d.name) != null && normCity(muniName(d.name)) === want);
      if (hits.length) {
        stat.muni++;
        // an exact name beats a decorated one ("Shreveport" 0904 vs "Shreveport ONLY" 0809);
        // one parish lists a town twice (Dixie Inn 6007/6008): then the lower domicile code
        const exact = (d: Dom) => (normCity(d.name) === want ? 0 : 1);
        const d = hits.sort((a, b) => exact(a) - exact(b) || a.domicile.localeCompare(b.domicile))[0];
        return { jurisdictions: juris(d, "City"), cityName: p.placeName, effectiveFrom: AS_OF };
      }
    }
    // LA county subdivisions are wards; Census names them by number only ("6")
    const ward = /^(?:Ward\s+)?(\d+)$/i.exec(p.cousubName)?.[1];
    if (ward && p.placeType !== "incorporated") {
      const w = rows.find((d) => {
        const x = wards(d.name);
        return x && (x.except ? !x.nums.includes(Number(ward)) : x.nums.includes(Number(ward))) && !/\b(inside|within)\b/i.test(d.name);
      });
      if (w) {
        stat.ward++;
        return { jurisdictions: juris(w, "County"), effectiveFrom: AS_OF };
      }
    }
    const own = rows.find((d) => d.domicile === pc);
    if (own) {
      stat.parish++;
      return { jurisdictions: juris(own, "County"), effectiveFrom: AS_OF };
    }
    // no parish-wide row: the parish splits its unincorporated area ("RURAL SALES",
    // "North/South Unincorporated Area", "District 1/2"). One rate among them -> use it;
    // several -> boundary unknown from ZIP evidence, take the lowest code and count it.
    const cands = rows.filter((d) => UNINC.test(d.name) && !NOT_UNINC.test(d.name)).sort((a, b) => a.domicile.localeCompare(b.domicile));
    if (!cands.length) {
      stat.noParishRow.add(pc);
      return null;
    }
    if (new Set(cands.map((d) => d.rate)).size > 1) stat.ambiguous.add(`${pc} (${cands.map((d) => `${d.name} ${round6(d.rate * 100)}%`).join(" / ")})`);
    stat.parish++;
    return { jurisdictions: juris(cands[0], "County"), effectiveFrom: AS_OF };
  };

  const source = "LA Remote Sellers Commission remittance rates, filing period Oct-2026 (state 5% + destination local)";
  const { rows, unrated } = zipRowsFromPieces("LA", source, rate);
  return {
    state: "LA",
    source,
    rows,
    notes: [
      `${doms.length} domicile rates; pieces rated by municipality ${stat.muni}, ward ${stat.ward}, parish ${stat.parish}`,
      `unrated pieces ${unrated.length}` +
        (stat.noParishRow.size ? `; parishes with no own-code row: ${[...stat.noParishRow].join(", ")}` : "") +
        (stat.unknownParish.size ? `; unknown parishes: ${[...stat.unknownParish].join(", ")}` : ""),
      ...[...stat.ambiguous].map((a) => `unincorporated rate ambiguous, lowest code used: ${a}`),
    ],
  };
}
