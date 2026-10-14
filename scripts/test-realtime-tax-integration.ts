/**
 * Real-time tax against a real Postgres (PGlite): calculate -> commit on ship ->
 * the sales return reads it -> void on cancel, including a void after filing.
 *
 *   npx tsx --conditions=react-server --test scripts/test-realtime-tax-integration.ts
 */
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, like } from "drizzle-orm";
import * as schema from "../src/db/schema";

const g = globalThis as unknown as { __db?: unknown };
let client: PGlite;
const conn = { id: 1, slug: "vc", name: "Vape Closeouts" };

before(async () => {
  client = new PGlite();
  g.__db = drizzle(client, { schema });
  const dir = path.join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt.trim());
    }
  }
  const { db } = await import("../src/db");
  await db.insert(schema.integrations).values({ id: 1, slug: "vc", name: "Vape Closeouts", provider: "medusa", baseUrl: "http://localhost:9000" });
  await db.insert(schema.stateTaxConfig).values([
    { state: "IL", taxType: "sales", frequency: "MONTHLY", stateRate: "0.0625", hasLocal: false, allocation: "flat", effectiveFrom: "2026-01-01" },
    { state: "IL", taxType: "pact", frequency: "MONTHLY", stateRate: "0", allocation: "none", effectiveFrom: "2026-01-01" },
  ]);
  await db.insert(schema.exciseConfig).values({
    state: "IL", structure: "A", basis: "SALES", rate: "0.45", rateUnit: "pct_wholesale", frequency: "MONTHLY", effectiveFrom: "2026-01-01",
  });
  await db.insert(schema.taxRates).values({
    state: "IL", zip5: "60606", countyName: "Cook", cityName: "Chicago",
    stateRate: "0.0625", countyRate: "0.0175", cityRate: "0.0125", specialRate: "0.01", totalRate: "0.1025",
    jurisdictions: [
      { type: "State", name: "IL", code: null, rate: 0.0625 },
      { type: "County", name: "Cook", code: null, rate: 0.0175 },
      { type: "City", name: "Chicago", code: null, rate: 0.0125 },
      { type: "Special", name: "Regional Transportation Authority", code: null, rate: 0.01 },
    ],
    isPrimary: true, source: "test", effectiveFrom: "2026-01-01",
  });
});

after(async () => {
  await client?.close();
});

const order = (id: string) => ({
  order_id: id,
  order_number: "1001",
  ordered_at: "2026-10-08T12:00:00Z",
  shipped_at: "2026-10-10T15:00:00Z",
  email: "buyer@example.com",
  address: { first_name: "Pat", last_name: "Buyer", company: null, line1: "233 S Wacker Dr", line2: null, city: "Chicago", state: "IL", zip: "60606", country: "US" },
  lines: [
    {
      id: "ordli_1",
      variant_id: "variant_1",
      product_id: "prod_1",
      sku: "444170",
      barcode: null,
      title: "Menthol Tyson 2.0 Iron Mike 15,000 Puff Disposable Vape",
      variant_title: "5 Pack Menthol Tyson 2.0 Iron Mike Disposable Vape",
      product_type: "Disposable Vape",
      description: "Pre-filled with 16mL of e-liquid",
      quantity: 1,
      unit_price: 59.99,
      discount: 0,
      // What checkout charged: 10.25% sales + IL excise (45% x 50% estimate = 22.5%)
      tax_lines: [
        { code: "QTM-IL-STATE-IL", rate: 6.25 },
        { code: "QTM-IL-COUNTY-COOK", rate: 1.75 },
        { code: "QTM-IL-CITY-CHICAGO", rate: 1.25 },
        { code: "QTM-IL-SPECIAL-RTA", rate: 1 },
        { code: "EXCISE-IL", rate: 22.5 },
      ],
    },
  ],
  shipping: [],
});

test("calculate: Chicago gets 10.25% sales tax plus IL excise as a separate amount", async () => {
  const { calculate } = await import("../src/lib/tax/calculate");
  const q = await calculate("vc", {
    address: { city: "Chicago", state: "IL", zip: "60606" },
    lines: [{ id: "a", title: "Menthol Tyson 2.0 Iron Mike", variantTitle: "5 Pack", productType: "Disposable Vape", quantity: 1, unitPrice: 59.99 }],
    shipping: [],
  }, "2026-10-08");
  assert.equal(q.totals.salesTax, 6.15); // 59.99 x 10.25%
  assert.equal(q.totals.exciseTax, 13.5); // 59.99 x 50% x 45% = 13.497...
  assert.equal(q.address.county, "Cook");
});

test("commit: rows land in Avalara's shape and the IL return reads them", async () => {
  const { commitOrder } = await import("../src/lib/tax/commit");
  const { db } = await import("../src/db");
  const res = await commitOrder(conn, order("order_A") as never);
  assert.equal(res.status, "committed");
  assert.equal(res.period, "2026-10");

  const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.documentId, "quantum:vc:order_A"));
  assert.equal(rows.length, 4);
  const state = rows.find((r) => r.jurisdictionType === "State")!;
  assert.equal(Number(state.taxableAmount), 59.99);
  assert.equal(Number(state.exemptAmount), 0);
  const collected = rows.reduce((s, r) => s + Number(r.taxAmount), 0);
  assert.ok(Math.abs(collected - 59.99 * 0.1025) < 0.001, `collected ${collected}`);
  assert.ok(rows.some((r) => r.jurisdictionType === "Special Tax Jurisdiction"));

  const { computeFiling } = await import("../src/lib/compute");
  const filing = await computeFiling("IL", "sales", "2026-10");
  assert.equal((filing as { gross: number }).gross, 59.99);

  // PACT row, and a product record carrying what checkout used.
  const ship = await db.select().from(schema.shipments).where(like(schema.shipments.externalId, "medusa:vc:order_A:%"));
  assert.equal(ship.length, 1);
  assert.equal(Number(ship[0].mlTotal), 80); // 16mL x 5-pack
  const [p] = await db.select().from(schema.products).where(eq(schema.products.sku, "444170"));
  assert.equal(p.mlSource, "parsed");
  assert.equal(p.costSource, "estimated");
  assert.equal(Number(p.liquidMl), 80);
});

test("commit is idempotent: re-sending the same order does not double it", async () => {
  const { commitOrder } = await import("../src/lib/tax/commit");
  const { db } = await import("../src/db");
  await commitOrder(conn, order("order_A") as never);
  const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.documentId, "quantum:vc:order_A"));
  assert.equal(rows.length, 4);
});

test("a manual cost entered in Quantum is never overwritten by a later commit", async () => {
  const { commitOrder } = await import("../src/lib/tax/commit");
  const { db } = await import("../src/db");
  await db.update(schema.products).set({ wholesaleCost: "21", costSource: "manual" }).where(eq(schema.products.sku, "444170"));
  await commitOrder(conn, order("order_B") as never);
  const [p] = await db.select().from(schema.products).where(eq(schema.products.sku, "444170"));
  assert.equal(Number(p.wholesaleCost), 21);
  assert.equal(p.costSource, "manual");
  const [doc] = await db.select().from(schema.taxDocuments).where(eq(schema.taxDocuments.documentCode, "quantum:vc:order_B"));
  assert.equal(Number(doc.exciseTax), 9.45); // 21 x 45%
});

test("void before filing removes the order from returns and PACT", async () => {
  const { voidOrder } = await import("../src/lib/tax/commit");
  const { db } = await import("../src/db");
  const res = await voidOrder(conn, "order_B", "canceled");
  assert.equal(res.status, "voided");
  assert.equal((await db.select().from(schema.transactions).where(eq(schema.transactions.documentId, "quantum:vc:order_B"))).length, 0);
  assert.equal((await db.select().from(schema.shipments).where(like(schema.shipments.externalId, "medusa:vc:order_B:%"))).length, 0);
  assert.equal((await voidOrder(conn, "order_B", "canceled")).status, "already_voided");
});

test("void after the month is filed leaves it alone and writes a Return Invoice", async () => {
  const { voidOrder } = await import("../src/lib/tax/commit");
  const { db } = await import("../src/db");
  await db.insert(schema.filings).values({ state: "IL", taxType: "sales", period: "2026-10", status: "filed" });
  const res = await voidOrder(conn, "order_A", "refunded");
  assert.equal(res.status, "returned");
  assert.equal((await db.select().from(schema.transactions).where(eq(schema.transactions.documentId, "quantum:vc:order_A"))).length, 4);
  const ret = await db.select().from(schema.transactions).where(eq(schema.transactions.documentId, "quantum:vc:order_A:return"));
  assert.equal(ret.length, 4);
  assert.ok(ret.every((r) => r.docType === "Return Invoice" && r.sign === -1));
});

test("lookupRate: a ZIP+4 inside a packed range uses that range's rate area", async () => {
  const { db } = await import("../src/db");
  const { lookupRate } = await import("../src/lib/tax/calculate");
  const j = (rate: number) => [{ type: "State" as const, name: "WA", code: null, rate: 0.065 }, { type: "City" as const, name: "Test", code: null, rate }];
  await db.insert(schema.taxRates).values([
    { state: "WA", zip5: "98682", cityName: "Vancouver", countyName: "Clark", stateRate: "0.065", cityRate: "0.0", totalRate: "0.065", jurisdictions: j(0), isPrimary: true, source: "test", effectiveFrom: "2026-01-01" },
  ]);
  await db.insert(schema.taxRateAreas).values([
    { id: 1, state: "WA", countyName: "Clark", cityName: "Vancouver", stateRate: "0.065", cityRate: "0.022", totalRate: "0.087", jurisdictions: j(0.022), source: "test", effectiveFrom: "2026-01-01" },
    { id: 2, state: "WA", countyName: "Clark", cityName: null, stateRate: "0.065", cityRate: "0.01", totalRate: "0.075", jurisdictions: j(0.01), source: "test", effectiveFrom: "2026-01-01" },
  ]);
  await db.insert(schema.taxRatePlus4).values({ state: "WA", zip5: "98682", ranges: [1, 4999, 1, 5000, 9999, 2, 5000, 5100, 1] });

  assert.equal((await lookupRate("WA", "98682-1234", "Vancouver", "2026-10-15"))?.totalRate, 0.087);
  // overlapping ranges: the narrowest (5000-5100 -> area 1) wins over 5000-9999
  assert.equal((await lookupRate("WA", "98682-5050", null, "2026-10-15"))?.totalRate, 0.087);
  const r = await lookupRate("WA", "98682-7000", "Vancouver", "2026-10-15");
  assert.equal(r?.totalRate, 0.075);
  assert.equal(r?.matchedBy, "zip4");
  // no plus4 -> the ZIP5 row
  assert.equal((await lookupRate("WA", "98682", "Vancouver", "2026-10-15"))?.matchedBy, "city");
});

test("lookupRate: a ZIP with no rows falls back to the nearest ZIP in the same ZIP3, city first", async () => {
  const { db } = await import("../src/db");
  const { lookupRate } = await import("../src/lib/tax/calculate");
  const row = (zip5: string, cityName: string, total: string, isPrimary = true) => ({
    state: "FL", zip5, cityName, countyName: "Santa Rosa", stateRate: "0.06", countyRate: String(Number(total) - 0.06), totalRate: total,
    jurisdictions: [], isPrimary, source: "test", effectiveFrom: "2026-01-01",
  });
  await db.insert(schema.taxRates).values([row("32570", "Milton", "0.07"), row("32571", "Pace", "0.075"), row("32583", "Milton", "0.071", false)]);
  const city = await lookupRate("FL", "32572", "Milton", "2026-10-15"); // PO-box ZIP, no Census area
  assert.equal(city?.totalRate, 0.07);
  assert.equal(city?.matchedBy, "nearby-zip");
  assert.equal((await lookupRate("FL", "32572", "Nowhere", "2026-10-15"))?.totalRate, 0.075); // nearest primary
  assert.equal(await lookupRate("FL", "39999", "Milton", "2026-10-15"), null); // nothing in that ZIP3
});
