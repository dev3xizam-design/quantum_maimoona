/**
 * ZIP (ZCTA) -> county / place evidence from data/rates/derived/zcta-geo.csv
 * (built by scripts/rates/prepare-census.ts from Census 2020 block data), and
 * the generic "rate each piece, then roll pieces up to ZIP rows" step that
 * every non-SST builder uses.
 */
import path from "node:path";
import { DERIVED, mustExist, normCity, readCsv, signature, type Juris, type RateRow } from "./common";

export type Piece = {
  zip: string;
  state: string;
  countyFips: string; // 3 digits
  countyName: string;
  placeFips: string; // "" when the block is in no place
  placeName: string;
  placeType: "incorporated" | "cdp" | "none";
  cousubFips: string;
  cousubName: string;
  pop: number;
  hu: number;
  area: number;
};

let cache: Map<string, Piece[]> | null = null;

export function allPieces(): Map<string, Piece[]> {
  if (cache) return cache;
  const rows = readCsv(mustExist(path.join(DERIVED, "zcta-geo.csv")));
  cache = new Map();
  for (const r of rows) {
    const p: Piece = {
      zip: r.zcta,
      state: r.state,
      countyFips: r.county_fips,
      countyName: r.county_name,
      placeFips: r.place_fips,
      placeName: r.place_name,
      placeType: r.place_type as Piece["placeType"],
      cousubFips: r.cousub_fips,
      cousubName: r.cousub_name,
      pop: Number(r.pop),
      hu: Number(r.hu),
      area: Number(r.arealand),
    };
    let a = cache.get(p.state);
    if (!a) cache.set(p.state, (a = []));
    a.push(p);
  }
  return cache;
}

export function statePieces(state: string): Piece[] {
  return allPieces().get(state) ?? [];
}

/** Population first, then housing units, then land area - so empty ZIPs still rank. */
export const pieceWeight = (p: Pick<Piece, "pop" | "hu" | "area">) => p.pop + p.hu * 1e-3 + p.area * 1e-12;

/** The name a caller's address would most likely carry for this piece. */
export function pieceCity(p: Piece): string | null {
  return p.placeType === "none" ? null : p.placeName;
}

export type PieceRate = {
  jurisdictions: Juris[];
  cityName?: string | null;
  countyName?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  prevTotal?: number;
};

export type Cand = { weight: number; rate: PieceRate; city: string | null; county: string | null };

/**
 * Turns weighted candidate areas into the ZIP rows of one ZIP:
 *  - candidates with the same rate + same city label merge (weights add);
 *  - one row per (city label, county) survives - the heaviest - so a caller's
 *    city name can never match two rows;
 *  - the heaviest surviving row overall is is_primary.
 */
export function rollUpZip(state: string, zip: string, cands: Cand[], source: string): RateRow[] {
  const merged = new Map<string, Cand>();
  for (const c of cands) {
    const k = `${signature(c.rate.jurisdictions)}#${normCity(c.city)}#${c.county ?? ""}`;
    const m = merged.get(k);
    if (m) m.weight += c.weight;
    else merged.set(k, { ...c });
  }
  const byLabel = new Map<string, Cand>();
  for (const c of [...merged.values()].sort((a, b) => b.weight - a.weight)) {
    const k = `${normCity(c.city)}#${c.county ?? ""}`;
    if (!byLabel.has(k)) byLabel.set(k, c);
  }
  const kept = [...byLabel.values()].sort((a, b) => b.weight - a.weight);
  return kept.map((c, i) => ({
    state,
    zip5: zip,
    plus4Low: null,
    plus4High: null,
    countyName: c.county,
    cityName: c.city,
    jurisdictions: c.rate.jurisdictions,
    isPrimary: i === 0,
    source,
    effectiveFrom: c.rate.effectiveFrom,
    effectiveTo: c.rate.effectiveTo ?? null,
    prevTotal: c.rate.prevTotal,
  }));
}

/**
 * Rates every Census piece of the state with `rate` and rolls the pieces up
 * into ZIP rows. `rate` returns null for a piece it cannot rate (logged by the
 * caller via the returned `unrated` list).
 */
export function zipRowsFromPieces(
  state: string,
  source: string,
  rate: (p: Piece) => PieceRate | null,
  pieces: Piece[] = statePieces(state),
) {
  const byZip = new Map<string, Cand[]>();
  const unrated: Piece[] = [];
  for (const p of pieces) {
    const r = rate(p);
    if (!r) {
      unrated.push(p);
      continue;
    }
    let a = byZip.get(p.zip);
    if (!a) byZip.set(p.zip, (a = []));
    a.push({
      weight: pieceWeight(p),
      rate: r,
      city: r.cityName !== undefined ? r.cityName : pieceCity(p),
      county: r.countyName !== undefined ? r.countyName : p.countyName,
    });
  }
  const rows: RateRow[] = [];
  for (const [zip, cands] of [...byZip].sort(([a], [b]) => (a < b ? -1 : 1))) rows.push(...rollUpZip(state, zip, cands, source));
  return { rows, unrated };
}
