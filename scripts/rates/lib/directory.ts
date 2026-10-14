/**
 * Names (and official codes) for jurisdictions, reused from Quantum's own
 * jurisdiction directory (data/jurisdictions/us-jurisdictions.csv). Used only
 * for the human-readable `name` in tax_rates.jurisdictions - rates always come
 * from the state's rate file.
 */
import path from "node:path";
import { readCsv, ROOT } from "./common";

type DirRow = {
  category: string;
  state: string;
  jurisdiction_name: string;
  jurisdiction_type: string;
  official_code: string;
  code_system: string;
  county_name: string;
  local_rate: string;
  combined_rate: string;
  notes: string;
};

let rows: DirRow[] | null = null;
export function directoryRows(state?: string): DirRow[] {
  rows ??= readCsv<DirRow>(path.join(ROOT, "data/jurisdictions/us-jurisdictions.csv")).filter((r) => r.category === "tax");
  return state ? rows.filter((r) => r.state === state) : rows;
}

/** official code -> name, plus any FIPS code mentioned in the notes ("county FIPS 13001", "place FIPS 04060"). */
export function directoryNames(state: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of directoryRows(state)) {
    if (r.official_code && !m.has(r.official_code)) m.set(r.official_code, r.jurisdiction_name);
    for (const x of r.notes.matchAll(/FIPS\s+(\d{3,7})/g)) {
      const code = x[1];
      if (!m.has(code)) m.set(code, r.jurisdiction_name);
      if (code.length === 5 && /county/i.test(r.jurisdiction_type) && !m.has(code.slice(2))) m.set(code.slice(2), r.jurisdiction_name);
    }
  }
  return m;
}
