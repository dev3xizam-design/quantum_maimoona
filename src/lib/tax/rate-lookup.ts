/**
 * Picks the tax_rates row that applies to one address, from the rows the
 * database returned for its (state, zip5). Pure - no database, no server-only -
 * so it is unit-tested directly (scripts/test-rate-lookup.ts).
 *
 * Order:
 *  1. ZIP+4 range match (narrowest range wins) when the address has a plus4
 *  2. city match against the ZIP5 rows (case-insensitive; "St."/"Saint",
 *     "Ft"/"Fort", "Mt"/"Mount" and punctuation normalised)
 *  3. the row marked is_primary (the rate area holding most of the ZIP's population)
 *  4. the only row, or the first row as a last resort
 */

export type RateCandidate<T = unknown> = {
  zip5: string;
  plus4Low: string | null;
  plus4High: string | null;
  cityName: string | null;
  countyName: string | null;
  isPrimary: boolean;
  row: T;
};

export type RatePick<T> = { row: RateCandidate<T>; matchedBy: "zip4" | "city" | "primary" | "only" };

/** Upper-cases, unifies common abbreviations and drops punctuation/spaces. */
export function normalizeCity(s: string | null | undefined): string {
  return (s ?? "")
    .toUpperCase()
    .replace(/\./g, " ")
    .replace(/\b(CITY|TOWN|VILLAGE|BOROUGH|TOWNSHIP|CDP|MUNICIPALITY)\s*$/g, "")
    .replace(/\bSAINTE\b/g, "STE")
    .replace(/\bSAINT\b/g, "ST")
    .replace(/\bFORT\b/g, "FT")
    .replace(/\bMOUNT\b/g, "MT")
    .replace(/[^A-Z0-9]/g, "");
}

function zip4In(zip4: string, lo: string | null, hi: string | null) {
  if (lo == null || hi == null) return false;
  return zip4 >= lo.padStart(4, "0") && zip4 <= hi.padStart(4, "0");
}

export function pickRate<T>(
  rows: RateCandidate<T>[],
  opts: { city: string | null; zip4: string | null },
): RatePick<T> | null {
  if (!rows.length) return null;

  const zip4 = (opts.zip4 ?? "").replace(/\D/g, "");
  if (zip4.length === 4) {
    const hits = rows
      .filter((r) => zip4In(zip4, r.plus4Low, r.plus4High))
      .sort((a, b) => Number(a.plus4High) - Number(a.plus4Low) - (Number(b.plus4High) - Number(b.plus4Low)));
    if (hits.length) return { row: hits[0], matchedBy: "zip4" };
  }

  const zip5Rows = rows.filter((r) => r.plus4Low == null);
  const pool = zip5Rows.length ? zip5Rows : rows;

  const city = normalizeCity(opts.city);
  if (city) {
    const hits = pool.filter((r) => r.cityName && normalizeCity(r.cityName) === city);
    if (hits.length) return { row: hits.find((r) => r.isPrimary) ?? hits[0], matchedBy: "city" };
  }

  const primary = pool.find((r) => r.isPrimary);
  if (primary) return { row: primary, matchedBy: "primary" };
  if (pool.length === 1) return { row: pool[0], matchedBy: "only" };
  return { row: pool[0], matchedBy: "primary" };
}
