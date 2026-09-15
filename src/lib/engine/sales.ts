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
  /**
   * County (or "A; B" counties) the code belongs to. Where one name has several
   * codes - a city with one code per county portion - the destination county
   * picks the right one.
   */
  countyName?: string | null;
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

/**
 * One spelling for a place name, whoever wrote it. Covers what state charts and
 * Avalara actually do: "Ithaca (city)", "De Soto (Johnson County)", Missouri's
 * "COLUMBIA / BOONE COUNTY / ..." chart blocks, "St. Johns County" vs "SAINT
 * JOHNS", OK's "JOHNSTON CTY", "MORTON CO", WA's "Asotin County Unincorp. Areas",
 * Minnesota's "Duluth Sales", "City of Milwaukee".
 */
export function codeKey(name: string | null | undefined) {
  let s = norm(name).replace(/\([^)]*\)/g, " ");
  const slash = s.indexOf(" / ");
  if (slash > 0) s = s.slice(0, slash);
  s = s
    .replace(/\./g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/^(city|town|village) of /, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(/\s+(unincorp areas|unincorporated areas?|unincorporated|remainder)$/, "")
      .replace(/\s+(sales tax|sales)$/, "")
      .replace(/\s+(county|parish|city|cty|co|brg|borough)$/, "")
      .trim();
  }
  return s;
}

/**
 * Special districts are where Avalara and the state spell names differently:
 * "BEXAR CO ESD 3 SP" is the Comptroller's "Bexar County Emergency Services
 * District No. 3", "HOUSTON MTA TRANSIT" is "Houston MTA", "WAKE CO TR" is
 * "Wake County Transit Tax", "CENTRAL OHIO TRANSIT AUTHORITY TAX" is "Central
 * Ohio Transit Authority (COTA)". Both sides reduce to the same key. Texas
 * combined areas ("Hutto/Williamson ESD 3") never match an Avalara row, which
 * lists the city and the district separately.
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
    [/\bsaint\b/g, "st"],
  ];
  let s = norm(name)
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\bno\.?\s*(?=\d)/g, " ") // "No. 3", "NO.200", "No 6-A"
    .replace(/[.,#]/g, " ")
    .replace(/(\d)-([a-z])\b/g, "$1$2"); // "8-A" = "8A"
  for (const [re, to] of ABBREVIATIONS) s = s.replace(re, to);
  s = s
    .replace(/\bfire control and prevention\b/g, "fire control prevention")
    .replace(/\bemergency services(?! district)/g, "emergency services district")
    .replace(/\bcrime control( and prevention)?( district)?\b/g, "crime control")
    .replace(/\bcommunity\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Trailing words that say what kind of tax it is, not which district.
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\s+(sp|sl|tr|tax|transit|sales|district|authority|public transportation)$/, "").trim();
  }
  return s;
}

/** The engine's lookup key. Exported so directory promotion detects exactly the collisions this index would have. */
export function indexKey(type: string, name: string | null | undefined) {
  return `${type}|${type === "special" ? specialKey(name) : codeKey(name)}`;
}

const countiesOf = (c: JurisdictionCode) =>
  (c.countyName ?? "").split(/[;,]/).map((x) => codeKey(x)).filter(Boolean);

function buildCodeIndex(codes: JurisdictionCode[]) {
  const byKey = new Map<string, JurisdictionCode[]>();
  const add = (key: string, c: JurisdictionCode) => {
    const list = byKey.get(key) ?? [];
    if (!list.includes(c)) list.push(c);
    byKey.set(key, list);
  };
  for (const c of codes) {
    add(indexKey(c.jurisdictionType, c.jurisdictionName), c);
    if (c.avalaraAlias) add(indexKey(c.jurisdictionType, c.avalaraAlias), c);
  }
  const oneCode = (list: JurisdictionCode[]) => list.every((c) => c.officialCode === list[0].officialCode);
  return {
    /**
     * A single code for the name wins outright. Several: a hand-entered or
     * seeded code beats the directory's; then the destination county decides;
     * then Missouri's base "-000" code (no district) within that county. Still
     * more than one code means a person has to choose - null, and the line is
     * flagged rather than filed under a guess.
     */
    lookup(type: string, name: string | null | undefined, county?: string | null): JurisdictionCode | null {
      if (!name) return null;
      let list = byKey.get(indexKey(type, name)) ?? [];
      if (!list.length) return null;
      const manual = list.filter((c) => !c.fromDirectory);
      if (manual.length) list = manual;
      if (oneCode(list)) return list[0];
      const k = codeKey(county);
      if (k) {
        const inCounty = list.filter((c) => countiesOf(c).includes(k));
        if (inCounty.length && oneCode(inCounty)) return inCounty[0];
        const base = inCounty.filter((c) => /-000$/.test(c.officialCode));
        if (base.length === 1) return base[0];
      }
      return null;
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

  const byLocation = RETURN_MODEL[config.state] === "location"
    ? locationLines(rows, byCity, byCounty, index, config)
    : undefined;

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
  // The same lines the screens and workbooks show - a warning about a line the
  // return does not have is noise, and a missing line the return needs is not.
  const unmapped = linesForReturn(config.state, byJurisdiction, byCounty, byLocation).filter(
    (l) => l.unmapped && (l.taxable !== 0 || l.tax !== 0),
  );
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
    ...(byLocation ? { byLocation } : {}),
    notes,
    warnings,
  };
}

/**
 * How each state's return lays out local tax.
 *
 * - county: every destination county is a line, with its gross (NV wants total
 *   and exempt sales per county; WY and AZ county rates include the state's).
 * - location: one code per place - a city within a county, or the county's
 *   unincorporated remainder - reported at that place's total rate (KS, MO, NM,
 *   UT, WA, TN situs codes, OK's paired city + county COPO).
 * - authority (every other state): each taxing jurisdiction Avalara collected
 *   for - city, taxing county, transit authority, special district - on its own
 *   line. Texas is the model case: Travis County levies nothing and is not a line.
 */
export const RETURN_MODEL: Record<string, "county" | "location"> = {
  WY: "county", NV: "county", AZ: "county",
  OK: "location", KS: "location", MO: "location", NM: "location", UT: "location", WA: "location", TN: "location",
};

/** Avalara lists these separately, but the return includes them in other codes. */
const INCLUDED_IN_OTHER_CODES: Record<string, RegExp[]> = {
  // Pub 718: the MCTD 3/8% is built into each county's and city's reporting code.
  NY: [/metropolitan commuter transportation/i],
};

function linesForReturn(
  state: string,
  byJurisdiction: JurisdictionLine[],
  byCounty: JurisdictionLine[],
  byLocation: JurisdictionLine[] | undefined,
): JurisdictionLine[] {
  const active = (l: JurisdictionLine) => l.taxable !== 0 || l.tax !== 0 || l.gross !== 0;
  // Avalara collected no local tax at all (AK, DE, MT, NH, OR, or a state-only
  // program like AL's SSUT): there is nothing to allocate and nothing to code.
  if (!byJurisdiction.some((l) => norm(l.type) !== "state" && (l.tax !== 0 || l.taxable !== 0))) return [];
  const model = RETURN_MODEL[state];
  if (model === "county" || (model === "location" && !byLocation)) return byCounty.filter(active);
  if (model === "location") return byLocation!.filter(active);
  return byJurisdiction.filter((l) => norm(l.type) !== "state" && active(l)).sort((a, b) => b.tax - a.tax);
}

/** The local lines this state's return actually lists - see RETURN_MODEL. */
export function allocationLines(r: SalesResult): JurisdictionLine[] {
  return linesForReturn(r.state, r.byJurisdiction, r.byCounty, r.byLocation);
}

/** Heading for allocationLines, so every screen and workbook says what the rows are. */
export function allocationLabel(r: SalesResult): string {
  const model = RETURN_MODEL[r.state];
  if (model === "county") return "Jurisdiction allocation (by destination county)";
  if (model === "location") return "Locations (each city within its county, and the county's unincorporated remainder)";
  if (r.state === "TX") return "Local taxing authorities (Comptroller codes - city, taxing county, transit, special district)";
  return "Local taxing jurisdictions (each city, county, transit or special district that collected tax)";
}

/**
 * Location-model states: a sale in a city that levies its own tax is reported
 * under that city's code for its county; everything else in the county under
 * the county's (unincorporated) code.
 */
function locationLines(
  rows: TxRow[],
  byCity: JurisdictionLine[],
  byCounty: JurisdictionLine[],
  index: ReturnType<typeof buildCodeIndex>,
  config: SalesConfig,
): JurisdictionLine[] {
  const taxingCities = new Set(
    rows
      .filter((r) => /city/i.test(r.jurisdictionType ?? ""))
      .map((r) => `${codeKey(r.jurisdictionDescription ?? r.destCity)}|${codeKey(r.destCounty)}`),
  );
  const cities = byCity.filter((l) => taxingCities.has(`${codeKey(l.city)}|${codeKey(l.county)}`));
  const lines = [...cities];
  for (const county of byCounty) {
    const inside = cities.filter((l) => codeKey(l.county) === codeKey(county.name));
    const less = (k: "gross" | "exempt" | "taxable" | "tax") => round2(county[k] - inside.reduce((a, l) => a + l[k], 0));
    const remainder = emptyLine({
      type: "County",
      name: county.name,
      county: county.name,
      gross: less("gross"),
      exempt: less("exempt"),
      taxable: less("taxable"),
      tax: less("tax"),
    });
    if (remainder.gross !== 0 || remainder.taxable !== 0 || remainder.tax !== 0) {
      lines.push(finalizeLine(remainder, index, config));
    }
  }
  return lines.sort((a, b) => b.taxable - a.taxable);
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
    index.lookup(lookupType, line.name, line.county) ??
    (lookupType === "county" ? index.lookup(lookupType, line.county, line.county) : null) ??
    index.lookup("local", line.name, line.county) ??
    // A county's own transit district is reported under the county's code
    // (NY: "DUTCHESS CO TRANSIT DISTRICT" is filed as Dutchess County 1311).
    (lookupType === "special" && / county$/.test(specialKey(line.name))
      ? index.lookup("county", specialKey(line.name), line.county)
      : null);

  line.gross = round2(line.gross);
  line.exempt = round2(line.exempt);
  line.taxable = round2(line.taxable);
  line.tax = round2(line.tax);

  const includedElsewhere = INCLUDED_IN_OTHER_CODES[config.state]?.find((re) => re.test(line.name));
  if (match) {
    line.code = match.officialCode;
    line.pairedCode = match.pairedCode;
    line.pairedName = match.pairedName;
    line.officialRate = match.rate;
    line.unmapped = false;
  } else if (includedElsewhere) {
    line.code = "in local codes";
    line.officialRate = null;
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
