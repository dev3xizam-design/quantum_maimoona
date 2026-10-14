/**
 * Real-time tax: excise per line, product facts, and the checkout quote.
 *   npx tsx --test scripts/test-realtime-tax.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ExciseConfigRow } from "../src/lib/engine/excise";
import { exciseForLine, type LineFacts } from "../src/lib/tax/excise-line";
import { mlFromDescription, packCount, resolveFacts, type KnownProduct } from "../src/lib/tax/product-facts";
import { computeQuote, type QuoteDeps } from "../src/lib/tax/quote";

const cfg = (o: Partial<ExciseConfigRow>): ExciseConfigRow => ({
  state: "XX",
  structure: "C",
  basis: "SALES",
  rate: 0,
  rateUnit: "per_ml",
  openRate: null,
  openRateUnit: null,
  closedRate: null,
  closedRateUnit: null,
  frequency: "MONTHLY",
  portal: null,
  formName: null,
  dueDay: 20,
  notes: null,
  ...o,
});

const facts = (o: Partial<LineFacts>): LineFacts => ({
  quantity: 1,
  unitPrice: 10,
  mlPerUnit: null,
  costPerUnit: null,
  costIsEstimate: false,
  mlIsParsed: false,
  cartridgesPerUnit: 1,
  systemType: null,
  isHardware: false,
  isNonProduct: false,
  ...o,
});

test("per-mL excise: NC 0.05/mL on two 60mL bottles = 6.00", () => {
  const e = exciseForLine(cfg({ state: "NC", rate: 0.05 }), facts({ quantity: 2, unitPrice: 20, mlPerUnit: 60 }));
  assert.equal(e?.amount, 6);
  assert.equal(e?.effectiveRate, 15); // 6 / 40
});

test("per-mL with no mL charges nothing and says so", () => {
  const e = exciseForLine(cfg({ rate: 0.05 }), facts({}));
  assert.equal(e?.amount, 0);
  assert.equal(e?.estimated, true);
});

test("% of wholesale uses the estimate and flags it", () => {
  const e = exciseForLine(
    cfg({ state: "MN", structure: "A", rate: 0.95, rateUnit: "pct_wholesale" }),
    facts({ unitPrice: 54.99, costPerUnit: 27.495, costIsEstimate: true }),
  );
  assert.equal(e?.amount, 26.12);
  assert.equal(e?.estimated, true);
});

test("bifurcated KY: closed system is $1.50 per cartridge, 5-pack = 7.50", () => {
  const ky = cfg({ state: "KY", structure: "E", openRate: 0.15, openRateUnit: "pct_wholesale", closedRate: 1.5, closedRateUnit: "per_unit" });
  const e = exciseForLine(ky, facts({ unitPrice: 54.99, systemType: "CLOSED", cartridgesPerUnit: 5 }));
  assert.equal(e?.amount, 7.5);
});

test("bifurcated with no open/closed charges the higher and flags it", () => {
  const ky = cfg({ state: "KY", structure: "E", openRate: 0.15, openRateUnit: "pct_wholesale", closedRate: 1.5, closedRateUnit: "per_unit" });
  const e = exciseForLine(ky, facts({ unitPrice: 20, costPerUnit: 10, cartridgesPerUnit: 1 }));
  assert.equal(e?.amount, 1.5); // closed 1.50 > open 1.50*... (10*0.15 = 1.50) - tie goes to open, same amount
  assert.equal(e?.estimated, true);
});

test("hardware and RECEIPTS-basis states charge no excise at checkout", () => {
  assert.equal(exciseForLine(cfg({ rate: 0.05 }), facts({ isHardware: true, mlPerUnit: 5 })), null);
  assert.equal(exciseForLine(cfg({ state: "KS", rate: 0.05, basis: "RECEIPTS" }), facts({ mlPerUnit: 60 })), null);
});

test("description mL: keyword wins; several bare sizes are not guessed", () => {
  assert.equal(mlFromDescription("Preloaded E-Liquid Capacity: 15mL\nBattery: 800mAh")?.ml, 15);
  assert.equal(mlFromDescription("pre-filled with 2ml of salt nic")?.ml, 2);
  assert.equal(mlFromDescription("Available in 30ml and 60ml bottles"), null);
  assert.equal(mlFromDescription("A 100ml shortfill")?.ml, 100);
});

test("pack count from the variant title", () => {
  assert.equal(packCount("5 Pack Menthol Tyson 2.0 Iron Mike Disposable Vape"), 5);
  assert.equal(packCount("1 Single Device"), 1);
  assert.equal(packCount("Pack of 10"), 10);
});

test("facts: a 5-pack of 15mL disposables is 75mL and CLOSED; cost estimated at 50%", () => {
  const f = resolveFacts(
    {
      id: "l1",
      title: "Blue Razz Lemonade AL9000 Novo Bar",
      variantTitle: "5 Pack Blue Razz Lemonade AL9000 Novo",
      productType: "Disposable Vape",
      description: "Preloaded E-Liquid Capacity: 15mL",
      quantity: 1,
      unitPrice: 54.99,
    },
    null,
    { costEstimateRatio: 0.5 },
  );
  assert.equal(f.mlPerUnit, 75);
  assert.equal(f.cartridgesPerUnit, 5);
  assert.equal(f.systemType, "CLOSED");
  assert.equal(f.costPerUnit, 27.495);
  assert.equal(f.costIsEstimate, true);
});

test("facts: Quantum's own cost and mL beat anything parsed", () => {
  const known: KnownProduct = {
    sku: "900302",
    description: "Novo AL9000 5pk",
    wholesaleCost: 21,
    costSource: "manual",
    liquidMl: 70,
    mlSource: "manual",
    cartridgesPerUnit: 5,
    systemType: "CLOSED",
    containsNicotine: true,
  };
  const f = resolveFacts(
    { id: "l1", title: "X 60ml", variantTitle: "5 Pack", description: "15mL capacity", quantity: 1, unitPrice: 54.99 },
    known,
    { costEstimateRatio: 0.5 },
  );
  assert.equal(f.mlPerUnit, 70);
  assert.equal(f.costPerUnit, 21);
  assert.equal(f.costIsEstimate, false);
  assert.equal(f.sku, "900302");
});

const baseDeps = (o: Partial<QuoteDeps> = {}): QuoteDeps => ({
  rate: {
    totalRate: 0.1025,
    countyName: "Cook",
    cityName: "Chicago",
    source: "test",
    matchedBy: "city",
    jurisdictions: [
      { type: "State", name: "IL", code: null, rate: 0.0625 },
      { type: "County", name: "Cook", code: null, rate: 0.0175 },
      { type: "City", name: "Chicago", code: null, rate: 0.0125 },
      { type: "Special", name: "RTA", code: null, rate: 0.01 },
    ],
  },
  sales: { registered: true, stateRate: 0.0625 },
  excise: cfg({ state: "IL", structure: "A", rate: 0.45, rateUnit: "pct_wholesale" }),
  shippingTaxable: true,
  known: new Map(),
  costEstimateRatio: 0.5,
  ...o,
});

test("quote: Chicago 10.25% sales + IL 45% of wholesale excise, as separate totals", () => {
  const q = computeQuote(
    {
      address: { state: "IL", zip: "60601", city: "Chicago" },
      lines: [{ id: "a", title: "Tyson Iron Mike", variantTitle: "1 Single", productType: "Disposable Vape", quantity: 2, unitPrice: 20 }],
      shipping: [{ id: "s", amount: 10 }],
    },
    baseDeps(),
  );
  assert.equal(q.lines[0].sales.amount, 4.1); // 40 x 10.25%
  assert.equal(q.lines[0].excise?.amount, 9); // 40 x 50% x 45%
  assert.equal(q.shipping[0].tax, 1.03); // 10 x 10.25% (rounded)
  assert.equal(q.totals.salesTax, 5.13);
  assert.equal(q.totals.exciseTax, 9);
});

test("quote: unregistered state charges no sales tax; missing ZIP falls back to state rate with a warning", () => {
  const unreg = computeQuote(
    { address: { state: "IL", zip: "60601" }, lines: [{ id: "a", title: "x", quantity: 1, unitPrice: 10 }], shipping: [] },
    baseDeps({ sales: { registered: false, stateRate: 0 }, excise: null }),
  );
  assert.equal(unreg.totals.totalTax, 0);

  const noRate = computeQuote(
    { address: { state: "IL", zip: "60601" }, lines: [{ id: "a", title: "x", quantity: 1, unitPrice: 100 }], shipping: [] },
    baseDeps({ rate: null, excise: null }),
  );
  assert.equal(noRate.totals.salesTax, 6.25);
  assert.match(noRate.warnings[0], /No local rate/);
});

test("quote: discount lowers both the sales base and the excise base", () => {
  const q = computeQuote(
    {
      address: { state: "IL", zip: "60601" },
      lines: [{ id: "a", title: "x 60ml", quantity: 1, unitPrice: 20, discount: 5 }],
      shipping: [],
    },
    baseDeps({ excise: cfg({ state: "NY", structure: "B", rate: 0.2, rateUnit: "pct_retail" }) }),
  );
  assert.equal(q.lines[0].amount, 15);
  assert.equal(q.lines[0].excise?.amount, 3);
});
