/**
 * The nationwide jurisdiction directory: one CSV in the repo is the source of
 * truth (data/jurisdictions/us-jurisdictions.csv), loaded into
 * jurisdiction_directory and exported back out as CSV / Excel.
 *
 * No database or Next imports here - scripts and routes both use it.
 */
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { STATE_NAMES } from "../states";

export const DIRECTORY_COLUMNS = [
  "category",
  "state",
  "jurisdiction_name",
  "jurisdiction_type",
  "official_code",
  "code_system",
  "county_name",
  "paired_code",
  "paired_name",
  "local_rate",
  "combined_rate",
  "rate_includes_state",
  "effective_from",
  "effective_to",
  "source_url",
  "notes",
] as const;

export type DirectoryCsvRow = Record<(typeof DIRECTORY_COLUMNS)[number], string>;

export type DirectoryRow = {
  category: "tax" | "government";
  state: string;
  jurisdictionName: string;
  jurisdictionType: string;
  officialCode: string;
  codeSystem: string;
  countyName: string | null;
  pairedCode: string | null;
  pairedName: string | null;
  localRate: string | null;
  combinedRate: string | null;
  rateIncludesState: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceUrl: string | null;
  notes: string | null;
};

export const JURISDICTION_TYPES = [
  "state", "county", "parish", "borough", "city", "town", "village", "township",
  "municipality", "region", "district", "transit", "special", "school", "unincorporated",
] as const;

const blank = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

/** Parses and validates the CSV. Throws with every bad line listed, never a partial load. */
export function parseDirectoryCsv(text: string): DirectoryRow[] {
  const parsed = Papa.parse<DirectoryCsvRow>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
  });
  const missing = DIRECTORY_COLUMNS.filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length) throw new Error(`Directory CSV is missing columns: ${missing.join(", ")}`);

  const errors: string[] = [];
  const rows: DirectoryRow[] = [];
  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const bad = (msg: string) => errors.push(`line ${line}: ${msg}`);
    const state = (r.state ?? "").trim().toUpperCase();
    if (!STATE_NAMES[state]) return bad(`unknown state "${r.state}"`);
    if (r.category !== "tax" && r.category !== "government") return bad(`category "${r.category}"`);
    if (!blank(r.jurisdiction_name)) return bad("no jurisdiction name");
    // A blank code is real data: the state publishes no code for it (a state-level
    // row, a CA district tax). It is listed, and can never be promoted.
    if (!(JURISDICTION_TYPES as readonly string[]).includes(r.jurisdiction_type)) {
      return bad(`jurisdiction type "${r.jurisdiction_type}"`);
    }
    for (const k of ["local_rate", "combined_rate"] as const) {
      const v = blank(r[k]);
      if (v !== null && !(Number(v) >= 0 && Number(v) < 0.2)) return bad(`${k} "${v}" is not a decimal rate`);
    }
    for (const k of ["effective_from", "effective_to"] as const) {
      const v = blank(r[k]);
      if (v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return bad(`${k} "${v}" is not YYYY-MM-DD`);
    }
    rows.push({
      category: r.category,
      state,
      jurisdictionName: r.jurisdiction_name.trim(),
      jurisdictionType: r.jurisdiction_type,
      officialCode: r.official_code.trim(),
      codeSystem: blank(r.code_system) ?? "",
      countyName: blank(r.county_name),
      pairedCode: blank(r.paired_code),
      pairedName: blank(r.paired_name),
      localRate: blank(r.local_rate),
      combinedRate: blank(r.combined_rate),
      rateIncludesState: /^(true|1|yes)$/i.test((r.rate_includes_state ?? "").trim()),
      effectiveFrom: blank(r.effective_from),
      effectiveTo: blank(r.effective_to),
      sourceUrl: blank(r.source_url),
      notes: blank(r.notes),
    });
  });
  if (errors.length) {
    throw new Error(`Directory CSV has ${errors.length} bad row(s):\n${errors.slice(0, 40).join("\n")}`);
  }
  return rows;
}

/**
 * The engine only looks codes up as county | city | local | special
 * (see buildCodeIndex in engine/sales.ts). Everything else maps onto those.
 */
export function engineType(directoryType: string): "county" | "city" | "local" | "special" {
  switch (directoryType) {
    case "county":
    case "parish":
    case "borough":
    case "region":
      return "county";
    case "city":
    case "town":
    case "village":
    case "township":
    case "municipality":
      return "city";
    case "state":
    case "unincorporated":
      return "local";
    default:
      return "special";
  }
}

/**
 * Only Oklahoma's return takes a paired line (city COPO + county COPO). Elsewhere
 * a paired code in the directory is context - the county a city sits in, the CA
 * district area - and carrying it into the engine would print a bogus extra line.
 */
export const PAIRED_ON_RETURN = new Set(["OK"]);

/** Codes a state publishes for something other than sales/use tax (WY lodging). */
export function isPromotable(row: { category: string; officialCode: string; codeSystem: string }) {
  return row.category === "tax" && row.officialCode.trim() !== "" && !/not for sales tax/i.test(row.codeSystem);
}

/**
 * The rate the engine should hold: WY/AZ-style rows publish a combined rate
 * that already includes the state's, everything else carries its own portion.
 */
export function engineRate(row: Pick<DirectoryRow, "localRate" | "combinedRate" | "rateIncludesState">) {
  return row.rateIncludesState ? (row.combinedRate ?? row.localRate) : row.localRate;
}

type Exportable = Omit<DirectoryRow, "category" | "localRate" | "combinedRate"> & {
  category: string;
  localRate: string | number | null;
  combinedRate: string | number | null;
};

function toCsvRecord(r: Exportable): DirectoryCsvRow {
  const s = (v: string | number | null) => (v === null ? "" : String(v));
  return {
    category: r.category,
    state: r.state,
    jurisdiction_name: r.jurisdictionName,
    jurisdiction_type: r.jurisdictionType,
    official_code: r.officialCode,
    code_system: r.codeSystem,
    county_name: s(r.countyName),
    paired_code: s(r.pairedCode),
    paired_name: s(r.pairedName),
    local_rate: s(r.localRate === null ? null : Number(r.localRate)),
    combined_rate: s(r.combinedRate === null ? null : Number(r.combinedRate)),
    rate_includes_state: r.rateIncludesState ? "true" : "false",
    effective_from: s(r.effectiveFrom),
    effective_to: s(r.effectiveTo),
    source_url: s(r.sourceUrl),
    notes: s(r.notes),
  };
}

export function directoryToCsv(rows: Exportable[]): string {
  // BOM so Excel opens the file as UTF-8 and keeps accented place names intact.
  return "﻿" + Papa.unparse(rows.map(toCsvRecord), { columns: [...DIRECTORY_COLUMNS] });
}

const SHEET_COLUMNS: { header: string; key: keyof DirectoryCsvRow; width: number }[] = [
  { header: "State", key: "state", width: 7 },
  { header: "Jurisdiction", key: "jurisdiction_name", width: 34 },
  { header: "Type", key: "jurisdiction_type", width: 13 },
  { header: "Official code", key: "official_code", width: 16 },
  { header: "Code system", key: "code_system", width: 28 },
  { header: "County", key: "county_name", width: 28 },
  { header: "Paired code", key: "paired_code", width: 12 },
  { header: "Paired name", key: "paired_name", width: 18 },
  { header: "Local rate", key: "local_rate", width: 11 },
  { header: "Combined rate", key: "combined_rate", width: 13 },
  { header: "Rate includes state", key: "rate_includes_state", width: 11 },
  { header: "Effective from", key: "effective_from", width: 13 },
  { header: "Effective to", key: "effective_to", width: 12 },
  { header: "Notes", key: "notes", width: 60 },
  { header: "Source", key: "source_url", width: 50 },
];

function addDataSheet(wb: ExcelJS.Workbook, name: string, rows: Exportable[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = SHEET_COLUMNS;
  for (const r of rows) {
    const rec = toCsvRecord(r);
    ws.addRow({
      ...rec,
      local_rate: rec.local_rate === "" ? null : Number(rec.local_rate),
      combined_rate: rec.combined_rate === "" ? null : Number(rec.combined_rate),
    });
  }
  // Codes stay text so Excel never strips a leading zero ("0100" is not 100).
  ws.getColumn("official_code").numFmt = "@";
  ws.getColumn("paired_code").numFmt = "@";
  ws.getColumn("local_rate").numFmt = "0.000%";
  ws.getColumn("combined_rate").numFmt = "0.000%";
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5B33" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: SHEET_COLUMNS.length } };
}

export async function buildDirectoryWorkbook(
  rows: Exportable[],
  opts: { title: string; builtOn: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Quantum Tax Automation";
  const tax = rows.filter((r) => r.category === "tax");
  const gov = rows.filter((r) => r.category === "government");

  const about = wb.addWorksheet("Read me");
  about.columns = [{ width: 30 }, { width: 110 }];
  about.addRows([
    [opts.title],
    ["Built", opts.builtOn],
    ["Tax filing codes", `${tax.length.toLocaleString()} rows - the codes each state revenue department publishes for its returns and rate charts. Rates are decimals shown as %.`],
    ["All governments (FIPS)", `${gov.length.toLocaleString()} rows - every state, county, incorporated city/town/village and active township (US Census 2020 FIPS codes). A FIPS code is NOT a filing code unless the state says so.`],
    ["By state", "Row counts per state and category."],
    ["Local rate", "That jurisdiction's own rate, excluding the state rate."],
    ["Combined rate", "Total rate including the state rate, where the state publishes one."],
    ["Rate includes state", "TRUE only where the state's RETURN reports the jurisdiction at a state-inclusive rate (WY counties, AZ county regions, NV county lines)."],
    ["Codes are text", "Leading zeros matter. Keep the Official code column formatted as Text if you re-save this file."],
    ["Verify before filing", "Rates change quarterly. Check the Source link for the state's current chart before relying on a rate on a return."],
  ]);
  about.getRow(1).font = { bold: true, size: 14 };
  about.getColumn(1).font = { bold: true };

  if (tax.length) addDataSheet(wb, "Tax filing codes", tax);
  if (gov.length) addDataSheet(wb, "All governments (FIPS)", gov);

  const summary = wb.addWorksheet("By state", { views: [{ state: "frozen", ySplit: 1 }] });
  summary.columns = [
    { header: "State", key: "state", width: 7 },
    { header: "Name", key: "name", width: 22 },
    { header: "Tax filing codes", key: "tax", width: 16 },
    { header: "Governments (FIPS)", key: "gov", width: 18 },
    { header: "Code systems", key: "systems", width: 70 },
  ];
  summary.getRow(1).font = { bold: true };
  for (const code of Object.keys(STATE_NAMES).sort()) {
    const mine = rows.filter((r) => r.state === code);
    if (!mine.length) continue;
    summary.addRow({
      state: code,
      name: STATE_NAMES[code],
      tax: mine.filter((r) => r.category === "tax").length,
      gov: mine.filter((r) => r.category === "government").length,
      systems: [...new Set(mine.filter((r) => r.category === "tax").map((r) => r.codeSystem))].join("; "),
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
