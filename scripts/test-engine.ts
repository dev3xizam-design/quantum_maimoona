/**
 * Engine tests. These lock in the numbers the docs proved by hand:
 * the Kentucky under-collection, the Kansas EC-2 receipts figure, the dedupe
 * rule, and the Taxable + Exempt = Gross invariant.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { computeSales, type SalesConfig } from "../src/lib/engine/sales";
import { computeExcise } from "../src/lib/engine/excise";
import type { TxRow } from "../src/lib/engine/types";
import { dueDate, filingPeriod, isoDate, monthsInPeriod } from "../src/lib/periods";
import { round2 } from "../src/lib/money";
import { buildHeaderMap, missingRequired, normalizeRow, parseMlFromDescription } from "../src/lib/ingest/avalara";

const baseConfig: SalesConfig = {
  state: "XX",
  frequency: "MONTHLY",
  stateRate: 0.06,
  hasLocal: false,
  allocation: "flat",
  rounding: "cents",
  portal: null,
  formName: null,
  dueDay: 20,
};

function line(
  docId: string,
  lineNo: string,
  jurType: string,
  amounts: { amount?: number; taxable?: number; exempt?: number; tax?: number; rate?: number },
  extra: Partial<TxRow> = {},
): TxRow {
  return {
    documentId: docId,
    lineNo,
    ref1: null,
    itemCode: "SKU1",
    itemDescription: "30ML Bottle",
    docType: "Sales Invoice",
    documentDate: "2026-07-15",
    period: "2026-07",
    state: "XX",
    destCounty: "Alpha",
    destCity: "Alphaville",
    destZip: "10001",
    jurisdictionType: jurType,
    jurisdictionDescription: jurType === "State" ? "XX" : "Alpha",
    rate: amounts.rate ?? 0,
    lineAmount: amounts.amount ?? 0,
    discountAmount: 0,
    taxableAmount: amounts.taxable ?? 0,
    exemptAmount: amounts.exempt ?? 0,
    taxAmount: amounts.tax ?? 0,
    quantity: 1,
    ...extra,
  };
}

test("the pre-exploded export is deduped: gross is not multiplied by jurisdiction count", () => {
  // One $100 sale, exploded into State + County + City rows.
  const rows = [
    line("INV1", "1", "State", { amount: 100, taxable: 100, tax: 6, rate: 0.06 }),
    line("INV1", "1", "County", { amount: 100, taxable: 100, tax: 1, rate: 0.01 }),
    line("INV1", "1", "City", { amount: 100, taxable: 100, tax: 0.5, rate: 0.005 }),
  ];
  const r = computeSales(rows, { config: { ...baseConfig, hasLocal: true, allocation: "county" }, codes: [], period: "2026-07" });

  assert.equal(r.gross, 100, "gross must count the line once, not three times");
  assert.equal(r.taxCollected, 7.5, "tax must sum across ALL jurisdiction rows");
  assert.equal(r.lineCount, 1);
  assert.equal(r.rowCount, 3);
});

test("Taxable + Exempt = Gross holds and is reported", () => {
  const rows = [
    line("INV1", "1", "State", { amount: 100, taxable: 95.47, exempt: 4.53, tax: 5.73, rate: 0.06 }),
  ];
  const r = computeSales(rows, { config: baseConfig, codes: [], period: "2026-07" });
  assert.equal(r.gross, 100);
  assert.equal(r.exempt, 4.53);
  assert.equal(r.taxable, 95.47);
  assert.equal(r.reconciles, true);
});

test("return invoices net against the period regardless of export sign convention", () => {
  const positive = line("CM1", "1", "State", { amount: 50, taxable: 50, tax: 3 }, { docType: "Return Invoice" });
  const negative = line("CM2", "1", "State", { amount: -50, taxable: -50, tax: -3 }, { docType: "Return Invoice" });
  const sale = line("INV1", "1", "State", { amount: 200, taxable: 200, tax: 12 });

  const r = computeSales([sale, positive, negative], { config: baseConfig, codes: [], period: "2026-07" });
  assert.equal(r.gross, 100, "200 - 50 - 50");
  assert.equal(r.taxCollected, 6, "12 - 3 - 3");
  assert.equal(r.returnLineCount, 2);
});

test("Kentucky under-collection is surfaced (the margin hit from the docs)", () => {
  // 6% of 308.57 = 18.51, but Avalara collected 13.13.
  const rows = [line("INV1", "1", "State", { amount: 308.57, taxable: 308.57, tax: 13.13, rate: 0.0425 })];
  const r = computeSales(rows, {
    config: { ...baseConfig, state: "KY", stateRate: 0.06 },
    codes: [],
    period: "2026-07",
  });

  assert.equal(r.taxComputed, 18.51);
  assert.equal(r.taxCollected, 13.13);
  assert.equal(r.delta, 5.38);
  assert.ok(r.warnings.some((w) => w.includes("UNDER-COLLECTION")));
});

test("whole-dollar states round the tax the way the form does", () => {
  const rows = [line("INV1", "1", "State", { amount: 822.4, taxable: 822.4, tax: 57.57, rate: 0.07 })];
  const r = computeSales(rows, {
    config: { ...baseConfig, state: "TN", stateRate: 0.07, rounding: "whole_dollar" },
    codes: [],
    period: "2026-07",
  });
  assert.equal(r.taxComputed, 58);
});

test("Oklahoma city rows carry the paired county COPO code", () => {
  const rows = [
    line("INV1", "1", "State", { amount: 500, taxable: 500, tax: 22.5, rate: 0.045 }, { destCity: "Edmond", destCounty: "Oklahoma" }),
    line("INV1", "1", "City", { amount: 500, taxable: 500, tax: 20, rate: 0.04 }, { destCity: "Edmond", destCounty: "Oklahoma" }),
  ];
  const r = computeSales(rows, {
    config: { ...baseConfig, state: "OK", stateRate: 0.045, hasLocal: true, allocation: "city_county", rounding: "whole_dollar" },
    codes: [
      { jurisdictionName: "Oklahoma City", jurisdictionType: "city", officialCode: "5521", pairedCode: "5588", pairedName: "Oklahoma", rate: 0.04, rateIncludesState: false, avalaraAlias: "Edmond" },
      { jurisdictionName: "Oklahoma", jurisdictionType: "county", officialCode: "5588", pairedCode: null, pairedName: null, rate: 0, rateIncludesState: false, avalaraAlias: null },
    ],
    period: "2026-07",
  });

  const city = r.byCity.find((c) => c.name === "Edmond");
  assert.ok(city, "the Edmond destination must appear");
  assert.equal(city.code, "5521", "Edmond is taxed as Oklahoma City");
  assert.equal(city.pairedCode, "5588", "the county pair must come with it");
});

test("Wyoming county rates that already include the state rate are not double counted", () => {
  const rows = [line("INV1", "1", "State", { amount: 36.94, taxable: 36.94, tax: 1.94, rate: 0.0525 }, { destCounty: "Goshen" })];
  const r = computeSales(rows, {
    config: { ...baseConfig, state: "WY", stateRate: 0.04, hasLocal: true, allocation: "county" },
    codes: [
      { jurisdictionName: "Goshen", jurisdictionType: "county", officialCode: "0700", pairedCode: null, pairedName: null, rate: 0.0525, rateIncludesState: true, avalaraAlias: null },
    ],
    period: "2026-07",
  });
  assert.equal(r.taxComputed, 1.94, "36.94 x 5.25% combined, with no extra state layer");
});

test("Kansas EC-2 is a receipts-basis return: 617 mL purchased x $0.05 = $30.85", () => {
  const r = computeExcise({
    config: {
      state: "KS",
      structure: "C",
      basis: "RECEIPTS",
      rate: 0.05,
      rateUnit: "per_ml",
      openRate: null,
      openRateUnit: null,
      closedRate: null,
      closedRateUnit: null,
      frequency: "MONTHLY",
      portal: null,
      formName: "EC-2",
      dueDay: 20,
      notes: null,
    },
    period: "2026-07",
    rows: [
      // Sales rows must be IGNORED on a receipts-basis return.
      line("INV1", "1", "State", { amount: 900, taxable: 900, tax: 60 }),
    ],
    purchases: [
      { sku: "SKU1", description: "30ML", quantity: 10, mlTotal: 300, unitsTotal: 10, wholesaleCost: 90 },
      { sku: "SKU2", description: "Pods", quantity: 20, mlTotal: 317, unitsTotal: 20, wholesaleCost: 120 },
    ],
    products: [],
  });

  assert.equal(r.totalMl, 617);
  assert.equal(r.taxComputed, 30.85);
  assert.equal(r.basis, "RECEIPTS");
});

test("bifurcated excise splits open and closed at different rates and units", () => {
  const r = computeExcise({
    config: {
      state: "KY",
      structure: "E",
      basis: "SALES",
      rate: 0,
      rateUnit: "pct_wholesale",
      openRate: 0.15,
      openRateUnit: "pct_wholesale",
      closedRate: 1.5,
      closedRateUnit: "per_unit",
      frequency: "MONTHLY",
      portal: null,
      formName: null,
      dueDay: 20,
      notes: null,
    },
    period: "2026-07",
    rows: [
      line("INV1", "1", "State", { amount: 200, taxable: 200 }, { itemCode: "OPEN1", quantity: 4 }),
      line("INV2", "1", "State", { amount: 300, taxable: 300 }, { itemCode: "CLOSED1", quantity: 6 }),
    ],
    purchases: [],
    products: [
      { sku: "OPEN1", description: "Bottle", wholesaleCost: 25, retailPrice: 50, liquidMl: 60, cartridgesPerUnit: 1, systemType: "OPEN", containsNicotine: true },
      { sku: "CLOSED1", description: "Pod pack", wholesaleCost: 30, retailPrice: 50, liquidMl: 2, cartridgesPerUnit: 2, systemType: "CLOSED", containsNicotine: true },
    ],
  });

  const open = r.components.find((c) => c.label === "Open system")!;
  const closed = r.components.find((c) => c.label === "Closed system")!;
  assert.equal(open.tax, 15, "4 units x $25 wholesale x 15%");
  assert.equal(closed.tax, 18, "6 units x 2 cartridges x $1.50");
  assert.equal(r.taxComputed, 33);
});

test("frequency is resolved per tax type and drives the filing period", () => {
  assert.equal(filingPeriod("2026-07", "MONTHLY"), "2026-07");
  assert.equal(filingPeriod("2026-07", "QUARTERLY"), "2026-Q3");
  assert.equal(filingPeriod("2026-07", "ANNUAL"), "2026", "Kansas sales rolls into the annual return");
  assert.deepEqual(monthsInPeriod("2026-Q3"), ["2026-07", "2026-08", "2026-09"]);
  assert.equal(monthsInPeriod("2026").length, 12);
});

test("due dates: the 20th, PACT's 10th, and last-day states", () => {
  assert.equal(isoDate(dueDate("2026-07", 20)), "2026-08-20");
  assert.equal(isoDate(dueDate("2026-07", 10)), "2026-08-10", "PACT is due earlier than sales tax");
  assert.equal(isoDate(dueDate("2026-07", 0)), "2026-08-31", "0 means last day of the following month");
  assert.equal(isoDate(dueDate("2026-01", 0)), "2026-02-28");
  assert.equal(isoDate(dueDate("2026", 25)), "2027-01-25", "an annual period is due after year end");
});

test("Avalara header mapping tolerates alias columns and rejects incomplete files", () => {
  const map = buildHeaderMap([
    "STATEPROVINCE", "DOCUMENTDATE", "DOCUMENTID", "LINENO",
    "JURISDICTIONTYPEDESCRIPTION", "LINEAMOUNT", "TAXAMOUNT", "LINEEXEMPTAMOUNT", "DOCTYPE",
  ]);
  assert.deepEqual(missingRequired(map), []);
  assert.deepEqual(missingRequired(buildHeaderMap(["STATEPROVINCE"])).length > 0, true);

  const row = normalizeRow(
    {
      STATEPROVINCE: "fl",
      DOCUMENTDATE: "7/15/2026",
      DOCUMENTID: "INV-1",
      LINENO: "1",
      JURISDICTIONTYPEDESCRIPTION: "State",
      LINEAMOUNT: "$1,234.56",
      TAXAMOUNT: "(12.34)",
      LINEEXEMPTAMOUNT: "",
      DOCTYPE: "Return Invoice",
    },
    map,
    "test.csv",
  )!;

  assert.equal(row.state, "FL");
  assert.equal(row.documentDate, "2026-07-15");
  assert.equal(row.period, "2026-07");
  assert.equal(row.lineAmount, 1234.56);
  assert.equal(row.taxAmount, -12.34, "parenthesised negatives are negative");
  assert.equal(row.sign, -1);
});

test("mL is parsed from bottled e-juice names but not invented for pods", () => {
  assert.equal(parseMlFromDescription("Strawberry 30ML Freebase"), 30);
  assert.equal(parseMlFromDescription("Blue Razz 100 ml"), 100);
  assert.equal(parseMlFromDescription("Disposable Pod 5000 Puffs"), null);
});

/* ------------------------------------------------------------------ */
/* Product classification - reads names, never invents numbers         */
/* ------------------------------------------------------------------ */

test("volume is read from the name only when the name states it", async () => {
  const { classifyProduct } = await import("../src/lib/products/classify");

  assert.equal(classifyProduct("Strawberry Ice 100ML Salt Nic").liquidMl, 100);
  assert.equal(classifyProduct("Blue Razz 60 mL Freebase").liquidMl, 60);
  assert.equal(classifyProduct("Elf Bar BC5000 13ML Disposable").liquidMl, 13);

  // A puff count is NOT a volume - converting it would be a guess on a return.
  assert.equal(classifyProduct("Geek Bar Pulse 15000 Puffs").liquidMl, null);
  assert.equal(classifyProduct("Mystery Pod").liquidMl, null);
});

test("open vs closed is inferred from device wording, and left null when ambiguous", async () => {
  const { classifyProduct } = await import("../src/lib/products/classify");

  assert.equal(classifyProduct("Naked 100 Lava Flow 60ML E-Liquid").systemType, "OPEN");
  assert.equal(classifyProduct("Juul Pods Menthol 4 Pack").systemType, "CLOSED");
  assert.equal(classifyProduct("Lost Mary MO5000 Disposable").systemType, "CLOSED");

  // Bottle-sized volume with no device wording is refillable liquid.
  assert.equal(classifyProduct("Cloud Nurdz Grape Apple 100ML").systemType, "OPEN");

  // Both open and closed wording - a human must decide, so do not pick one.
  const ambiguous = classifyProduct("Refill Pods for Open System");
  assert.equal(ambiguous.systemType, null);
  assert.match(ambiguous.systemEvidence ?? "", /ambiguous/);
});

test("pack size and hardware are recognised", async () => {
  const { classifyProduct } = await import("../src/lib/products/classify");

  assert.equal(classifyProduct("Vuse Alto Pods 2 Pack").cartridgesPerUnit, 2);
  assert.equal(classifyProduct("SMOK Novo Pods 3ct").cartridgesPerUnit, 3);

  const coil = classifyProduct("SMOK RPM Replacement Coils 5 Pack");
  assert.equal(coil.isHardware, true);
  assert.equal(coil.containsNicotine, false, "coils are not consumable nicotine material");
  assert.equal(coil.systemType, null);

  const zero = classifyProduct("Pachamama 0MG Zero Nicotine 60ML");
  assert.equal(zero.containsNicotine, false);
});

test("classification explains itself so the number is auditable", async () => {
  const { classifyProduct, classificationSummary } = await import("../src/lib/products/classify");
  const summary = classificationSummary(classifyProduct("Juul Pods Mango 4 Pack"));
  assert.match(summary, /4 per unit/);
  assert.match(summary, /pod/);
});

test("excise names the SKUs that are missing cost rather than silently under-taxing", () => {
  const r = computeExcise({
    config: {
      state: "PA", structure: "A", basis: "SALES", rate: 0.4, rateUnit: "pct_wholesale",
      openRate: null, openRateUnit: null, closedRate: null, closedRateUnit: null,
      frequency: "MONTHLY", portal: null, formName: null, dueDay: 20, notes: null,
    },
    period: "2026-07",
    rows: [
      line("INV1", "1", "State", { amount: 900, taxable: 900 }, { itemCode: "HASCOST", quantity: 10 }),
      line("INV2", "1", "State", { amount: 2500, taxable: 2500 }, { itemCode: "NOCOST", quantity: 25 }),
    ],
    purchases: [],
    products: [
      { sku: "HASCOST", description: "Priced", wholesaleCost: 20, retailPrice: 90, liquidMl: 60, cartridgesPerUnit: 1, systemType: "OPEN", containsNicotine: true },
      { sku: "NOCOST", description: "No cost loaded", wholesaleCost: null, retailPrice: 100, liquidMl: 60, cartridgesPerUnit: 1, systemType: "OPEN", containsNicotine: true },
    ],
  });

  assert.equal(r.taxComputed, 80, "only the SKU with a cost contributes: 10 x 20 x 40%");
  assert.equal(r.dataGaps.cost.length, 1);
  assert.equal(r.dataGaps.cost[0].sku, "NOCOST");
  assert.equal(r.dataGaps.cost[0].retail, 2500, "the affected revenue is quantified");
  assert.ok(r.warnings.some((w) => w.includes("WHOLESALE COST MISSING") && w.includes("NOCOST")));
});

/* ------------------------------------------------------------------ */
/* Rate scale and jurisdiction-code matching                           */
/* ------------------------------------------------------------------ */

test("a percentage-format rate column is detected from the row's own arithmetic", async () => {
  const { normalizeRate } = await import("../src/lib/ingest/avalara");

  // Percentage file: the column says 4.5 and the row really charged 4.4963%.
  assert.equal(normalizeRate(4.5, 850.48, 38.24), 0.045);
  // The same file's sub-1% county rate - magnitude alone would miss this one.
  assert.equal(normalizeRate(0.367, 380.58, 1.4), 0.00367);
  assert.equal(normalizeRate(2.0, 74.99, 1.5), 0.02);

  // Decimal file: the column already says 0.045 and the row agrees.
  assert.equal(normalizeRate(0.045, 850.48, 38.24), 0.045);

  // No arithmetic to check against: fall back to magnitude.
  assert.equal(normalizeRate(6.25, 0, 0), 0.0625);
  assert.equal(normalizeRate(0.0625, 0, 0), 0.0625);
  assert.equal(normalizeRate(0, 100, 0), 0);
});

test("a 100x rate column cannot inflate the computed tax", () => {
  // Same sale expressed both ways; the answer must not move.
  const asPercent = [
    line("INV1", "1", "State", { amount: 1000, taxable: 1000, tax: 45, rate: 4.5 }),
    line("INV1", "1", "County", { amount: 1000, taxable: 1000, tax: 3.67, rate: 0.367 }),
  ];
  const config = {
    ...baseConfig, state: "OK", stateRate: 0.045, hasLocal: true, allocation: "city_county" as const,
  };
  const r = computeSales(asPercent, { config, codes: [], period: "2026-08" });

  assert.equal(r.taxCollected, 48.67);
  assert.equal(r.taxComputed, 48.67, "state 45 computed at the official rate + county as collected");
  assert.ok(r.taxComputed < r.gross, "the tax can never exceed the sale");
});

test("a city never inherits its county's filing code", () => {
  const codes = [
    { jurisdictionName: "Oklahoma City", jurisdictionType: "city", officialCode: "5521", pairedCode: "5588", pairedName: "Oklahoma", rate: null, rateIncludesState: false, avalaraAlias: "Edmond" },
    { jurisdictionName: "Oklahoma", jurisdictionType: "county", officialCode: "5588", pairedCode: null, pairedName: null, rate: null, rateIncludesState: false, avalaraAlias: null },
  ];
  const rows = [
    // Bethany is its own city, but it sits in Oklahoma County.
    line("INV1", "1", "State", { amount: 100, taxable: 100, tax: 4.5 }, { destCity: "Bethany", destCounty: "Oklahoma" }),
    line("INV1", "1", "City", { amount: 100, taxable: 100, tax: 4 }, { destCity: "Bethany", destCounty: "Oklahoma", jurisdictionDescription: "BETHANY" }),
    // Edmond really is taxed as Oklahoma City - that mapping must still work.
    line("INV2", "1", "State", { amount: 200, taxable: 200, tax: 9 }, { destCity: "Edmond", destCounty: "Oklahoma" }),
    line("INV2", "1", "City", { amount: 200, taxable: 200, tax: 7.5 }, { destCity: "Edmond", destCounty: "Oklahoma", jurisdictionDescription: "EDMOND" }),
  ];
  const r = computeSales(rows, {
    config: { ...baseConfig, state: "OK", stateRate: 0.045, hasLocal: true, allocation: "city_county" },
    codes,
    period: "2026-08",
  });

  const bethany = r.byJurisdiction.find((l) => l.name === "BETHANY")!;
  assert.equal(bethany.code, null, "Bethany has no code loaded, so it must report as missing");
  assert.equal(bethany.unmapped, true);

  const edmond = r.byJurisdiction.find((l) => l.name === "EDMOND")!;
  assert.equal(edmond.code, "5521", "the Edmond -> Oklahoma City alias still resolves");
});

test("with no official rate loaded, a local jurisdiction contributes what was collected", () => {
  const rows = [
    line("INV1", "1", "State", { amount: 1000, taxable: 1000, tax: 45 }),
    line("INV1", "1", "County", { amount: 1000, taxable: 1000, tax: 12.34 }),
  ];
  const r = computeSales(rows, {
    config: { ...baseConfig, state: "XX", stateRate: 0.045, hasLocal: true, allocation: "county" },
    codes: [],
    period: "2026-08",
  });
  assert.equal(r.taxComputed, 57.34, "45 from the official state rate + 12.34 actually collected");
});

test("destination-county tax is not inflated by other destinations", () => {
  // Two sales to different counties. Each county's rollup must carry only its
  // own tax - including the state-level portion of its own sales.
  const rows = [
    line("INV1", "1", "State", { amount: 1000, taxable: 1000, tax: 45 }, { destCounty: "Alpha", destCity: "Alphaville" }),
    line("INV1", "1", "County", { amount: 1000, taxable: 1000, tax: 10 }, { destCounty: "Alpha", destCity: "Alphaville" }),
    line("INV2", "1", "State", { amount: 500, taxable: 500, tax: 22.5 }, { destCounty: "Beta", destCity: "Betaville" }),
    line("INV2", "1", "County", { amount: 500, taxable: 500, tax: 20 }, { destCounty: "Beta", destCity: "Betaville" }),
  ];
  const r = computeSales(rows, {
    config: { ...baseConfig, state: "OK", stateRate: 0.045, hasLocal: true, allocation: "county" },
    codes: [],
    period: "2026-08",
  });

  const alpha = r.byCounty.find((c) => c.name === "Alpha")!;
  const beta = r.byCounty.find((c) => c.name === "Beta")!;

  assert.equal(alpha.taxable, 1000);
  assert.equal(alpha.tax, 55, "45 state + 10 county, for Alpha's sales only");
  assert.equal(beta.taxable, 500);
  assert.equal(beta.tax, 42.5, "22.5 state + 20 county");
  assert.equal(round2(alpha.tax + beta.tax), r.taxCollected, "the rollup accounts for every cent");

  // The effective rate shown must be that destination's real combined rate.
  assert.equal(alpha.rate, 0.055);
  assert.equal(beta.rate, 0.085);
});

/* ------------------------------------------------------------------ */
/* Session handling                                                    */
/* ------------------------------------------------------------------ */

test("a session is a week long and refreshes once it is past half its life", async () => {
  process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hs256";
  const { signSession, verifySession, shouldRefresh, SESSION_MAX_AGE } = await import(
    "../src/lib/session-token"
  );

  assert.equal(SESSION_MAX_AGE, 60 * 60 * 24 * 7, "a working week, not twelve hours");

  const token = await signSession({ userId: 1, email: "a@b.c", name: "A", role: "admin" });
  const verified = await verifySession(token);
  assert.equal(verified?.session.email, "a@b.c");

  const now = Math.floor(Date.now() / 1000);
  assert.equal(shouldRefresh(now, now), false, "a fresh token is not re-issued");
  assert.equal(shouldRefresh(now - 60 * 60 * 24 * 2, now), false, "two days in, still fine");
  assert.equal(shouldRefresh(now - 60 * 60 * 24 * 5, now), true, "past half life, re-issue it");

  assert.equal(await verifySession("not-a-token"), null);
  assert.equal(await verifySession(""), null);
});

test("shipping, fees and gift cards are not treated as merchandise", async () => {
  const { classifyProduct } = await import("../src/lib/products/classify");

  for (const name of [
    "SHIPPING AND HANDLING FEE",
    "Package Protection",
    "Route Shipping Protection",
    "Gift Card $50",
    "Adult Signature Required",
    "Order Discount",
  ]) {
    const c = classifyProduct(name);
    assert.equal(c.isNonProduct, true, `${name} should not be merchandise`);
    assert.equal(c.containsNicotine, false, `${name} should not be a nicotine product`);
  }

  // A real product with the word "protection" nowhere near it is unaffected.
  const real = classifyProduct("Naked 100 Lava Flow 60ML E-Liquid");
  assert.equal(real.isNonProduct, false);
  assert.equal(real.containsNicotine, true);
  assert.equal(real.systemType, "OPEN");
});

/* ------------------------------------------------------------------ */
/* Medusa integration                                                  */
/* ------------------------------------------------------------------ */

test("the backend URL is normalised, including a pasted dashboard link", async () => {
  const { normalizeBaseUrl } = await import("../src/lib/medusa/match");

  assert.equal(normalizeBaseUrl("mia-tyson-vape-deals.medusajs.app"), "https://mia-tyson-vape-deals.medusajs.app");
  assert.equal(normalizeBaseUrl("https://shop.example.com/"), "https://shop.example.com");
  assert.equal(
    normalizeBaseUrl("https://mia-tyson-vape-deals.medusajs.app/app/products"),
    "https://mia-tyson-vape-deals.medusajs.app",
    "the admin dashboard path is stripped - the API is at the root",
  );
  assert.throws(() => normalizeBaseUrl("   "));
});

test("Medusa secret keys authenticate with Basic, not Bearer", async () => {
  const { authHeader } = await import("../src/lib/medusa/match");
  const key = "sk_test_123";

  assert.equal(authHeader(key, "basic-colon"), `Basic ${Buffer.from(`${key}:`).toString("base64")}`);
  assert.equal(authHeader(key, "basic-raw"), `Basic ${Buffer.from(key).toString("base64")}`);
  assert.equal(authHeader(key, "bearer"), `Bearer ${key}`);
  assert.ok(authHeader(key, "basic-colon").startsWith("Basic "));
});

test("barcodes match regardless of how they were typed", async () => {
  const { normalizeCode } = await import("../src/lib/medusa/match");

  assert.equal(normalizeCode("6573457375317"), "6573457375317");
  assert.equal(normalizeCode(" 657345-7375317 "), "6573457375317", "spaces and dashes are noise");
  assert.equal(normalizeCode("sku-100000"), "SKU100000");
  assert.equal(normalizeCode(""), null);
  assert.equal(normalizeCode(null), null);
});

test("cost, mL and open/closed are read out of Medusa metadata", async () => {
  const { readVariantExtras } = await import("../src/lib/medusa/match");

  const a = readVariantExtras(
    { id: "v1", metadata: { wholesale_cost: "12.50", liquid_ml: "30", system_type: "Open System" } },
    null,
  );
  assert.equal(a.cost, 12.5);
  assert.equal(a.ml, 30);
  assert.equal(a.systemType, "OPEN");

  // Naming varies; matching is loose. Variant metadata wins over product.
  const b = readVariantExtras(
    { id: "v2", metadata: { costPrice: "$8.00" } },
    { "Volume ML": 60, deviceType: "closed pod" },
  );
  assert.equal(b.cost, 8);
  assert.equal(b.ml, 60);
  assert.equal(b.systemType, "CLOSED");

  // Nothing there means nothing invented.
  const c = readVariantExtras({ id: "v3", metadata: {} }, null);
  assert.equal(c.cost, null);
  assert.equal(c.ml, null);
  assert.equal(c.systemType, null);
});

test("name matching accepts a clear winner and refuses a coin flip", async () => {
  const { bestNameMatch, scoreNames } = await import("../src/lib/medusa/match");

  const avalara = [
    { key: "6573457375317", name: "SUORIN AIR PRO POD CARTRIDGE - 20 PACK" },
    { key: "7013915263061", name: "SUORIN FERO - REPLACEMENT POD CARTRIDGE (0.6 & 0.8)" },
    { key: "6780362522709", name: "SUORIN AIR MINI POD CARTRIDGE - 1 SINGLE POD" },
  ];

  // Same product, different punctuation and casing.
  const clear = bestNameMatch("Suorin Air Pro Pod Cartridge – 20 Pack", avalara);
  assert.equal(clear?.ambiguous, false);
  assert.equal(clear && !clear.ambiguous ? clear.key : null, "6573457375317");
  assert.ok((clear?.score ?? 0) > 0.9);

  // A different product entirely must not match at all.
  assert.equal(bestNameMatch("Geek Bar Pulse 15000 Blue Razz", avalara), null);

  // Two colourways of one device are a coin flip - so pick neither.
  const colourways = [
    { key: "AAA", name: "SUORIN AIR PRO - 18W POD SYSTEM - RAINBOW CHROME" },
    { key: "BBB", name: "SUORIN AIR PRO - 18W POD SYSTEM - GUNMETAL GREY" },
  ];
  const ambiguous = bestNameMatch("Suorin Air Pro 18W Pod System", colourways);
  assert.equal(ambiguous?.ambiguous, true, "a near-tie must not be resolved by guessing");
  assert.equal(ambiguous && ambiguous.ambiguous ? ambiguous.key : "x", null);

  // Sharing only filler words scores nothing.
  assert.equal(scoreNames("THE AND FOR", "AND FOR THE"), 0);
});

test("name scoring is symmetric and bounded", async () => {
  const { scoreNames } = await import("../src/lib/medusa/match");
  const a = "SUORIN DROP 2 REPLACEMENT POD CARTRIDGE - BLACK - 20 PACK";
  const b = "Suorin Drop 2 Replacement Pod Cartridge Black 20 Pack";

  assert.equal(scoreNames(a, b), scoreNames(b, a));
  assert.ok(scoreNames(a, a) === 1, "a name matches itself exactly");
  assert.ok(scoreNames(a, b) >= 0.9);
  assert.equal(scoreNames(a, null), 0);
  assert.equal(scoreNames(null, b), 0);
});

test("the candidate index narrows the field without losing the right answer", async () => {
  const { buildNameIndex, candidatesFor } = await import("../src/lib/medusa/match");

  const candidates = [
    { key: "A", name: "SUORIN AIR PRO POD CARTRIDGE 20 PACK" },
    { key: "B", name: "GEEK BAR PULSE 15000 PUFFS" },
    { key: "C", name: "LOST MARY MO5000 BLUE RAZZ" },
  ];
  const index = buildNameIndex(candidates);
  const shortlist = candidatesFor("Suorin Air Pro Pod Cartridge", index, new Map(candidates.map((c) => [c.key, c])));

  assert.ok(shortlist.some((c) => c.key === "A"), "the real match survives the shortlist");
  assert.equal(shortlist.some((c) => c.key === "B"), false, "unrelated products are skipped");
});

/* ------------------------------------------------------------------ */
/* Order feeds for PACT                                                */
/* ------------------------------------------------------------------ */

test("Shopify's blank header rows are carried down, not read as blanks", async () => {
  const { parseShopifyOrders } = await import("../src/lib/ingest/shopify");

  // Exactly how Shopify writes it: the address appears once, on line 1 of the
  // order. Rows 2 and 3 belong to the same order but have empty header cells.
  const headers = [
    "Name", "Email", "Created at", "Financial Status", "Lineitem quantity",
    "Lineitem name", "Lineitem sku", "Shipping Name", "Shipping Address1",
    "Shipping City", "Shipping Zip", "Shipping Province", "Shipping Country",
  ];
  const records = [
    {
      Name: "#1001", Email: "a@b.c", "Created at": "2026-03-14 10:02:00 -0400",
      "Financial Status": "paid", "Lineitem quantity": "2",
      "Lineitem name": "Suorin Air Pro Pod", "Lineitem sku": "SKU-1",
      "Shipping Name": "Jane Doe", "Shipping Address1": "12 Oak St",
      "Shipping City": "Tampa", "Shipping Zip": "33601",
      "Shipping Province": "FL", "Shipping Country": "United States",
    },
    {
      Name: "", Email: "", "Created at": "", "Financial Status": "",
      "Lineitem quantity": "1", "Lineitem name": "Suorin Fero Pod",
      "Lineitem sku": "SKU-2", "Shipping Name": "", "Shipping Address1": "",
      "Shipping City": "", "Shipping Zip": "", "Shipping Province": "", "Shipping Country": "",
    },
    {
      Name: "#1002", Email: "c@d.e", "Created at": "2026-04-02", "Financial Status": "paid",
      "Lineitem quantity": "3", "Lineitem name": "Geek Bar", "Lineitem sku": "SKU-3",
      "Shipping Name": "John Roe", "Shipping Address1": "9 Elm Rd",
      "Shipping City": "Austin", "Shipping Zip": "73301",
      "Shipping Province": "Texas", "Shipping Country": "US",
    },
  ];

  const r = parseShopifyOrders(records, headers, "vape-closeouts");
  assert.equal(r.rows.length, 3);
  assert.equal(r.orders, 2);

  // The second line inherits the first line's order and address.
  const second = r.rows[1];
  assert.equal(second.orderNumber, "#1001");
  assert.equal(second.customerName, "Jane Doe");
  assert.equal(second.shipToAddress, "12 Oak St");
  assert.equal(second.shipToCity, "Tampa");
  assert.equal(second.state, "FL");
  assert.equal(second.period, "2026-03");
  assert.equal(second.product, "Suorin Fero Pod", "but keeps its own line item");
  assert.notEqual(second.externalId, r.rows[0].externalId, "each line is addressable");

  // A full state name resolves to its code.
  assert.equal(r.rows[2].state, "TX");
  assert.deepEqual(r.periods, ["2026-03", "2026-04"]);
});

test("Shopify rows that cannot be filed are counted, never guessed at", async () => {
  const { parseShopifyOrders } = await import("../src/lib/ingest/shopify");
  const headers = [
    "Name", "Created at", "Financial Status", "Lineitem quantity", "Lineitem name",
    "Shipping Province", "Shipping Country",
  ];
  const base = { "Lineitem quantity": "1", "Lineitem name": "X", "Created at": "2026-05-01" };
  const r = parseShopifyOrders(
    [
      { ...base, Name: "#1", "Financial Status": "paid", "Shipping Province": "ON", "Shipping Country": "Canada" },
      { ...base, Name: "#2", "Financial Status": "refunded", "Shipping Province": "FL", "Shipping Country": "US" },
      { ...base, Name: "#3", "Financial Status": "paid", "Shipping Province": "", "Shipping Country": "US" },
      { ...base, Name: "#4", "Financial Status": "paid", "Shipping Province": "NV", "Shipping Country": "US" },
    ],
    headers,
    "site",
  );

  assert.equal(r.rows.length, 1, "only the filable one is kept");
  assert.equal(r.rows[0].state, "NV");
  assert.equal(r.skippedNonUs, 1);
  assert.equal(r.skippedRefunded, 1);
  assert.equal(r.skippedNoState, 1);
});

test("a Shopify export missing its address columns is refused, not half-imported", async () => {
  const { parseShopifyOrders } = await import("../src/lib/ingest/shopify");
  const r = parseShopifyOrders(
    [{ Name: "#1", "Lineitem quantity": "1" }],
    ["Name", "Lineitem quantity"],
    "site",
  );
  assert.deepEqual(r.missingColumns, ["shippingProvince"]);
  assert.equal(r.rows.length, 0);
});

test("state names and codes both resolve", async () => {
  const { normalizeState } = await import("../src/lib/states");
  assert.equal(normalizeState("FL"), "FL");
  assert.equal(normalizeState("florida"), "FL");
  assert.equal(normalizeState("New Hampshire"), "NH");
  assert.equal(normalizeState("District of Columbia"), "DC");
  assert.equal(normalizeState(""), null);
  assert.equal(normalizeState("Ontario"), null, "a Canadian province is not a US state");
});

/* ------------------------------------------------------------------ */
/* Jurisdiction directory                                              */
/* ------------------------------------------------------------------ */

test("promoting directory codes never replaces a verified code under the same engine key", async () => {
  const { planPromotion } = await import("../src/lib/jurisdictions/promote");
  const existing = [
    { jurisdictionType: "city", jurisdictionName: "Oklahoma City", officialCode: "5521", avalaraAlias: "Edmond" },
    { jurisdictionType: "county", jurisdictionName: "Tulsa", officialCode: "7288", avalaraAlias: null },
  ];
  const plan = planPromotion(
    [
      // OKC's other county portion: the name is taken, so it must not go in.
      { jurisdictionType: "city", jurisdictionName: "Oklahoma City", officialCode: "0921" },
      // Edmond is an alias of OKC in the engine - a real Edmond row would hijack it.
      { jurisdictionType: "city", jurisdictionName: "Edmond", officialCode: "5507" },
      // "Tulsa County" normalises to the same key as "Tulsa".
      { jurisdictionType: "county", jurisdictionName: "Tulsa County", officialCode: "7288" },
      // Split across two counties, neither in the engine yet: a person must choose.
      { jurisdictionType: "city", jurisdictionName: "Norman", officialCode: "1409" },
      { jurisdictionType: "city", jurisdictionName: "Norman", officialCode: "1410" },
      // Free key, listed twice with the same code: added once.
      { jurisdictionType: "city", jurisdictionName: "Duncan", officialCode: "6911" },
      { jurisdictionType: "city", jurisdictionName: "Duncan", officialCode: "6911" },
      // Same name as a county, different type: its own key.
      { jurisdictionType: "city", jurisdictionName: "Tulsa", officialCode: "7205" },
      // No published code: listed in the directory, never a filing code.
      { jurisdictionType: "special", jurisdictionName: "Some District", officialCode: "" },
    ],
    existing,
  );
  assert.deepEqual(plan.add.map((c) => c.officialCode), ["6911", "7205"]);
  assert.deepEqual(plan.alreadyPresent.map((c) => c.officialCode), ["0921", "5507", "7288"]);
  assert.deepEqual(plan.ambiguous.map((c) => c.officialCode), ["1409", "1410"]);
  assert.deepEqual(plan.noCode.map((c) => c.jurisdictionName), ["Some District"]);

  // A state's own return code outranks the SST FIPS code listed for the same place.
  const nd = planPromotion(
    [
      { jurisdictionType: "city", jurisdictionName: "Hannaford", officialCode: "38340", codeSystem: "SST FIPS" },
      { jurisdictionType: "city", jurisdictionName: "Hannaford", officialCode: "112", codeSystem: "ND local code" },
      { jurisdictionType: "city", jurisdictionName: "Only Fips", officialCode: "99999", codeSystem: "SST FIPS" },
    ],
    [],
  );
  assert.deepEqual(nd.add.map((c) => c.officialCode), ["112", "99999"]);
  assert.deepEqual(nd.superseded.map((c) => c.officialCode), ["38340"]);
});

test("directory types map onto the only types the engine looks up", async () => {
  const { engineType, engineRate } = await import("../src/lib/jurisdictions/directory");
  assert.equal(engineType("parish"), "county");
  assert.equal(engineType("region"), "county");
  assert.equal(engineType("village"), "city");
  assert.equal(engineType("transit"), "special");
  // WY/AZ publish a combined rate; everywhere else the engine holds the local portion.
  assert.equal(engineRate({ localRate: "0.01", combinedRate: "0.05", rateIncludesState: true }), "0.05");
  assert.equal(engineRate({ localRate: "0.01", combinedRate: "0.05", rateIncludesState: false }), "0.01");
  const { isPromotable } = await import("../src/lib/jurisdictions/directory");
  assert.equal(isPromotable({ category: "tax", officialCode: "0101", codeSystem: "WY DOR lodging tax code (not for sales tax)" }), false);
  assert.equal(isPromotable({ category: "government", officialCode: "56025", codeSystem: "Census FIPS" }), false);
  assert.equal(isPromotable({ category: "tax", officialCode: "0100", codeSystem: "WY DOR jurisdiction digit code" }), true);
});

test("the directory CSV is refused whole when any row is bad, and codes keep leading zeros", async () => {
  const { parseDirectoryCsv, directoryToCsv, DIRECTORY_COLUMNS } = await import("../src/lib/jurisdictions/directory");
  const head = DIRECTORY_COLUMNS.join(",");
  const good = "tax,WY,Natrona,county,0100,WY county number,Natrona County,,,0.01,0.05,true,2026-01-01,,https://x,";
  const rows = parseDirectoryCsv(`﻿${head}\n${good}\n`);
  assert.equal(rows[0].officialCode, "0100");
  assert.equal(rows[0].rateIncludesState, true);
  assert.equal(rows[0].effectiveTo, null);
  assert.match(directoryToCsv(rows), /,0100,/);

  assert.throws(() => parseDirectoryCsv(`${head}\n${good}\n${good.replace("0.05", "5.0")}\n`), /line 3: combined_rate/);
  assert.throws(() => parseDirectoryCsv(`${head}\n${good.replace("WY", "PR")}\n`), /unknown state/);
  assert.throws(() => parseDirectoryCsv(`state,name\nWY,x\n`), /missing columns/);
});

/* ------------------------------------------------------------------ */
/* Texas: taxing authorities, special districts                        */
/* ------------------------------------------------------------------ */

const txConfig: SalesConfig = { ...baseConfig, state: "TX", stateRate: 0.0625, hasLocal: true, allocation: "city_county" };
const txCode = (jurisdictionType: string, jurisdictionName: string, officialCode: string, fromDirectory = true) => ({
  jurisdictionName, jurisdictionType, officialCode, pairedCode: null, pairedName: null,
  rate: null, rateIncludesState: false, avalaraAlias: null, fromDirectory,
});

test("Avalara's special districts find the Comptroller's codes despite the different spelling", () => {
  // A Houston sale in Harris County: Harris levies no county tax, so Avalara has no County row.
  const rows = [
    line("INV1", "1", "State", { amount: 100, taxable: 100, tax: 6.25 }, { state: "TX", destCounty: "HARRIS", destCity: "HOUSTON", jurisdictionDescription: "TEXAS" }),
    line("INV1", "1", "City", { amount: 100, taxable: 100, tax: 1 }, { state: "TX", destCounty: "HARRIS", destCity: "HOUSTON", jurisdictionDescription: "HOUSTON" }),
    line("INV1", "1", "Special Tax Jurisdiction", { amount: 100, taxable: 100, tax: 1 }, { state: "TX", destCounty: "HARRIS", destCity: "HOUSTON", jurisdictionDescription: "HOUSTON MTA TRANSIT" }),
    line("INV2", "1", "State", { amount: 50, taxable: 50, tax: 3.13 }, { state: "TX", destCounty: "BEXAR", destCity: "SAN ANTONIO", jurisdictionDescription: "TEXAS" }),
    line("INV2", "1", "Special Tax Jurisdiction", { amount: 50, taxable: 50, tax: 0.75 }, { state: "TX", destCounty: "BEXAR", destCity: "SAN ANTONIO", jurisdictionDescription: "BEXAR CO ESD 3 SP" }),
  ];
  const r = computeSales(rows, {
    config: txConfig,
    period: "2026-07",
    codes: [
      txCode("city", "Houston", "2101019"),
      txCode("special", "Houston MTA", "3101990"),
      txCode("special", "Bexar County Emergency Services District No. 3", "5015593"),
    ],
  });
  const code = (name: string) => r.byJurisdiction.find((l) => l.name === name)?.code;
  assert.equal(code("HOUSTON MTA TRANSIT"), "3101990");
  assert.equal(code("BEXAR CO ESD 3 SP"), "5015593");
  // Harris and Bexar counties levy nothing: no code exists and none is asked for.
  assert.ok(!r.warnings.some((w) => /no official filing code/.test(w)), r.warnings.join(" | "));
});

test("a Texas district that collected tax with no code IS flagged", () => {
  const rows = [
    line("INV1", "1", "State", { amount: 100, taxable: 100, tax: 6.25 }, { state: "TX", destCounty: "COLLIN", destCity: "PROSPER", jurisdictionDescription: "TEXAS" }),
    line("INV1", "1", "Special Tax Jurisdiction", { amount: 100, taxable: 100, tax: 0.5 }, { state: "TX", destCounty: "COLLIN", destCity: "PROSPER", jurisdictionDescription: "PROSPER FCP AND EMSD SP" }),
  ];
  const r = computeSales(rows, { config: txConfig, period: "2026-07", codes: [] });
  assert.ok(r.warnings.some((w) => /1 jurisdiction\(s\) have no official filing code loaded: PROSPER FCP AND EMSD SP/.test(w)));
  assert.ok(!r.warnings.some((w) => /COLLIN/.test(w)), "Collin County levies nothing and must not be flagged");
});

test("district name keys: abbreviations match, different districts stay different", async () => {
  const { specialKey, codeKey } = await import("../src/lib/engine/sales");
  const same = (a: string, b: string) => assert.equal(specialKey(a), specialKey(b), `${a} vs ${b}`);
  same("TRAVIS CO EMERGENCY SERVICES DISTRICT 2A SP", "Travis County Emergency Services District No. 2-A");
  same("WALLER-HARRIS EMERGENCY SERVICES DISTRICT NO.200", "Waller-Harris Emergency Services District No. 200");
  same("COMAL COUNTY EMERGENCY SVCS NO. 3", "Comal County Emergency Services District No. 3");
  same("FORT WORTH CRIME CONTROL", "Fort Worth Crime Control District");
  same("CORINTH FIRE CONTROL, PREVENTION AND EMERGENCY MEDICAL SERVICES DISTRICT", "Corinth Fire Control and Prevention & Emergency Medical Services District");
  assert.notEqual(specialKey("Bexar County ESD 3"), specialKey("Bexar County ESD 3-A"));
  assert.notEqual(specialKey("Hays County ESD 6"), specialKey("Hays County ESD 6-A"));
  assert.notEqual(specialKey("Harris County ESD 1"), specialKey("Harris County ESD 10"));
  assert.equal(codeKey("JOHNSTON CTY"), codeKey("Johnston"), "the OK COPO chart writes County as CTY");
});

test("a hand-entered code beats a directory code under the same name", () => {
  const rows = [
    line("INV1", "1", "State", { amount: 100, taxable: 100, tax: 4.5 }, { state: "OK", destCounty: "CANADIAN", destCity: null, jurisdictionDescription: "OKLAHOMA" }),
    line("INV1", "1", "County", { amount: 100, taxable: 100, tax: 0.35 }, { state: "OK", destCounty: "CANADIAN", destCity: null, jurisdictionDescription: "CANADIAN" }),
  ];
  const codes = [
    txCode("county", "Canadian", "1111", false),
    txCode("county", "CANADIAN CTY", "0988", true),
  ];
  for (const order of [codes, [...codes].reverse()]) {
    const r = computeSales(rows, { config: { ...txConfig, state: "OK" }, period: "2026-07", codes: order });
    assert.equal(r.byCounty[0].code, "1111", "load order must not decide which code is filed");
  }
});

test("Texas returns list taxing authorities; other states keep the destination-county table", async () => {
  const { allocationLines } = await import("../src/lib/engine/sales");
  const rows = [
    line("INV1", "1", "State", { amount: 100, taxable: 100, tax: 6.25 }, { state: "TX", destCounty: "HARRIS", destCity: "HOUSTON", jurisdictionDescription: "TEXAS" }),
    line("INV1", "1", "City", { amount: 100, taxable: 100, tax: 1 }, { state: "TX", destCounty: "HARRIS", destCity: "HOUSTON", jurisdictionDescription: "HOUSTON" }),
    line("INV1", "1", "Special Tax Jurisdiction", { amount: 100, taxable: 100, tax: 1 }, { state: "TX", destCounty: "HARRIS", destCity: "HOUSTON", jurisdictionDescription: "HOUSTON MTA TRANSIT" }),
  ];
  const codes = [txCode("city", "Houston", "2101017"), txCode("special", "Houston MTA", "3101990")];
  const tx = computeSales(rows, { config: txConfig, period: "2026-08", codes });
  const lines = allocationLines(tx);
  assert.deepEqual(lines.map((l) => `${l.name}=${l.code}`).sort(), ["HOUSTON MTA TRANSIT=3101990", "HOUSTON=2101017"]);
  assert.ok(!lines.some((l) => l.name === "HARRIS"), "Harris County levies nothing and is not a return line");
  assert.equal(round2(lines.reduce((a, l) => a + l.tax, 0)), tx.localTaxCollected);

  const other = computeSales(rows.map((r) => ({ ...r, state: "XX" })), { config: { ...txConfig, state: "XX", allocation: "county" }, period: "2026-08", codes });
  assert.deepEqual(allocationLines(other).map((l) => l.name), ["HARRIS"]);
});
