/**
 * Illinois, from IDOR's machine-readable rate files (data/rates/raw/IL/):
 *   ordmache-current.txt  location file: one record per location code (municipality,
 *                         or xxx-5000-x = unincorporated county), Receipts General
 *                         Merchandise high rate at cols 70-74 (v99999)
 *   ordmacha-current.txt  address file: for locations whose override flag is Y the
 *                         rate varies by business district; the record with a blank
 *                         address is the location's default rate (exactly one each)
 * https://tax.illinois.gov/content/dam/soi/en/web/tax/research/taxrates/documents/salestaxrates/
 * Falls back to the jurisdiction directory (same IDOR source) only if a file is missing.
 *
 * Regime, chosen with RATES_IL_MODE:
 *  - "rot" (default): destination Retailers' Occupation Tax = state + all locally
 *    imposed ROT at the delivery address. Required of remote retailers over the
 *    $100,000 / 200-transaction threshold (Leveling the Playing Field, 86 Ill. Adm.
 *    Code 131.110; IDOR: remote retailers "must use the Search by Address option to
 *    find local tax rates").
 *  - "use": 6.25% state only - what the store's Avalara account charged Jul-Sep 2026.
 *    Kept only to reproduce those filings; it is not the current law for this seller.
 */
import { existsSync, readFileSync } from "node:fs";
import { rawFile, round6, STATE_NAMES, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { zipRowsFromPieces, type Piece, type PieceRate } from "../lib/geo";
import { impliedStateRate, normCounty, normPlace, num } from "./_il-mo-co-util";

const EFFECTIVE = "2026-10-01";

const ORPHAN_NOTES: string[] = [];

type Loc = { code: string; name: string; county: string; rate: number; effective: string; isCounty: boolean };

const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

/** IDOR files -> locations; null when the files are not downloaded. */
function idorLocations(): Loc[] | null {
  const fe = rawFile("IL", "ordmache-current.txt"), fa = rawFile("IL", "ordmacha-current.txt");
  if (!existsSync(fe) || !existsSync(fa)) return null;
  const dflt = new Map<string, { rate: number; eff: string }>();
  for (const l of readFileSync(fa, "latin1").split(/\r?\n/)) {
    if (l.length < 111 || l.slice(63, 98).trim()) continue;
    dflt.set(l.slice(0, 10), { rate: Number(l.slice(106, 111)) / 1e5, eff: l.slice(98, 106) });
  }
  const out: Loc[] = [];
  const orphans: { code: string; name: string; county: string }[] = [];
  for (const l of readFileSync(fe, "latin1").split(/\r?\n/)) {
    if (l.length < 74) continue;
    const code = l.slice(0, 10), flag = l[60];
    let rate = Number(l.slice(69, 74)) / 1e5, eff = l.slice(61, 69);
    if (flag === "Y") {
      const d = dflt.get(code);
      if (!d) {
        // e.g. Columbia's St. Clair County portion (082-0074-2): flagged, but no address records at all
        orphans.push({ code, name: l.slice(10, 35).trim(), county: l.slice(35, 60).trim() });
        continue;
      }
      rate = d.rate;
      eff = d.eff;
    }
    out.push({ code, name: l.slice(10, 35).trim(), county: l.slice(35, 60).trim(), rate, effective: iso(eff), isCounty: code.slice(4, 8) === "5000" });
  }
  // an orphan takes the rate of the same municipality's location in its other county
  for (const o of orphans) {
    const twin = out.find((x) => !x.isCounty && x.name === o.name);
    if (twin) out.push({ ...twin, code: o.code, county: o.county });
    ORPHAN_NOTES.push(`${o.code} ${o.name} (${o.county}): no ordmacha default rate; ${twin ? `used ${twin.code} (${twin.county}) ${twin.rate}` : "left unrated (falls to county)"}`);
  }
  return out;
}

function directoryLocations(): Loc[] {
  return directoryRows("IL")
    .filter((r) => (r.jurisdiction_type === "municipality" || r.jurisdiction_type === "county") && num(r.combined_rate) != null)
    .map((r) => ({
      code: r.official_code,
      name: r.jurisdiction_name.replace(/\s*\(unincorporated\)/i, ""),
      county: r.county_name,
      rate: num(r.combined_rate)!,
      effective: EFFECTIVE,
      isCounty: r.jurisdiction_type === "county",
    }));
}

export async function build(): Promise<StateBuild> {
  const mode = (process.env.RATES_IL_MODE ?? "rot").toLowerCase();
  if (mode !== "use" && mode !== "rot") throw new Error(`RATES_IL_MODE must be "use" or "rot", not ${mode}`);
  const stateRate = impliedStateRate(directoryRows("IL"));
  const stateJ = (): Juris => ({ type: "State", name: STATE_NAMES.IL, code: "IL", rate: stateRate });
  const notes = [`mode ${mode}; state rate ${stateRate}`];

  if (mode === "use") {
    const { rows } = zipRowsFromPieces("IL", "IL state use tax 6.25% only (legacy Avalara behaviour)", () => ({ jurisdictions: [stateJ()], effectiveFrom: EFFECTIVE }));
    return { state: "IL", source: "IL state rate only (RATES_IL_MODE=use)", rows, notes };
  }

  const idor = idorLocations();
  const locs = idor ?? directoryLocations();
  notes.push(idor ? `IDOR ordmache/ordmacha files: ${locs.length} locations` : "IDOR files missing - fell back to the directory copy", ...ORPHAN_NOTES);
  const county = new Map<string, Loc>();
  const muni = new Map<string, Loc>();
  for (const l of locs) {
    if (l.isCounty) county.set(normCounty(l.county), l);
    else if (!muni.has(`${normCounty(l.county)}|${normPlace(l.name)}`)) muni.set(`${normCounty(l.county)}|${normPlace(l.name)}`, l);
  }

  const missing = new Set<string>();
  const rate = (p: Piece): PieceRate | null => {
    const co = county.get(normCounty(p.countyName));
    const m = p.placeType === "incorporated" ? muni.get(`${normCounty(p.countyName)}|${normPlace(p.placeName)}`) : undefined;
    if (p.placeType === "incorporated" && !m) missing.add(`${p.placeName} (${p.countyName})`);
    const loc = m ?? co;
    if (!loc) return null;
    const local = round6(loc.rate - stateRate);
    // IDOR publishes combined rates only. County-level taxes (county ROT, RTA, MED,
    // public safety, school facility) reach the municipalities too, so the county's
    // unincorporated local rate is reported as the county part, the rest as city.
    const countyPart = Math.min(co ? round6(co.rate - stateRate) : 0, local);
    const j: Juris[] = [stateJ(), { type: "County", name: `${p.countyName} County`, code: co?.code ?? null, rate: round6(countyPart) }];
    if (m) j.push({ type: "City", name: p.placeName, code: m.code, rate: round6(local - countyPart) });
    return { jurisdictions: j, effectiveFrom: loc.effective };
  };
  const { rows, unrated } = zipRowsFromPieces("IL", "IDOR ordmache/ordmacha (destination ROT)", rate);
  if (unrated.length) notes.push(`${unrated.length} pieces unrated`);
  if (missing.size) notes.push(`${missing.size} incorporated places with no IDOR location (rated as unincorporated county): ${[...missing].slice(0, 15).join("; ")}`);
  return { state: "IL", source: `IDOR machine-readable rate files${idor ? "" : " (directory copy)"} - destination ROT`, rows, notes };
}
