/**
 * Shared types and helpers for the rate-table builders in scripts/rates/states.
 * Every builder returns RateRow[]; build-rates.ts writes them to
 * data/rates/us-tax-rates.csv and load-rates.ts loads that file into tax_rates.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { normalizeCity } from "../../../src/lib/tax/rate-lookup";

export type JurType = "State" | "County" | "City" | "Special";
export type Juris = { type: JurType; name: string; code: string | null; rate: number };

export type RateRow = {
  state: string;
  zip5: string;
  plus4Low: string | null;
  plus4High: string | null;
  countyName: string | null;
  cityName: string | null;
  jurisdictions: Juris[];
  isPrimary: boolean;
  source: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
  /** Combined rate on 2026-07-01 for the same area, when the source has history (validation only, not loaded). */
  prevTotal?: number;
};

/** The table describes rates in force on this date (first day of 2026-Q4). */
export const AS_OF = "2026-10-01";
export const AS_OF_NUM = 20261001;

export const ROOT = process.cwd();
export const RAW = path.join(ROOT, "data/rates/raw");
export const DERIVED = path.join(ROOT, "data/rates/derived");

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function sumBy(j: Juris[], t?: JurType) {
  return round6(j.filter((x) => !t || x.type === t).reduce((s, x) => s + x.rate, 0));
}

/** Stable identity of a rate area: same jurisdictions + rates => same signature. */
export function signature(j: Juris[]) {
  return j
    .filter((x) => x.rate !== 0 || x.type === "State")
    .map((x) => `${x.type}:${x.code ?? x.name}:${round6(x.rate)}`)
    .sort()
    .join("|");
}

export function readCsv<T = Record<string, string>>(file: string, opts: { header?: boolean } = { header: true }): T[] {
  const text = readFileSync(file, "utf8").replace(/^﻿/, "");
  const r = Papa.parse<T>(text, { header: opts.header ?? true, skipEmptyLines: true });
  return r.data;
}

export function rawFile(state: string, ...parts: string[]) {
  return path.join(RAW, state, ...parts);
}

export function mustExist(file: string) {
  if (!existsSync(file)) throw new Error(`missing source file ${path.relative(ROOT, file)} - see data/rates/sources/`);
  return file;
}

/** "20261001" | "2026-10-01" | Date-ish -> "2026-10-01"; far-future ends -> null. */
export function isoDate(d: string | number | null | undefined): string | null {
  if (d == null || d === "") return null;
  const s = String(d).trim();
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return null;
  if (Number(m[1]) >= 2900) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Same normalisation the API uses when matching a caller's city to city_name. */
export const normCity = normalizeCity;

export function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** A state with no local taxes: one State jurisdiction. */
export function stateOnly(state: string, name: string, rate: number): Juris[] {
  return [{ type: "State", name, code: state, rate }];
}

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13",
  HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25",
  MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36",
  NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48",
  UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56",
};

/** Changes the builders noticed that take effect after AS_OF or on it (for the validation report). */
export type RateChange = { state: string; jurisdiction: string; from: number | null; to: number; effective: string };
export const RATE_CHANGES: RateChange[] = [];

export type StateBuild = {
  state: string;
  source: string;
  rows: RateRow[];
  notes?: string[];
};
