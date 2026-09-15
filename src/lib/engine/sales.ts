/**
 * SALES / SELLER'S USE TAX ENGINE
 *
 * Deterministic. Every number = transactions x a rate from an editable table.
 * The method here is the one that reconciled to the cent against the FL DR-15
 * (doc 02 / doc 04):
 *
 *   GROSS   = SUM(line_amount - discount)  over DEDUPED document lines
 *   EXEMPT  = SUM(line_exempt)             over DEDUPED document lines
 *   TAXABLE = GROSS - EXEMPT
 *   TAX     = SUM(tax_amount)              over ALL jurisdiction rows (no dedupe)
 *
 * Invariant: TAXABLE + EXEMPT == GROSS (1c tolerance) or the run is rejected.
 */

import { round2, applyRounding, TOLERANCE } from "../money";
import { periodLabel, dueDate, isoDate } from "../periods";
import type { JurisdictionLine, SalesResult, TxRow } from "./types";

export type JurisdictionCode = {
  jurisdictionName: string;
  jurisdictionType: string;
  officialCode: string;
  pairedCode: string | null;
  pairedName: string | null;
  rate: number | null;
  rateIncludesState: boolean;
  avalaraAlias: string | null;
  /** Added from the US jurisdiction directory rather than entered by a person. */
  fromDirectory?: boolean;
};

export type SalesConfig = {
  state: string;
  frequency: string;
  stateRate: number;
  hasLocal: boolean;
  allocation: string;
  rounding: string;
  portal: string | null;
  formName: string | null;
  dueDay: number | null;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const isState = (r: TxRow) => norm(r.jurisdictionType) === "state";
const isReturn = (r: TxRow) => /return/i.test(r.docType ?? "");

/**
 * Returns must always REDUCE the period. Some Avalara exports already sign the
 * amounts negative on a Return Invoice, others do not - forcing the magnitude
 * negative is correct under both conventions.
 */
function signedValue(v: number, ret: boolean): number {
  return ret ? -Math.abs(v) : v;
}

export function codeKey(name: string | null | undefined) {
  // "CTY" is how the Oklahoma COPO chart writes County ("JOHNSTON CTY").
  return norm(name).replace(/\s+(county|parish|city|cty)$/i, "");
}

/**
 * Special districts are where Avalara and the state spell names differently:
 * "BEXAR CO ESD 3 SP" is the Comptroller's "Bexar County Emergency Services
 * District No. 3", "HOUSTON MTA TRANSIT" is "Houston MTA". Both sides reduce to
 * the same key. Names with a "/" (Texas combined areas) never match an Avalara
 * row, which lists the city and the district separately.
 */
export function specialKey(name: string | null | undefined) {
  const ABBREVIATIONS: [RegExp, string][] = [
    [/\bco\b|\bcnty\b/g, "county"],
    [/\besd\b/g, "emergency services district"],
    [/\bemsd\b/g, "emergency medical services district"],
    [/\bfcp\b/g, "fire control prevention"],
    [/\bccpd\b/g, "crime control and prevention district"],
    [/\bmdd\b/g, "municipal development district"],
    [/\bsvcs?\b/g, "services"],
    [/\bpub\b/g, "public"],
    [/\blib\b/g, "library"],
    [/\bdist\b/g, "district"],
  ];
  let s = norm(name)
    .replace(/&/g, " and ")
    .replace(/\bno\.?\s*(?=\d)/g, " ") // "No. 3", "NO.200", "No 6-A"
    .replace(/[.,#()]/g, " ")
    .replace(/(\d)-([a-z])\b/g, "$1$2"); // "8-A" = "8A"
  for (const [re, to] of ABBREVIATIONS) s = s.replace(re, to);
  return s
    .replace(/\bfire control and prevention\b/g, "fire control prevention")
    .replace(/\bemergency services(?! district)/g, "emergency services district")
    .replace(/\bcrime control( and prevention)?( district)?\b/g, "crime control")
    .replace(/\bcommunity\b/g, " ")
    .replace(/\s+(sp|transit)$/g, "")
    .replace(/\s+(sp|transit)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The engine's lookup key. Exported so directory promotion detects exactly the collisions this index would have. */
export function indexKey(type: string, name: string | null | undefined) {
  return `${type}|${type === "special" ? specialKey(name) : codeKey(name)}`;
}

function buildCodeIndex(codes: JurisdictionCode[]) {
  const byName = new Map<string, JurisdictionCode>();
  // Where a hand-entered or seeded code and a directory code share a key, the
  // person's code wins - it is loaded last, so it is the one left in the map.
  const ordered = [...codes].sort((a, b) => Number(!a.fromDirectory) - Number(!b.fromDirectory));
  for (const c of ordered) {
    byName.set(indexKey(c.jurisdictionType, c.jurisdictionName), c);
    if (c.avalaraAlias) byName.set(indexKey(c.jurisdictionType, c.avalaraAlias), c);
  }
  return {
    lookup(type: string, name: string | null | undefined): JurisdictionCode | null {
      if (!name) return null;
      return byName.get(indexKey(type, name)) ?? null;
    },
  };
}

function emptyLine(partial: Partial<JurisdictionLine>): JurisdictionLine {
  return {
    type: "",
    name: "",
    county: null,
    city: null,
    code: null,
    pairedCode: null,
    pairedName: null,
    officialRate: null,
    gross: 0,
    exempt: 0,
    taxable: 0,
    rate: 0,
    tax: 0,
    taxComputed: 0,
    unmapped: false,
    ...partial,
  };
}

export function computeSales(
  rows: TxRow[],
  opts: { config: SalesConfig; codes: JurisdictionCode[]; period: string },
): SalesResult {
  const { config, period } = opts;
  const index = buildCodeIndex(opts.codes);
  const notes: string[] = [];
  const warnings: string[] = [];

  let gross = 0;
  let exempt = 0;
  let taxCollected = 0;
  let stateTaxCollected = 0;
  let localTaxCollected = 0;
  let returnLineCount = 0;

  const seenLines = new Set<string>();
  const documents = new Set<string>();

  /* Per-jurisdiction-row accumulation (tax: every row, never deduped). */
  const jurAcc = new Map<string, JurisdictionLine>();
  /**
   * Tax by DESTINATION county, taken from the rows directly. Rolling it up from
   * the jurisdiction lines instead would dump the whole state-level tax into
   * whichever county happened to appear first, inflating that county's rate.
   */
  const countyTax = new Map<string, number>();
  const cityTax = new Map<string, number>();
  /* Destination rollups, built from deduped State rows only. */
  const countyAcc = new Map<string, JurisdictionLine>();
  const cityAcc = new Map<string, JurisdictionLine>();

  for (const r of rows) {
    const ret = isReturn(r);
    documents.add(r.documentId);

    // ---- Tax: sum across ALL jurisdiction rows -------------------------
    const rowTax = signedValue(r.taxAmount, ret);
    taxCollected += rowTax;
    if (isState(r)) stateTaxCollected += rowTax;
    else localTaxCollected += rowTax;

    const jType = (r.jurisdictionType ?? "Unknown").trim();
    const jName = (r.jurisdictionDescription ?? r.destCounty ?? r.destCity ?? jType).trim();
    const jKey = `${jType}|${jName}`;
    const jLine =
      jurAcc.get(jKey) ??
      emptyLine({ type: jType, name: jName, county: r.destCounty, city: r.destCity });
    jLine.tax += rowTax;
    jLine.taxable += signedValue(r.taxableAmount, ret);
    jLine.exempt += signedValue(r.exemptAmount, ret);
    if (r.rate > 0 && jLine.rate === 0) jLine.rate = r.rate;
    jurAcc.set(jKey, jLine);

    const destCounty = r.destCounty ?? r.jurisdictionDescription ?? "UNKNOWN";
    countyTax.set(norm(destCounty), (countyTax.get(norm(destCounty)) ?? 0) + rowTax);
    if (r.destCity) {
      const ck = `${norm(r.destCity)}|${norm(destCounty)}`;
      cityTax.set(ck, (cityTax.get(ck) ?? 0) + rowTax);
    }

    // ---- Sales figures: State rows only, deduped ------------------------
    if (!isState(r)) continue;
    const key = `${r.documentId}|${r.lineNo}|${r.itemCode ?? ""}|${r.ref1 ?? ""}`;
    if (seenLines.has(key)) continue;
    seenLines.add(key);
    if (ret) returnLineCount += 1;

    const lineGross = signedValue(r.lineAmount - r.discountAmount, ret);
    const lineExempt = signedValue(r.exemptAmount, ret);
    gross += lineGross;
    exempt += lineExempt;

    const countyName = r.destCounty ?? r.jurisdictionDescription ?? "UNKNOWN";
    const cLine =
      countyAcc.get(norm(countyName)) ??
      emptyLine({ type: "County", name: countyName, county: countyName });
    cLine.gross += lineGross;
    cLine.exempt += lineExempt;
    cLine.taxable += lineGross - lineExempt;
    countyAcc.set(norm(countyName), cLine);

    if (r.destCity) {
      const ck = `${norm(r.destCity)}|${norm(countyName)}`;
      const cityLine =
        cityAcc.get(ck) ??
        emptyLine({ type: "City", name: r.destCity, city: r.destCity, county: countyName });
      cityLine.gross += lineGross;
      cityLine.exempt += lineExempt;
      cityLine.taxable += lineGross - lineExempt;
      cityAcc.set(ck, cityLine);
    }
  }

  gross = round2(gross);
  exempt = round2(exempt);
  const taxable = round2(gross - exempt);
  taxCollected = round2(taxCollected);
  stateTaxCollected = round2(stateTaxCollected);
  localTaxCollected = round2(localTaxCollected);

  /* Attach the destination tax totals collected above. */
  for (const [key, line] of countyAcc) line.tax = round2(countyTax.get(key) ?? 0);
  for (const [key, line] of cityAcc) line.tax = round2(cityTax.get(key) ?? 0);

  /* Resolve official filing codes. */
  const byJurisdiction = [...jurAcc.values()].map((l) => finalizeLine(l, index, config));
  const byCounty = [...countyAcc.values()]
    .map((l) => finalizeLine(l, index, config))
    .sort((a, b) => b.taxable - a.taxable);
  const byCity = [...cityAcc.values()]
    .map((l) => finalizeLine(l, index, config))
    .sort((a, b) => b.taxable - a.taxable);

  /* ---- Collected vs computed --------------------------------------- */
  const combinedLocal = byCounty.some(
    (l) => l.code && l.officialRate !== null && l.officialRate > 0 && lineIncludesState(l, opts.codes),
  );
  let taxComputed: number;

  if (config.allocation === "flat" || !config.hasLocal) {
    taxComputed = round2(taxable * config.stateRate);
  } else if (combinedLocal) {
    // WY / AZ style: the published county rate already includes the state rate.
    taxComputed = round2(
      byCounty.reduce(
        (sum, l) => sum + (l.officialRate !== null && l.officialRate > 0 ? l.taxable * l.officialRate : l.tax),
        0,
      ),
    );
  } else {
    const stateComputed = taxable * config.stateRate;
    const localComputed = byJurisdiction
      .filter((l) => norm(l.type) !== "state")
      .reduce(
        (sum, l) =>
          sum + (l.officialRate !== null && l.officialRate > 0 ? l.taxable * l.officialRate : l.tax),
        0,
      );
    taxComputed = round2(stateComputed + localComputed);
  }

  taxComputed = applyRounding(taxComputed, config.rounding);
  const delta = round2(taxComputed - taxCollected);

  /* ---- Validation ---------------------------------------------------- */
  const reconcileDiff = round2(gross - (taxable + exempt));
  const reconciles = Math.abs(reconcileDiff) <= TOLERANCE;
  if (!reconciles) {
    warnings.push(
      `RECONCILIATION FAILED: Taxable + Exempt (${round2(taxable + exempt)}) != Gross (${gross}). Difference ${reconcileDiff}. Do not file this worksheet.`,
    );
  }
  if (Math.abs(delta) >= 0.01) {
    warnings.push(
      delta > 0
        ? `UNDER-COLLECTION: the state's rate assesses ${taxComputed.toFixed(2)} but Avalara collected ${taxCollected.toFixed(2)} - a ${Math.abs(delta).toFixed(2)} margin hit. Check the Avalara rate config.`
        : `OVER-COLLECTION: Avalara collected ${taxCollected.toFixed(2)} vs computed ${taxComputed.toFixed(2)} (+${Math.abs(delta).toFixed(2)}). Remit what was collected unless the state says otherwise.`,
    );
  }
  /**
   * TX and OK (city_county) returns list each local TAXING authority - city,
   * taxing county, transit authority, special district. Every destination
   * county gets a rollup line here, but Travis or Harris County levies nothing,
   * so it has no code and needs none; a transit authority that collected tax
   * does. There, check the jurisdictions Avalara actually taxed under.
   */
  const unmapped =
    config.allocation === "city_county"
      ? byJurisdiction.filter((l) => l.unmapped && norm(l.type) !== "state" && l.tax !== 0)
      : [...byCounty, ...byCity].filter((l) => l.unmapped && norm(l.type) !== "special" && l.taxable !== 0);
  if (config.allocation !== "flat" && unmapped.length) {
    warnings.push(
      `${unmapped.length} jurisdiction(s) have no official filing code loaded: ${unmapped
        .slice(0, 8)
        .map((l) => l.name)
        .join(", ")}. Add them in Config > Jurisdiction Codes before filing.`,
    );
  }
  if (config.rounding === "whole_dollar") {
    notes.push("This form rounds to whole dollars.");
  }
  if (returnLineCount > 0) {
    notes.push(`${returnLineCount} return line(s) netted against the period.`);
  }

  const due = isoDate(dueDate(period, config.dueDay));
  if (new Date(due) < new Date()) {
    notes.push(`Due date ${due} has passed - penalty/interest may apply and any vendor discount is forfeited.`);
  }

  return {
    state: config.state,
    taxType: "sales",
    period,
    periodLabel: periodLabel(period),
    frequency: config.frequency,
    form: config.formName,
    portal: config.portal,
    dueDate: due,
    rounding: config.rounding,
    allocation: config.allocation,
    stateRate: config.stateRate,
    hasLocal: config.hasLocal,
    gross,
    exempt,
    taxable,
    taxCollected,
    taxComputed,
    delta,
    stateTaxCollected,
    localTaxCollected,
    reconciles,
    reconcileDiff,
    documentCount: documents.size,
    lineCount: seenLines.size,
    rowCount: rows.length,
    returnLineCount,
    byJurisdiction: byJurisdiction.sort((a, b) => b.tax - a.tax),
    byCounty,
    byCity,
    notes,
    warnings,
  };
}

function lineIncludesState(line: JurisdictionLine, codes: JurisdictionCode[]): boolean {
  return codes.some(
    (c) => codeKey(c.jurisdictionName) === codeKey(line.name) && c.rateIncludesState,
  );
}

function finalizeLine(
  line: JurisdictionLine,
  index: ReturnType<typeof buildCodeIndex>,
  config: SalesConfig,
): JurisdictionLine {
  const type = norm(line.type);
  // Avalara's "Special Tax Jurisdiction" rows look up codes stored as "special" -
  // before this they searched for "special tax jurisdiction" and never matched.
  const lookupType = type.includes("city")
    ? "city"
    : type.includes("county")
      ? "county"
      : type.includes("special")
        ? "special"
        : type;
  // Only a COUNTY line may fall back to the county name. A city line that
  // borrowed its county's code would file, say, Bethany's sales under the
  // Oklahoma City COPO code.
  const match =
    index.lookup(lookupType, line.name) ??
    (lookupType === "county" ? index.lookup(lookupType, line.county) : null) ??
    index.lookup("local", line.name);

  line.gross = round2(line.gross);
  line.exempt = round2(line.exempt);
  line.taxable = round2(line.taxable);
  line.tax = round2(line.tax);

  if (match) {
    line.code = match.officialCode;
    line.pairedCode = match.pairedCode;
    line.pairedName = match.pairedName;
    line.officialRate = match.rate;
    line.unmapped = false;
  } else {
    line.officialRate = null;
    line.unmapped = lookupType === "county" || lookupType === "city" || lookupType === "special";
  }

  /**
   * The displayed rate is derived from the row's own arithmetic wherever
   * possible - that is exact and immune to whether the export wrote the rate
   * column as a decimal or a percentage.
   */
  if (line.taxable !== 0 && line.tax !== 0) {
    line.rate = Math.round((line.tax / line.taxable) * 1e6) / 1e6;
  } else if (line.officialRate !== null) {
    line.rate = line.officialRate;
  }

  /**
   * The COMPUTED tax uses the official rate from our own editable table when we
   * have one - that is the rate the state's form will assess. With no official
   * rate loaded, the honest figure is what was actually collected; inventing
   * one from the import would be a guess.
   */
  line.taxComputed =
    line.officialRate !== null
      ? applyRounding(line.taxable * line.officialRate, config.rounding)
      : line.tax;
  return line;
}
