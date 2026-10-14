/**
 * Helpers shared by the IL, MO and CO builders: name normalisation for joining
 * Census pieces to state-DOR directory rows, and the directory rows themselves.
 */
import { directoryRows } from "../lib/directory";
import { normCity, round6 } from "../lib/common";

export type DirRow = ReturnType<typeof directoryRows>[number];

/** "St. Louis County" | "ST LOUIS COUNTY" | "DuPage" | "Du Page" -> "STLOUIS" | "DUPAGE". */
export function normCounty(s: string | null | undefined): string {
  return normCity((s ?? "").replace(/\b(county|parish)\b\s*$/i, "")).replace(/COUNTY$/, "");
}

/** Place / jurisdiction name: drops parenthetical qualifiers, then the API's city normalisation. */
export function normPlace(s: string | null | undefined): string {
  return normCity(
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Cañon City -> Canon City
      .replace(/\s*\([^)]*\)/g, " ")
      .replace(/^(city|town|village) of\s+/i, "") // "City of Creede"
      .trim(),
  );
}

export const num = (s: string | null | undefined) => (s == null || s === "" ? null : Number(s));

/** combined - local, the state's own rate as the directory rows imply it (most common value). */
export function impliedStateRate(rows: DirRow[]): number {
  const n = new Map<number, number>();
  for (const r of rows) {
    const c = num(r.combined_rate), l = num(r.local_rate);
    if (c == null || l == null) continue;
    const s = round6(c - l);
    n.set(s, (n.get(s) ?? 0) + 1);
  }
  const best = [...n].sort((a, b) => b[1] - a[1])[0];
  if (!best) throw new Error("cannot infer state rate from directory rows");
  return best[0];
}

export function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const a = m.get(k);
    if (a) a.push(x);
    else m.set(k, [x]);
  }
  return m;
}
