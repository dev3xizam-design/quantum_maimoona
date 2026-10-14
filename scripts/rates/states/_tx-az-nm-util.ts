/**
 * Helpers shared by the TX, AZ and NM builders: the state's official rows from
 * Quantum's jurisdiction directory (data/jurisdictions/us-jurisdictions.csv)
 * with numeric rates, and name keys that line Census names up with DOR names.
 */
import { directoryRows } from "../lib/directory";

export type DirRate = {
  name: string;
  type: string;
  code: string | null;
  county: string; // normalised county key ("" when the row names none)
  local: number | null;
  combined: number | null;
  includesState: boolean;
  pairedCode: string;
  notes: string;
  effectiveFrom: string;
};

const num = (s: string | undefined) => (s == null || s.trim() === "" ? null : Number(s));

/** "Collin County" / "COLLIN" / "Collin" -> "collin"; "Edgewood (Bernalillo)" -> "edgewood"; "Village of Tijeras" -> "tijeras". */
export function nameKey(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Española -> Espanola
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/^\s*(city|town|village) of\s+/, " ")
    .replace(/\b(county|parish|city|town|village)\b/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, ""); // spaceless: "De Soto" = "DeSoto"
}

export function stateRates(state: string): DirRate[] {
  return directoryRows(state).map((r) => {
    const raw = r as unknown as Record<string, string>;
    return {
      name: r.jurisdiction_name,
      type: r.jurisdiction_type,
      code: r.official_code || null,
      county: nameKey(r.county_name),
      local: num(r.local_rate),
      combined: num(r.combined_rate),
      includesState: raw.rate_includes_state === "true",
      pairedCode: raw.paired_code ?? "",
      notes: r.notes,
      effectiveFrom: raw.effective_from ?? "",
    };
  });
}

/** Groups rows by name key; callers disambiguate same-name rows by county. */
export function byName(rows: DirRate[]): Map<string, DirRate[]> {
  const m = new Map<string, DirRate[]>();
  for (const r of rows) {
    const k = nameKey(r.name);
    let a = m.get(k);
    if (!a) m.set(k, (a = []));
    a.push(r);
  }
  return m;
}

/** The row of `rows` for a piece in `county`: exact county match, else the one row with no county. */
export function forCounty(rows: DirRate[] | undefined, county: string): DirRate | null {
  if (!rows?.length) return null;
  const k = nameKey(county);
  return rows.find((r) => r.county === k) ?? rows.find((r) => r.county === "") ?? (rows.length === 1 ? rows[0] : null);
}
