/**
 * Colorado, from the CDOR rows in the jurisdiction directory:
 *  - DR 0800 location codes (city / town / unincorporated rows, code CC-NNNN) whose
 *    notes list the taxes levied at that code ("State 2.9, County 0.75, City 3.46,
 *    RTD 1, CD 0.1 = ..."), from CDOR's Jan-Jun 2025 spreadsheet;
 *  - DR 1002 July 2026 current rates on the county, city/town, transit and
 *    district rows, which override the 2025 numbers wherever they exist.
 *
 * Home-rule SELF-COLLECTED city taxes are left out: they are not collected through
 * CDOR, and the store's Avalara account never charged them (Denver, Aurora,
 * Arvada, Colorado Springs ... all show state + county + districts only).
 * State-collected city taxes (Burlington, Trinidad, Gunnison ...) are included.
 *
 * Census pieces carry county + place only, so where a city / unincorporated area
 * is split into several location codes (RTD vs CD-only, LIDs) the main code is
 * used: plain name first, then the one with no local-improvement qualifier.
 */
import { round6, STATE_NAMES, type Juris, type StateBuild } from "../lib/common";
import { directoryRows } from "../lib/directory";
import { zipRowsFromPieces, type Piece, type PieceRate } from "../lib/geo";
import { groupBy, normCounty, normPlace, num, type DirRow } from "./_il-mo-co-util";

const EFFECTIVE = "2026-10-01";

type Comp = { abbr: string; pct: number };

/** "Taxes at this code per ...: State 2.9, County 0.75, RTD 1 = 4.65% total" -> components */
function composition(notes: string): Comp[] | null {
  const m = notes.match(/Taxes at this code[^:]*:\s*([^=]+)=/);
  if (!m) return null;
  return m[1]
    .split(",")
    .map((s) => s.trim().match(/^([A-Za-z][A-Za-z ]*?)\s+([\d.]+)$/))
    .filter((x): x is RegExpMatchArray => !!x)
    .map((x) => ({ abbr: x[1].trim() === "Cnty" ? "County" : x[1].trim(), pct: Number(x[2]) })); // Conejos rows say "Cnty"
}

const isHomeRule = (r: DirRow) => /HOME RULE SELF-COLLECTED/i.test(r.notes);
/** Lower = more representative of the whole place. */
const variantPenalty = (r: DirRow) => {
  const q = r.jurisdiction_name.match(/\(([^)]*)\)/)?.[1] ?? "";
  if (!q) return 0;
  if (/LID|PIF|district|within|station|plaza|aeronautic|commercial/i.test(q)) return 3;
  if (/CD only|CD\)?$/i.test(q) && !/RTD/i.test(q)) return 2;
  return 1;
};

export async function build(): Promise<StateBuild> {
  const all = directoryRows("CO");
  const notes: string[] = [];
  const stateRow = all.find((r) => r.jurisdiction_type === "state");
  const stateRate = num(stateRow?.local_rate) ?? num(stateRow?.combined_rate);
  if (stateRate == null) throw new Error("CO: no state rate row");

  const countyRow = new Map<string, DirRow>();
  for (const r of all.filter((r) => r.jurisdiction_type === "county")) countyRow.set(normCounty(r.county_name), r);

  const locs = all.filter((r) => /^\d{2}-\d{4}$/.test(r.official_code));
  const locByCounty = groupBy(locs, (r) => normCounty(r.county_name));
  const districts = all.filter((r) => r.jurisdiction_type === "district" || r.jurisdiction_type === "transit");

  /** Current-rate row for a special-district abbreviation at a location. */
  function districtRow(abbr: string, loc: DirRow, countyName: string): DirRow | null {
    const named = districts.filter((d) => new RegExp(`naming this district:[^;]*\\b${loc.official_code}\\b`).test(d.notes));
    const byAbbr = (xs: DirRow[]) => xs.filter((d) => d.official_code.toUpperCase() === abbr.toUpperCase());
    for (const pool of [byAbbr(named), named.length === 1 ? named : []]) if (pool.length === 1) return pool[0];
    const same = byAbbr(districts);
    if (same.length === 1) return same[0];
    // score by DR 1002's boundary text / district name naming this location's place or county
    const place = normPlace(loc.jurisdiction_name.replace(/^Unincorporated.*$/i, ""));
    const words = (t: string) => t.split(/[^A-Za-z]+/).filter(Boolean);
    const mentions = (t: string, n: string) => !!n && words(t).some((_, i, w) => [1, 2, 3].some((k) => normPlace(w.slice(i, i + k).join(" ")) === n));
    const countyBase = countyName.replace(/ County$/i, "");
    const qualifier = normPlace(loc.jurisdiction_name.match(/\(([^)]*)\)/)?.[1]?.replace(/\b(HSD|LID|RTD|CD|MTS|RTA)\b/g, "") ?? "");
    const scored = same
      .map((d) => {
        const text = `${d.jurisdiction_name}; ${d.notes.match(/boundaries: ([^;]*)/)?.[1] ?? ""}`;
        const [main, except = ""] = text.split(/\bexcept\b/i);
        // "the Commercial Aeronautical Zone in the City of Colorado Springs" excludes a zone, not the city
        const excluded = except.replace(/in the City of [A-Za-z ]+/gi, "");
        let sc = 0;
        if (mentions(main, place)) sc += 2;
        if (new RegExp(`\\b${countyBase}\\s+count`, "i").test(main)) sc += 1;
        if (qualifier && normPlace(d.jurisdiction_name).includes(qualifier)) sc += 2;
        if (place && mentions(excluded, place)) sc = -1;
        return { d, sc };
      })
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc);
    return scored.length && (scored.length === 1 || scored[0].sc > scored[1].sc) ? scored[0].d : null;
  }

  const stats = { histCounty: 0, histDistrict: 0, noComp: 0, homeRuleDropped: 0, newDistrict: 0 };

  // Districts no DR 0800 code names: applied only where DR 1002's boundary text names
  // a whole county ("All of Delta County") or one place ("Evans area", "Aspen city limits").
  const newDistricts: { row: DirRow; county?: string; place?: string }[] = [];
  for (const d of districts.filter((d) => /No DR 0800 .*location code names this district/.test(d.notes) && num(d.local_rate))) {
    const b = d.notes.match(/boundaries: ([^;]*)/)?.[1]?.trim() ?? "";
    const wholeCounty = b.match(/^All of ([A-Za-z ]+?) County$/) ?? b.match(/^([A-Za-z ]+?) County Limits$/);
    const place = b.match(/^([A-Za-z ]+?) (?:city limits|area)\b/)?.[1];
    // the district's own name must agree with the place it describes (DR 1002 prints
    // La Veta FPD's boundary as "Lake City area" - a copy error, skipped)
    if (wholeCounty) newDistricts.push({ row: d, county: normCounty(wholeCounty[1]) });
    else if (place && normPlace(d.jurisdiction_name).startsWith(normPlace(place))) newDistricts.push({ row: d, place: normPlace(place) });
    else notes.push(`district not mapped (boundary not a county or named place): ${d.jurisdiction_name} - "${b}"`);
  }
  function rateLocation(loc: DirRow, p: Piece): PieceRate {
    const countyName = loc.county_name || `${p.countyName} County`;
    const co = countyRow.get(normCounty(countyName));
    const comps = composition(loc.notes);
    const j: Juris[] = [{ type: "State", name: STATE_NAMES.CO, code: "CO", rate: stateRate! }];
    if (!comps) stats.noComp++;
    // county: DR 1002 July 2026 rate; a county DR 1002 does not list has none
    const coCur = co ? num(co.local_rate) : null;
    const coHist = comps?.find((c) => c.abbr === "County")?.pct;
    let coRate = coCur ?? (co && /Not listed in DR 1002/i.test(co.notes) ? 0 : coHist != null ? coHist / 100 : 0);
    if (coCur == null && coHist != null && !(co && /Not listed in DR 1002/i.test(co.notes))) stats.histCounty++;
    // city: only when state-collected
    if (loc.jurisdiction_type === "city" || loc.jurisdiction_type === "town") {
      if (isHomeRule(loc)) stats.homeRuleDropped++;
      else {
        const cityRate = num(loc.local_rate) ?? (comps?.find((c) => c.abbr === "City")?.pct ?? 0) / 100;
        if (cityRate) j.push({ type: "City", name: loc.jurisdiction_name.replace(/\s*\([^)]*\)/g, ""), code: loc.official_code, rate: round6(cityRate) });
      }
    }
    const specials: Juris[] = [];
    for (const c of comps ?? []) {
      if (c.abbr === "State" || c.abbr === "County" || c.abbr === "City") continue;
      const d = districtRow(c.abbr, loc, countyName);
      const r = d ? num(d.local_rate) : null;
      if (r == null) { stats.histDistrict++; if (process.env.CO_DEBUG) console.error(`hist ${c.abbr} ${c.pct} @ ${loc.official_code} ${loc.jurisdiction_name} (${countyName})`); }
      const rate = r ?? c.pct / 100;
      if (rate) specials.push({ type: "Special", name: d?.jurisdiction_name ?? `${c.abbr} (${countyName})`, code: d?.official_code ?? c.abbr, rate: round6(rate) });
    }
    // districts DR 1002 July 2026 lists that the 06/13/25 DR 0800 code list predates
    for (const nd of newDistricts) {
      if (comps?.some((c) => c.abbr === nd.row.official_code)) continue;
      const hit = nd.county ? normCounty(countyName) === nd.county : !!p.placeName && normPlace(p.placeName) === nd.place;
      if (hit) {
        stats.newDistrict++;
        specials.push({ type: "Special", name: nd.row.jurisdiction_name, code: nd.row.official_code, rate: num(nd.row.local_rate)! });
      }
    }
    // DR 1002 county rates for Eagle/Pitkin/Summit already include MTS, Rio Grande/Mineral
    // include the HSD: report that part as the district, not twice
    let included = 0;
    if (co && /Rate includes/i.test(co.notes))
      for (const sp of specials)
        if ((sp.code === "MTS" && /Mass Transit/i.test(co.notes)) || (sp.code === "HSD" && /Health Servic/i.test(co.notes))) included += sp.rate;
    if (coRate) j.push({ type: "County", name: countyName, code: co?.official_code ?? null, rate: round6(Math.max(0, coRate - included)) });
    j.push(...specials);
    return { jurisdictions: j, effectiveFrom: EFFECTIVE };
  }

  const best = (xs: DirRow[]) =>
    xs.slice().sort((a, b) => variantPenalty(a) - variantPenalty(b) || (composition(b.notes)?.length ?? 0) - (composition(a.notes)?.length ?? 0))[0];

  const missingCity = new Set<string>();
  const rate = (p: Piece): PieceRate | null => {
    const inCounty = locByCounty.get(normCounty(p.countyName)) ?? [];
    const named = p.placeName ? inCounty.filter((r) => normPlace(r.jurisdiction_name) === normPlace(p.placeName)) : [];
    let loc: DirRow | undefined;
    if (p.placeType === "incorporated") {
      loc = best(named.filter((r) => r.jurisdiction_type === "city" || r.jurisdiction_type === "town"));
      if (!loc) missingCity.add(`${p.placeName} (${p.countyName})`);
    } else if (named.length) loc = best(named);
    if (!loc) {
      const uninc = inCounty.filter((r) => /^Unincorporated/i.test(r.jurisdiction_name));
      loc = uninc.sort((a, b) => {
        const plain = (r: DirRow) => (/^Unincorporated( [A-Z][a-z]+)*$/.test(r.jurisdiction_name) && !/RTD|CD/.test(r.jurisdiction_name) ? 0 : 1);
        return plain(a) - plain(b) || (composition(b.notes)?.length ?? 0) - (composition(a.notes)?.length ?? 0);
      })[0];
    }
    if (loc) return rateLocation(loc, p);
    // no location code at all: state + county
    const co = countyRow.get(normCounty(p.countyName));
    const j: Juris[] = [{ type: "State", name: STATE_NAMES.CO, code: "CO", rate: stateRate }];
    const cr = co ? num(co.local_rate) : null;
    if (cr) j.push({ type: "County", name: co!.county_name, code: co!.official_code, rate: cr });
    return { jurisdictions: j, effectiveFrom: EFFECTIVE };
  };

  const { rows, unrated } = zipRowsFromPieces("CO", "CDOR DR 0800 location codes + DR 1002 July 2026 rates (state-collected taxes)", rate);
  notes.push(
    `home-rule city portions dropped on ${stats.homeRuleDropped} pieces; 2025 spreadsheet value used for ${stats.histCounty} county / ${stats.histDistrict} district components; post-2025 districts added on ${stats.newDistrict} pieces; ${stats.noComp} location rows lacked a tax breakdown`,
  );
  if (missingCity.size) notes.push(`${missingCity.size} incorporated places without a location code (rated as unincorporated): ${[...missingCity].slice(0, 12).join("; ")}`);
  if (unrated.length) notes.push(`${unrated.length} pieces unrated`);
  return { state: "CO", source: "CDOR via data/jurisdictions/us-jurisdictions.csv", rows, notes };
}
