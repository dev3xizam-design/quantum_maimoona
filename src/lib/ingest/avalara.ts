/**
 * Avalara SalesTaxDocumentLineDetail parsing.
 *
 * The export is PRE-EXPLODED by jurisdiction: every sale line appears once per
 * State / County / City / Special row. We keep every row exactly as exported -
 * dedupe is the engine's job (doc 04), so nothing is lost on the way in.
 *
 * Isomorphic: no node-only imports, so the browser can parse a 200k-row CSV
 * and stream normalized batches to the API (dodges the 4.5MB serverless body
 * limit entirely).
 */

export type NormalizedRow = {
  documentId: string;
  lineNo: string;
  ref1: string | null;
  documentStatus: string | null;
  docType: string | null;
  sign: number;
  documentDate: string | null;
  period: string;
  reportingDate: string | null;
  taxCalcDate: string | null;
  state: string;
  destCounty: string | null;
  destCity: string | null;
  destZip: string | null;
  jurisdictionType: string | null;
  jurisdictionDescription: string | null;
  taxTypeDescription: string | null;
  rate: number;
  lineAmount: number;
  discountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  taxAmount: number;
  quantity: number;
  itemCode: string | null;
  itemDescription: string | null;
  sourceFile: string | null;
};

const FIELD_ALIASES: Record<string, string[]> = {
  documentId: ["DOCUMENTID", "DOCID", "DOCUMENTCODE", "DOCCODE"],
  lineNo: ["LINENO", "LINENUMBER", "DOCUMENTLINENUMBER", "LINE"],
  ref1: ["REF1", "REFERENCE1", "CUSTOMERREF"],
  documentStatus: ["DOCUMENTSTATUS", "DOCSTATUS", "STATUS"],
  docType: ["DOCTYPE", "DOCUMENTTYPE"],
  documentDate: ["DOCUMENTDATE", "DOCDATE"],
  reportingDate: ["REPORTINGDATE"],
  taxCalcDate: ["TAXCALCDATE", "TAXCALCULATIONDATE"],
  state: ["STATEPROVINCE", "STATE", "REGION", "DESTREGION"],
  destCounty: ["DESTCOUNTY", "DESTINATIONCOUNTY", "COUNTY"],
  destCity: ["DESTCITY", "DESTINATIONCITY", "CITY"],
  destZip: ["DESTPOSTALCODE", "DESTZIP", "POSTALCODE", "ZIP"],
  jurisdictionType: ["JURISDICTIONTYPEDESCRIPTION", "JURISTYPEDESC", "JURISDICTIONTYPE"],
  jurisdictionDescription: ["JURISDICTIONDESCRIPTION", "JURISNAME", "JURISDICTIONNAME"],
  taxTypeDescription: ["TAXTYPEDESCRIPTION", "TAXTYPE"],
  rate: ["RATE", "TAXRATE", "JURISDICTIONRATE"],
  lineAmount: ["LINEAMOUNT", "LINEAMT", "AMOUNT"],
  discountAmount: ["DISCOUNTAMOUNT", "LINEDISCOUNTAMOUNT", "DISCOUNT"],
  taxableAmount: ["LINETAXABLEAMOUNT", "TAXABLEAMOUNT", "TAXABLE"],
  exemptAmount: ["LINEEXEMPTAMOUNT", "EXEMPTAMOUNT", "NONTAXABLEAMOUNT", "EXEMPT"],
  taxAmount: ["TAXAMOUNT", "TAX"],
  quantity: ["QUANTITY", "QTY"],
  itemCode: ["ITEMCODE", "SKU", "PRODUCTCODE"],
  itemDescription: ["ITEMCODEDESCRIPTION", "ITEMDESCRIPTION", "DESCRIPTION", "PRODUCTNAME"],
};

/** Fields we cannot compute anything without. */
export const REQUIRED_FIELDS = [
  "state",
  "documentDate",
  "documentId",
  "lineNo",
  "jurisdictionType",
  "lineAmount",
  "taxAmount",
] as const;

const canon = (h: string) => h.toUpperCase().replace(/[^A-Z0-9]/g, "");

export type HeaderMap = Record<string, string>; // canonical field -> actual header

export function buildHeaderMap(headers: string[]): HeaderMap {
  const byCanon = new Map<string, string>();
  for (const h of headers) byCanon.set(canon(h), h);
  const map: HeaderMap = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const hit = byCanon.get(alias);
      if (hit) {
        map[field] = hit;
        break;
      }
    }
  }
  return map;
}

export function missingRequired(map: HeaderMap): string[] {
  return REQUIRED_FIELDS.filter((f) => !map[f]);
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  const negParen = /^\(.*\)$/.test(s);
  s = s.replace(/[()$,\s]/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negParen ? -n : n;
}

function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (us) {
    const yr = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${yr}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

export function normalizeRow(
  raw: Record<string, unknown>,
  map: HeaderMap,
  sourceFile: string | null,
): NormalizedRow | null {
  const get = (field: string) => (map[field] ? raw[map[field]] : undefined);

  const state = (str(get("state")) ?? "").toUpperCase();
  const documentDate = toDate(get("documentDate"));
  if (!state || !documentDate) return null;

  const docType = str(get("docType"));
  const sign = docType && /return/i.test(docType) ? -1 : 1;

  return {
    documentId: str(get("documentId")) ?? "",
    lineNo: str(get("lineNo")) ?? "1",
    ref1: str(get("ref1")),
    documentStatus: str(get("documentStatus")),
    docType,
    sign,
    documentDate,
    period: documentDate.slice(0, 7),
    reportingDate: toDate(get("reportingDate")),
    taxCalcDate: toDate(get("taxCalcDate")),
    state,
    destCounty: str(get("destCounty")),
    destCity: str(get("destCity")),
    destZip: str(get("destZip")),
    jurisdictionType: str(get("jurisdictionType")),
    jurisdictionDescription: str(get("jurisdictionDescription")),
    taxTypeDescription: str(get("taxTypeDescription")),
    rate: toNumber(get("rate")),
    lineAmount: toNumber(get("lineAmount")),
    discountAmount: toNumber(get("discountAmount")),
    taxableAmount: toNumber(get("taxableAmount")),
    exemptAmount: toNumber(get("exemptAmount")),
    taxAmount: toNumber(get("taxAmount")),
    quantity: toNumber(get("quantity")),
    itemCode: str(get("itemCode")),
    itemDescription: str(get("itemDescription")),
    sourceFile,
  };
}

/** True for the one row per line that carries the full line amounts. */
export function isStateRow(row: { jurisdictionType: string | null }): boolean {
  return (row.jurisdictionType ?? "").trim().toLowerCase() === "state";
}

/** Bottled e-juice usually states mL in the item name; pods/disposables do not. */
export function parseMlFromDescription(desc: string | null | undefined): number | null {
  if (!desc) return null;
  const m = desc.match(/(\d+(?:\.\d+)?)\s*-?\s*ML\b/i);
  return m ? Number(m[1]) : null;
}

export type IngestStats = {
  rows: number;
  lines: number;
  nonCommitted: number;
  byState: Record<string, { rows: number; gross: number; exempt: number; taxable: number; tax: number }>;
  periods: string[];
  minDate: string | null;
  maxDate: string | null;
};

export function emptyStats(): IngestStats {
  return { rows: 0, lines: 0, nonCommitted: 0, byState: {}, periods: [], minDate: null, maxDate: null };
}

const signed = (v: number, ret: boolean) => (ret ? -Math.abs(v) : v);

/**
 * Running totals for the ingest validation report, using the same dedupe rule
 * the engine uses so the numbers on screen are the numbers that will be filed.
 * `seen` must persist across the whole upload (all files).
 */
export function accumulateStats(stats: IngestStats, row: NormalizedRow, seen: Set<string>) {
  stats.rows += 1;
  if (row.documentStatus && !/committed/i.test(row.documentStatus)) stats.nonCommitted += 1;

  const s = (stats.byState[row.state] ??= { rows: 0, gross: 0, exempt: 0, taxable: 0, tax: 0 });
  s.rows += 1;

  const ret = row.sign < 0;
  s.tax += signed(row.taxAmount, ret);

  if (isStateRow(row)) {
    const key = `${row.documentId}|${row.lineNo}|${row.itemCode ?? ""}|${row.ref1 ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      stats.lines += 1;
      s.gross += signed(row.lineAmount - row.discountAmount, ret);
      s.exempt += signed(row.exemptAmount, ret);
      s.taxable = s.gross - s.exempt;
    }
  }

  if (!stats.periods.includes(row.period)) stats.periods.push(row.period);
  if (row.documentDate) {
    if (!stats.minDate || row.documentDate < stats.minDate) stats.minDate = row.documentDate;
    if (!stats.maxDate || row.documentDate > stats.maxDate) stats.maxDate = row.documentDate;
  }
}

export function roundStats(stats: IngestStats): IngestStats {
  for (const s of Object.values(stats.byState)) {
    s.gross = Math.round(s.gross * 100) / 100;
    s.exempt = Math.round(s.exempt * 100) / 100;
    s.taxable = Math.round(s.taxable * 100) / 100;
    s.tax = Math.round(s.tax * 100) / 100;
  }
  stats.periods.sort();
  return stats;
}
