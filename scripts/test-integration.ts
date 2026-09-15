/**
 * Full-stack test against a real Postgres running in-process (PGlite):
 * the generated migration, the seed, ingestion, the effective-dated config
 * lookups, the calendar, and a generated workbook.
 *
 *   npm run test:integration
 */
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";

const g = globalThis as unknown as { __db?: unknown };
let client: PGlite;

before(async () => {
  client = new PGlite();
  g.__db = drizzle(client, { schema });

  // Apply every migration in order, exactly as the real database receives them.
  const dir = path.join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sqlText = readFileSync(path.join(dir, file), "utf8");
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      const s = stmt.trim();
      if (s) await client.exec(s);
    }
  }
});

after(async () => {
  await client?.close();
});

test("the generated migration creates every table the app queries", async () => {
  const res = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const tables = res.rows.map((r) => r.table_name).sort();
  for (const t of [
    "accounts", "change_log", "excise_config", "filings", "jurisdiction_codes", "jurisdiction_directory",
    "nexus_thresholds", "products", "purchases", "run_log", "shipments",
    "state_tax_config", "transactions", "uploads", "users",
  ]) {
    assert.ok(tables.includes(t), `missing table ${t}`);
  }
});

test("seed loads the rule tables, then effective dating resolves the right row", async () => {
  const { db } = await import("../src/db");
  const { SALES_SEED, EXCISE_SEED, PACT_STATES, DEFAULT_EFFECTIVE_FROM } = await import("../src/lib/seed-data");

  for (const s of SALES_SEED) {
    await db.insert(schema.stateTaxConfig).values({
      state: s.state, taxType: "sales", frequency: s.frequency, stateRate: String(s.rate),
      hasLocal: s.hasLocal, allocation: s.allocation, rounding: s.rounding, portal: s.portal,
      formName: s.form, dueDay: s.dueDay, rateLabel: s.rateLabel, notes: s.notes,
      effectiveFrom: DEFAULT_EFFECTIVE_FROM,
    });
  }
  for (const state of PACT_STATES) {
    await db.insert(schema.stateTaxConfig).values({
      state, taxType: "pact", frequency: "MONTHLY", stateRate: "0", allocation: "none",
      formName: "PACT Act ENDS report", dueDay: 10, effectiveFrom: DEFAULT_EFFECTIVE_FROM,
    });
  }
  for (const e of EXCISE_SEED) {
    await db.insert(schema.exciseConfig).values({
      state: e.state, structure: e.structure, basis: e.basis, rate: String(e.rate),
      rateUnit: e.rateUnit,
      openRate: e.openRate === undefined ? null : String(e.openRate),
      openRateUnit: e.openRateUnit ?? null,
      closedRate: e.closedRate === undefined ? null : String(e.closedRate),
      closedRateUnit: e.closedRateUnit ?? null,
      frequency: e.frequency, portal: e.portal, formName: e.form, dueDay: e.dueDay,
      notes: e.notes, effectiveFrom: e.effectiveFrom ?? DEFAULT_EFFECTIVE_FROM,
    });
  }

  const { resolveStateConfig, resolveExciseConfig } = await import("../src/lib/config");

  const ks = await resolveStateConfig("KS", "sales", "2026-07");
  assert.equal(ks?.frequency, "ANNUAL", "Kansas sales became annual in 2026");

  const ksExcise = await resolveExciseConfig("KS", "2026-07");
  assert.equal(ksExcise?.frequency, "MONTHLY", "...while the EC-2 excise stayed monthly");
  assert.equal(ksExcise?.basis, "RECEIPTS");

  // South Carolina's $0.05/mL starts 1 Oct 2026 - before that there is no rule at all.
  assert.equal(await resolveExciseConfig("SC", "2026-07"), null);
  const scOct = await resolveExciseConfig("SC", "2026-10");
  assert.equal(scOct?.rate, 0.05);
});

test("a rate change is effective-dated: past periods keep the old rate", async () => {
  const { db } = await import("../src/db");
  const { eq, and } = await import("drizzle-orm");
  const { resolveStateConfig } = await import("../src/lib/config");

  const [ky] = await db
    .select()
    .from(schema.stateTaxConfig)
    .where(and(eq(schema.stateTaxConfig.state, "KY"), eq(schema.stateTaxConfig.taxType, "sales")))
    .limit(1);

  // Close the 6% row at the end of August and open a 7% row from September.
  await db
    .update(schema.stateTaxConfig)
    .set({ effectiveTo: "2026-08-31" })
    .where(eq(schema.stateTaxConfig.id, ky.id));
  await db.insert(schema.stateTaxConfig).values({
    ...ky, id: undefined, stateRate: "0.07", effectiveFrom: "2026-09-01", effectiveTo: null,
  } as typeof schema.stateTaxConfig.$inferInsert);

  assert.equal((await resolveStateConfig("KY", "sales", "2026-07"))?.stateRate, 0.06);
  assert.equal((await resolveStateConfig("KY", "sales", "2026-09"))?.stateRate, 0.07);
});

test("ingestion is idempotent and the sales engine reads it back correctly", async () => {
  const { db } = await import("../src/db");
  const { insertTransactions } = await import("../src/lib/ingest/persist");
  const { buildHeaderMap, normalizeRow } = await import("../src/lib/ingest/avalara");

  const [upload] = await db
    .insert(schema.uploads)
    .values({ filename: "test.csv", kind: "avalara" })
    .returning({ id: schema.uploads.id });

  const headers = [
    "STATEPROVINCE", "DOCUMENTDATE", "DOCUMENTID", "LINENO", "ITEMCODE",
    "JURISDICTIONTYPEDESCRIPTION", "JURISDICTIONDESCRIPTION", "DESTCOUNTY", "DESTCITY",
    "LINEAMOUNT", "LINETAXABLEAMOUNT", "LINEEXEMPTAMOUNT", "TAXAMOUNT", "RATE", "DOCTYPE", "QUANTITY",
  ];
  const map = buildHeaderMap(headers);

  const raw = (over: Record<string, string>) => ({
    STATEPROVINCE: "KY", DOCUMENTDATE: "2026-07-15", DOCUMENTID: "INV1", LINENO: "1",
    ITEMCODE: "SKU1", JURISDICTIONTYPEDESCRIPTION: "State", JURISDICTIONDESCRIPTION: "KENTUCKY",
    DESTCOUNTY: "Jefferson", DESTCITY: "Louisville", LINEAMOUNT: "308.57",
    LINETAXABLEAMOUNT: "308.57", LINEEXEMPTAMOUNT: "0", TAXAMOUNT: "13.13", RATE: "0.0425",
    DOCTYPE: "Sales Invoice", QUANTITY: "3", ...over,
  });

  const rows = [raw({}), raw({ DOCUMENTID: "INV2", LINEAMOUNT: "100", LINETAXABLEAMOUNT: "100", TAXAMOUNT: "4.25" })]
    .map((r) => normalizeRow(r, map, "test.csv")!)
    .filter(Boolean);

  const first = await insertTransactions(upload.id, rows);
  assert.equal(first, 2);

  // Re-uploading the same period must not double the numbers.
  const second = await insertTransactions(upload.id, rows);
  assert.equal(second, 0, "duplicate rows are ignored, not double-counted");

  const { computeFiling } = await import("../src/lib/compute");
  const result = await computeFiling("KY", "sales", "2026-07");
  assert.equal(result.taxType, "sales");
  if (result.taxType !== "sales") return;

  assert.equal(result.gross, 408.57);
  assert.equal(result.taxable, 408.57);
  assert.equal(result.taxCollected, 17.38);
  assert.equal(result.taxComputed, 24.51, "6% of 408.57");
  assert.equal(result.delta, 7.13, "under-collection is surfaced before filing");
  assert.equal(result.reconciles, true);
});

test("the calendar resolves frequency per tax type and flags the backlog", async () => {
  const { buildCalendar, findBacklog } = await import("../src/lib/calendar");
  const asOf = new Date("2026-09-10T00:00:00Z");

  const cells = await buildCalendar("2026-07", asOf);
  const ksSales = cells.find((c) => c.state === "KS" && c.taxType === "sales")!;
  const ksExcise = cells.find((c) => c.state === "KS" && c.taxType === "excise")!;
  assert.equal(ksSales.period, "2026", "annual sales rolls into the 2026 return");
  assert.equal(ksExcise.period, "2026-07", "monthly excise stays monthly");

  const ky = cells.find((c) => c.state === "KY" && c.taxType === "sales")!;
  assert.equal(ky.hasActivity, true);
  assert.equal(ky.status, "overdue", "July was due 20 Aug and is unfiled");

  const backlog = await findBacklog(14, asOf);
  assert.ok(backlog.some((b) => b.state === "KY" && b.period === "2026-07"));
});

test("computing persists a filing, and marking it filed survives a recompute", async () => {
  const { db } = await import("../src/db");
  const { eq, and } = await import("drizzle-orm");
  const { computeAndPersist } = await import("../src/lib/compute");

  await computeAndPersist("KY", "sales", "2026-07");
  const where = and(
    eq(schema.filings.state, "KY"),
    eq(schema.filings.taxType, "sales"),
    eq(schema.filings.period, "2026-07"),
  );

  const [ready] = await db.select().from(schema.filings).where(where);
  assert.equal(ready.status, "ready");
  assert.equal(Number(ready.taxComputed), 24.51);

  await db.update(schema.filings).set({ status: "filed", confirmationNumber: "ABC123" }).where(where);
  await computeAndPersist("KY", "sales", "2026-07");

  const [filed] = await db.select().from(schema.filings).where(where);
  assert.equal(filed.status, "filed", "a recompute must not silently reopen a filed return");
  assert.equal(filed.confirmationNumber, "ABC123");
});

test("a worksheet is generated end to end with all five tabs", async () => {
  const { computeFiling } = await import("../src/lib/compute");
  const { buildWorkbook, workbookFilename } = await import("../src/lib/excel/workbook");
  const ExcelJS = (await import("exceljs")).default;

  const result = await computeFiling("KY", "sales", "2026-07");
  const buf = await buildWorkbook(result, {
    company: "Maximum Vapor Inc.", fein: "82-1098441",
    accountNumber: "000780515", licenseNumber: null, loginField: null, accountNotes: null,
  });

  assert.equal(workbookFilename(result), "KY_sales_2026-07.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ["Filing Sheet", "Return", "Jurisdiction Detail", "Reconciliation", "Notes"],
  );
  assert.ok(buf.length > 5000, "the workbook has real content");
});

test("PACT falls back to the sales export but warns that customer detail is missing", async () => {
  const { computeFiling } = await import("../src/lib/compute");
  const result = await computeFiling("KY", "pact", "2026-07");
  assert.equal(result.taxType, "pact");
  if (result.taxType !== "pact") return;

  assert.equal(result.source, "transactions");
  assert.equal(result.shipmentCount, 2);
  assert.equal(result.dueDate, "2026-08-10", "PACT is due the 10th, before sales tax");
  assert.ok(result.warnings.some((w) => w.includes("customer names")));
});

test("receipts-basis excise refuses to guess when no purchase data is loaded", async () => {
  const { computeFiling } = await import("../src/lib/compute");
  const result = await computeFiling("KS", "excise", "2026-07");
  assert.equal(result.taxType, "excise");
  if (result.taxType !== "excise") return;

  assert.equal(result.taxComputed, 0);
  assert.ok(result.warnings.some((w) => w.includes("No purchase rows loaded")));
});

test("the product catalog builds itself from the transactions, prices included", async () => {
  const { db } = await import("../src/db");
  const { insertTransactions } = await import("../src/lib/ingest/persist");
  const { refreshProductCatalog } = await import("../src/lib/products/catalog");
  const { eq } = await import("drizzle-orm");

  const [upload] = await db
    .insert(schema.uploads)
    .values({ filename: "products.csv", kind: "avalara" })
    .returning({ id: schema.uploads.id });

  const row = (over: Partial<Record<string, unknown>>) => ({
    documentId: "D1", lineNo: "1", ref1: null, documentStatus: "Committed",
    docType: "Sales Invoice", sign: 1, documentDate: "2026-07-05", period: "2026-07",
    reportingDate: null, taxCalcDate: null, state: "OH", destCounty: "Franklin",
    destCity: "Columbus", destZip: "43004", jurisdictionType: "State",
    jurisdictionDescription: "OHIO", taxTypeDescription: "Sales", rate: 0.0575,
    lineAmount: 0, discountAmount: 0, taxableAmount: 0, exemptAmount: 0, taxAmount: 0,
    quantity: 0, itemCode: null, itemDescription: null, sourceFile: "products.csv",
    ...over,
  }) as Parameters<typeof insertTransactions>[1][number];

  await insertTransactions(upload.id, [
    // 4 units at $25 each = $100. Same line repeated for County - must NOT double.
    row({ documentId: "D1", itemCode: "juice-1", itemDescription: "Naked 100 Lava Flow 60ML E-Liquid", quantity: 4, lineAmount: 100 }),
    row({ documentId: "D1", itemCode: "juice-1", itemDescription: "Naked 100 Lava Flow 60ML E-Liquid", quantity: 4, lineAmount: 100, jurisdictionType: "County", jurisdictionDescription: "FRANKLIN" }),
    // A second sale of the same SKU, 2 units at $25.
    row({ documentId: "D2", itemCode: "JUICE-1", itemDescription: "Naked 100 Lava Flow 60ML E-Liquid", quantity: 2, lineAmount: 50, state: "OH" }),
    // A pod pack - closed system, no volume in the name.
    row({ documentId: "D3", itemCode: "pod-9", itemDescription: "Juul Pods Mango 4 Pack", quantity: 10, lineAmount: 200, state: "VA" }),
    // A return of one juice unit nets the period down.
    row({ documentId: "D4", itemCode: "JUICE-1", itemDescription: "Naked 100 Lava Flow 60ML E-Liquid", quantity: 1, lineAmount: 25, docType: "Return Invoice", sign: -1 }),
  ]);

  const result = await refreshProductCatalog();
  const juiceRows = await db.select().from(schema.products).where(eq(schema.products.sku, "JUICE-1"));
  assert.equal(juiceRows.length, 1, "juice-1 and JUICE-1 collapse to one SKU");
  assert.ok(result.skusSeen >= 2, "every distinct item code in the transactions is catalogued");

  const [juice] = await db.select().from(schema.products).where(eq(schema.products.sku, "JUICE-1"));
  assert.equal(Number(juice.unitsSold), 5, "4 + 2 - 1, and the County row is not double counted");
  assert.equal(Number(juice.revenue), 125, "100 + 50 - 25");
  assert.equal(Number(juice.observedUnitPrice), 25, "price measured from the lines, not typed in");
  assert.equal(juice.priceSource, "observed");
  assert.equal(Number(juice.liquidMl), 60, "60ML read out of the product name");
  assert.equal(juice.mlSource, "parsed");
  assert.equal(juice.systemType, "OPEN");
  assert.equal(juice.systemTypeSource, "inferred");
  assert.equal(juice.wholesaleCost, null, "a sales export has no cost - left empty, not estimated");
  assert.equal(juice.needsReview, true);
  assert.deepEqual(juice.statesSold?.sort(), ["OH"]);

  const [pod] = await db.select().from(schema.products).where(eq(schema.products.sku, "POD-9"));
  assert.equal(Number(pod.observedUnitPrice), 20);
  assert.equal(Number(pod.cartridgesPerUnit), 4, "4 Pack read from the name");
  assert.equal(pod.systemType, "CLOSED");
  assert.equal(pod.liquidMl, null, "pods rarely state a volume - not invented");
});

test("a human edit is never overwritten by a later upload", async () => {
  const { db } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { buildProductUpdate } = await import("../src/lib/products/edit");
  const { refreshProductCatalog } = await import("../src/lib/products/catalog");

  const [before] = await db.select().from(schema.products).where(eq(schema.products.sku, "POD-9"));

  const update = buildProductUpdate(before, {
    description: before.description ?? "",
    wholesaleCost: "8.50",
    retailPrice: "",          // cleared - goes back to being derived
    liquidMl: "2.4",
    cartridgesPerUnit: "4",
    systemType: "CLOSED",
    containsNicotine: true,
  });
  await db.update(schema.products).set(update).where(eq(schema.products.id, before.id));

  const [edited] = await db.select().from(schema.products).where(eq(schema.products.id, before.id));
  assert.equal(Number(edited.wholesaleCost), 8.5);
  assert.equal(edited.costSource, "manual");
  assert.equal(Number(edited.liquidMl), 2.4);
  assert.equal(edited.mlSource, "manual");
  assert.ok(edited.lockedFields?.includes("wholesaleCost"));
  assert.equal(edited.needsReview, false, "nothing outstanding once cost and mL are set");

  // Rebuild: the derived fields refresh, the human's values survive.
  await refreshProductCatalog();
  const [after] = await db.select().from(schema.products).where(eq(schema.products.id, before.id));
  assert.equal(Number(after.wholesaleCost), 8.5, "manual cost survived the rebuild");
  assert.equal(Number(after.liquidMl), 2.4, "manual mL survived the rebuild");
  assert.equal(Number(after.observedUnitPrice), 20, "observed evidence still refreshes");
  assert.equal(after.priceSource, "observed", "retail was cleared, so it went back to being derived");
});

test("the purchase import fills wholesale cost automatically", async () => {
  const { db } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { insertPurchases } = await import("../src/lib/ingest/persist");
  const { refreshProductCatalog } = await import("../src/lib/products/catalog");

  const [upload] = await db
    .insert(schema.uploads)
    .values({ filename: "purchases.csv", kind: "purchases" })
    .returning({ id: schema.uploads.id });

  // 20 units for $240 => $12.00 per unit.
  await insertPurchases(upload.id, [
    { period: "2026-07", state: "OH", sku: "JUICE-1", quantity: 12, wholesaleCost: 144 },
    { period: "2026-07", state: "OH", sku: "juice-1", quantity: 8, wholesaleCost: 96 },
  ]);

  await refreshProductCatalog();
  const [juice] = await db.select().from(schema.products).where(eq(schema.products.sku, "JUICE-1"));
  assert.equal(Number(juice.wholesaleCost), 12, "weighted average unit cost from the purchases");
  assert.equal(juice.costSource, "purchases");
  assert.equal(juice.needsReview, false, "cost, mL and open/closed are all known now");
});

test("the whole month computes in one pass, every state, and stores itself", async () => {
  const { db } = await import("../src/db");
  const { insertTransactions } = await import("../src/lib/ingest/persist");
  const { computePeriodEverything } = await import("../src/lib/period");
  const { eq, and } = await import("drizzle-orm");

  const [upload] = await db
    .insert(schema.uploads)
    .values({ filename: "august.xlsx", kind: "avalara" })
    .returning({ id: schema.uploads.id });

  const line = (state: string, doc: string, amount: number, tax: number, jur = "State") => ({
    documentId: doc, lineNo: "1", ref1: null, documentStatus: "Committed",
    docType: "Sales Invoice", sign: 1, documentDate: "2026-08-14", period: "2026-08",
    reportingDate: null, taxCalcDate: null, state, destCounty: "Main", destCity: "Metro",
    destZip: "10001", jurisdictionType: jur, jurisdictionDescription: state,
    taxTypeDescription: "Sales", rate: 0.06, lineAmount: amount, discountAmount: 0,
    taxableAmount: amount, exemptAmount: 0, taxAmount: tax, quantity: 2,
    itemCode: "JUICE-1", itemDescription: "Naked 100 Lava Flow 60ML E-Liquid",
    sourceFile: "august.xlsx",
  });

  // Four states with August activity, one of them exploded across jurisdictions.
  await insertTransactions(upload.id, [
    line("FL", "A1", 1000, 60),
    line("FL", "A1", 1000, 10, "County"),
    line("TX", "A2", 2000, 125),
    line("CT", "A3", 500, 31.75),   // newly added state
    line("VT", "A4", 300, 18),      // newly added state
  ]);

  const comp = await computePeriodEverything("2026-08", { persist: true });

  assert.ok(comp.bundles.length >= 50, `every registered state is covered (got ${comp.bundles.length})`);
  assert.equal(comp.totals.statesWithActivity, 4);
  assert.equal(comp.totals.gross, 3800, "1000 + 2000 + 500 + 300, County row not double counted");

  const fl = comp.bundles.find((b) => b.state === "FL")!;
  assert.equal(fl.sales?.gross, 1000);
  assert.equal(fl.sales?.taxCollected, 70, "state 60 + county 10, summed across jurisdictions");
  assert.equal(fl.hasActivity, true);

  const ct = comp.bundles.find((b) => b.state === "CT")!;
  assert.equal(ct.sales?.taxComputed, 31.75, "Connecticut 6.35% flat");

  const quiet = comp.bundles.find((b) => b.state === "MS")!;
  assert.equal(quiet.hasActivity, false, "a state with no sales is present but has nothing to file");

  // Persisted, so the calendar and the returns list see it.
  const [stored] = await db
    .select()
    .from(schema.filings)
    .where(
      and(
        eq(schema.filings.state, "CT"),
        eq(schema.filings.taxType, "sales"),
        eq(schema.filings.period, "2026-08"),
      ),
    );
  assert.ok(stored, "the CT return was stored for August");
  assert.equal(Number(stored.taxComputed), 31.75);
  assert.equal(stored.status, "ready");
});

test("the period workbook opens with Instructions, then Summary, Actions, and a tab per state", async () => {
  const { computePeriodEverything } = await import("../src/lib/period");
  const { buildPeriodWorkbook, periodWorkbookFilename } = await import("../src/lib/excel/period-workbook");
  const ExcelJS = (await import("exceljs")).default;

  const comp = await computePeriodEverything("2026-08");
  const buf = await buildPeriodWorkbook(comp, { company: "Maximum Vapor Inc.", fein: "82-1098441" });

  assert.equal(periodWorkbookFilename("2026-08"), "All_States_2026-08.xlsx");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const names = wb.worksheets.map((w) => w.name);

  assert.deepEqual(names.slice(0, 3), ["Instructions", "Summary", "Action Items"]);
  for (const state of ["FL", "TX", "CT", "VT"]) {
    assert.ok(names.includes(state), `${state} has its own tab`);
  }
  assert.equal(names.length, 7, "three front tabs plus one per active state");

  // The Instructions tab has to actually explain the workbook, not just exist.
  const instructions = wb.getWorksheet("Instructions")!;
  let text = "";
  instructions.eachRow((row) => row.eachCell((c) => (text += ` ${c.value ?? ""}`)));
  assert.match(text, /HOW TO USE THIS WORKBOOK/);
  assert.match(text, /WHAT THE COLOURS MEAN/);
  assert.match(text, /per state PER TAX TYPE/, "the frequency trap is called out");
  assert.match(text, /PACT Act reports are due on the 10th/);

  // Every state with no sales can be included too.
  const full = await buildPeriodWorkbook(comp, {
    company: "Maximum Vapor Inc.", fein: "82-1098441", includeQuietStates: true,
  });
  const wbFull = new ExcelJS.Workbook();
  await wbFull.xlsx.load(full as unknown as ArrayBuffer);
  assert.ok(wbFull.worksheets.length >= 53, "a tab for all 50 states + DC, plus the three front tabs");
});

test("all 50 states plus DC are registered, and the new ones carry a verify note", async () => {
  const { SALES_SEED, PACT_STATES } = await import("../src/lib/seed-data");
  const states = new Set(SALES_SEED.map((s) => s.state));

  const ALL = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
    "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
    "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  ];
  for (const s of ALL) assert.ok(states.has(s), `${s} is missing from the sales config`);
  assert.ok(states.has("DC"), "DC is missing");
  assert.equal(PACT_STATES.length, 51, "PACT applies in every state plus DC");

  // Anything not filed by hand must say so, loudly.
  const unverified = SALES_SEED.filter((s) => s.notes.startsWith("VERIFY"));
  assert.ok(unverified.length >= 18, "newly seeded states are flagged for verification");
  const filedByHand = SALES_SEED.find((s) => s.state === "FL")!;
  assert.ok(!filedByHand.notes.startsWith("VERIFY"), "states filed by hand are not flagged");
});

test("a month is stored as a thing in its own right, with a row per state", async () => {
  const { db } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { computeAndStoreMonth, getMonthSnapshot, statesFromSnapshot, listMonths, setMonthStatus } =
    await import("../src/lib/months");

  const { totals } = await computeAndStoreMonth("2026-08", "tester@example.com");
  assert.equal(totals.statesWithActivity, 4);

  const snapshot = await getMonthSnapshot("2026-08");
  assert.ok(snapshot, "the month itself is stored, not just its filings");
  assert.equal(snapshot.month, "2026-08");
  assert.equal(snapshot.status, "open");
  assert.equal(snapshot.computedBy, "tester@example.com");
  assert.equal(Number(snapshot.gross), 3800);
  assert.equal(snapshot.statesWithActivity, 4);

  // One entry per state, so the month page can tab through them.
  const states = statesFromSnapshot(snapshot);
  assert.ok(states.length >= 50, "every registered state is represented");
  const fl = states.find((s) => s.state === "FL")!;
  assert.equal(fl.hasActivity, true);
  assert.equal(fl.gross, 1000);
  assert.equal(fl.collected, 70);
  assert.equal(fl.salesPeriod, "2026-08");
  const quiet = states.find((s) => s.state === "MS")!;
  assert.equal(quiet.hasActivity, false, "a quiet state still has a tab, marked as quiet");

  // Recomputing overwrites in place rather than piling up rows.
  await computeAndStoreMonth("2026-08", "tester@example.com");
  const all = await db.select().from(schema.monthlySnapshots).where(eq(schema.monthlySnapshots.month, "2026-08"));
  assert.equal(all.length, 1, "one snapshot per month");

  const months = await listMonths();
  const august = months.find((m) => m.month === "2026-08")!;
  assert.equal(august.stored, true);
  assert.ok(august.transactionRows > 0, "the row count comes from the transactions themselves");

  // A month with transactions but no snapshot still shows up - that is the
  // month you most need to see.
  const july = months.find((m) => m.month === "2026-07");
  assert.ok(july, "July has transactions from earlier tests and must be listed");
  assert.equal(july.stored, false);
  assert.equal(july.status, "open");

  await setMonthStatus("2026-08", "closed", "tester@example.com");
  const closed = await getMonthSnapshot("2026-08");
  assert.equal(closed!.status, "closed");
  assert.ok(closed!.closedAt, "closing records when");
});

test("marking reviewed acknowledges a gap without hiding it", async () => {
  const { db } = await import("../src/db");
  const { eq, and, isNull } = await import("drizzle-orm");
  const { refreshProductCatalog } = await import("../src/lib/products/catalog");

  await refreshProductCatalog();

  // A SKU with no wholesale cost genuinely needs review.
  const [before] = await db.select().from(schema.products).where(eq(schema.products.sku, "JUICE-1"));
  const gapped = before.wholesaleCost === null;

  // Reviewing everything outstanding, the way the button does.
  const now = new Date();
  await db
    .update(schema.products)
    .set({ reviewedAt: now, reviewedBy: "tester@example.com" })
    .where(and(eq(schema.products.needsReview, true), isNull(schema.products.reviewedAt)));

  const reviewed = await db.select().from(schema.products);
  for (const p of reviewed.filter((x) => x.needsReview)) {
    assert.ok(p.reviewedAt, "everything outstanding is acknowledged");
    assert.equal(
      p.wholesaleCost === null || p.liquidMl === null || p.systemType === null,
      true,
      "the gap itself is untouched - review does not fabricate data",
    );
  }
  void gapped;

  // And a rebuild must not silently un-review them.
  await refreshProductCatalog();
  const after = await db.select().from(schema.products).where(eq(schema.products.sku, "JUICE-1"));
  if (after[0].needsReview) {
    assert.ok(after[0].reviewedAt, "a rebuild keeps the person's acknowledgement");
  }
});

test("shipping lines stop demanding excise data once reclassified", async () => {
  const { db } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { insertTransactions } = await import("../src/lib/ingest/persist");
  const { refreshProductCatalog } = await import("../src/lib/products/catalog");

  const [upload] = await db
    .insert(schema.uploads)
    .values({ filename: "ship.csv", kind: "avalara" })
    .returning({ id: schema.uploads.id });

  await insertTransactions(upload.id, [
    {
      documentId: "S1", lineNo: "9", ref1: null, documentStatus: "Committed",
      docType: "Sales Invoice", sign: 1, documentDate: "2026-08-02", period: "2026-08",
      reportingDate: null, taxCalcDate: null, state: "FL", destCounty: "Main",
      destCity: "Metro", destZip: "33101", jurisdictionType: "State",
      jurisdictionDescription: "FLORIDA", taxTypeDescription: "Sales", rate: 0.06,
      lineAmount: 9.99, discountAmount: 0, taxableAmount: 9.99, exemptAmount: 0,
      taxAmount: 0.6, quantity: 1, itemCode: "SHIPPING",
      itemDescription: "SHIPPING AND HANDLING FEE", sourceFile: "ship.csv",
    },
  ]);

  await refreshProductCatalog();
  const [shipping] = await db.select().from(schema.products).where(eq(schema.products.sku, "SHIPPING"));
  assert.ok(shipping, "it is still catalogued - it is real revenue");
  assert.equal(shipping.containsNicotine, false);
  assert.equal(shipping.needsReview, false, "a shipping charge has no wholesale cost or mL to find");
});
test("a Medusa secret survives a round trip and is never stored in the clear", async () => {
  process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hs256";
  const { encryptSecret, decryptSecret, last4 } = await import("../src/lib/crypto");

  const secret = "sk_live_abcdef1234567890";
  const cipher = encryptSecret(secret);

  assert.notEqual(cipher, secret);
  assert.equal(cipher.includes(secret), false, "the plaintext must not appear in the stored value");
  assert.equal(decryptSecret(cipher), secret);
  assert.equal(last4(secret), "7890");

  // Each encryption uses a fresh IV, so the same secret never looks the same.
  assert.notEqual(encryptSecret(secret), cipher);

  // A tampered payload fails rather than returning garbage.
  assert.throws(() => decryptSecret(cipher.replace(/.$/, "A")));
});


test("Medusa orders become PACT shipment rows, and re-syncing does not duplicate them", async () => {
  const { db } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { mapOrdersToShipments } = await import("../src/lib/medusa/orders");
  const { insertShipments } = await import("../src/lib/ingest/persist");

  const orders = [
    {
      id: "ord_1",
      display_id: 1042,
      created_at: "2026-08-09T12:00:00.000Z",
      email: "jane@example.com",
      status: "completed",
      shipping_address: {
        first_name: "Jane", last_name: "Doe", address_1: "12 Oak St",
        city: "Tampa", province: "FL", postal_code: "33601", country_code: "us",
      },
      items: [
        { id: "li_1", title: "Suorin Air Pro Pod", quantity: 2, variant_sku: "SKU-1" },
        { id: "li_2", title: "Suorin Fero Pod", quantity: 1, variant_sku: "SKU-2" },
      ],
    },
    // Cancelled and non-US orders are not shipments to report.
    { id: "ord_2", status: "canceled", created_at: "2026-08-10T00:00:00.000Z",
      shipping_address: { province: "FL", country_code: "us" }, items: [{ id: "li_3", quantity: 1 }] },
    { id: "ord_3", status: "completed", created_at: "2026-08-11T00:00:00.000Z",
      shipping_address: { province: "ON", country_code: "ca" }, items: [{ id: "li_4", quantity: 1 }] },
  ];

  const mapped = mapOrdersToShipments(orders, "mia");
  assert.equal(mapped.rows.length, 2, "two line items from the one shippable order");
  assert.equal(mapped.skippedCancelled, 1);
  assert.equal(mapped.skippedNonUs, 1);
  assert.equal(mapped.rows[0].customerName, "Jane Doe");
  assert.equal(mapped.rows[0].shipToAddress, "12 Oak St");
  assert.equal(mapped.rows[0].invoiceNumber, "1042");
  assert.equal(mapped.rows[0].period, "2026-08");
  assert.equal(mapped.rows[0].externalId, "medusa:mia:ord_1:li_1");

  const [upload] = await db
    .insert(schema.uploads)
    .values({ filename: "medusa orders", kind: "shipments" })
    .returning({ id: schema.uploads.id });

  const payload = mapped.rows.map((r) => ({ ...r, sourceSystem: "medusa", sourceLabel: "MIA" }));
  await insertShipments(upload.id, payload);
  await insertShipments(upload.id, payload); // the same sync run twice

  const stored = await db
    .select()
    .from(schema.shipments)
    .where(eq(schema.shipments.sourceSystem, "medusa"));
  assert.equal(stored.length, 2, "a repeated sync corrects rows rather than doubling the filing");
  assert.equal(stored[0].customerName, "Jane Doe");
});

test("PACT prefers the order feed over the sales export", async () => {
  const { computeFiling } = await import("../src/lib/compute");
  const result = await computeFiling("FL", "pact", "2026-08");
  assert.equal(result.taxType, "pact");
  if (result.taxType !== "pact") return;

  assert.equal(result.source, "shipments", "once orders exist they are the source of truth");
  assert.ok(result.shipmentCount >= 2);
  assert.ok(
    result.rows.every((r) => r.customerName),
    "every reported shipment now has the customer name PACT requires",
  );
  assert.equal(
    result.warnings.some((w) => w.includes("customer names")),
    false,
    "and the missing-customer warning is gone",
  );
});

test("many stores can be connected, each keeping its own catalog and orders", async () => {
  const { db } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { listConnections, slugify } = await import("../src/lib/medusa/sync");

  assert.equal(slugify("MIA Tyson Vape Deals"), "mia-tyson-vape-deals");
  assert.equal(slugify("https://vapecloseouts.com/"), "vapecloseouts-com");

  await db.insert(schema.integrations).values([
    { slug: "mia", name: "MIA Tyson", baseUrl: "https://mia.example.com", status: "ok" },
    { slug: "vapecloseouts", name: "Vape Closeouts", baseUrl: "https://vc.example.com", status: "ok" },
  ]);

  const all = await listConnections();
  assert.equal(all.length, 2);
  assert.ok(all.every((c) => !("secret" in c)), "a secret is never returned to a caller");

  // A store's rows are scoped to it, so removing one cannot disturb the other.
  const [mia] = await db.select().from(schema.integrations).where(eq(schema.integrations.slug, "mia"));
  await db.insert(schema.medusaProducts).values({
    integrationId: mia.id, variantId: "mia:v1", sku: "X1", productTitle: "Thing",
  });
  await db.delete(schema.integrations).where(eq(schema.integrations.slug, "mia"));
  const orphans = await db.select().from(schema.medusaProducts).where(eq(schema.medusaProducts.variantId, "mia:v1"));
  assert.equal(orphans.length, 0, "its catalog goes with it");

  const remaining = await listConnections();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].slug, "vapecloseouts");
});

test("product tab counts come from the whole table, not the page being shown", async () => {
  const { db } = await import("../src/db");
  const { sql: dsql } = await import("drizzle-orm");

  // More rows than any one page, so a slice-based count would be wrong.
  const many = Array.from({ length: 250 }, (_, i) => ({
    sku: `PAGED-${String(i).padStart(4, "0")}`,
    description: `Paged product ${i}`,
    containsNicotine: true,
    needsReview: i % 2 === 0,
    revenue: String(1000 - i),
    unitsSold: "1",
  }));
  for (let i = 0; i < many.length; i += 100) {
    await db.insert(schema.products).values(many.slice(i, i + 100)).onConflictDoNothing();
  }

  const rows = (r: unknown) =>
    (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows) as Record<string, unknown>[];

  const [counts] = rows(
    await db.execute(dsql`
      SELECT count(*)::int all_rows,
             count(*) FILTER (WHERE needs_review AND reviewed_at IS NULL)::int review,
             count(*) FILTER (WHERE contains_nicotine AND wholesale_cost IS NULL)::int cost
      FROM products`),
  );

  assert.ok(Number(counts.all_rows) > 100, "the catalog is larger than one page");
  assert.ok(Number(counts.review) >= 125, "every outstanding row is counted, not just page one");
  assert.ok(Number(counts.cost) >= 125);

  // A page is a slice of that, ordered deterministically.
  const page1 = await db
    .select({ sku: schema.products.sku })
    .from(schema.products)
    .orderBy(dsql`${schema.products.revenue} DESC`, schema.products.sku)
    .limit(100);
  const page2 = await db
    .select({ sku: schema.products.sku })
    .from(schema.products)
    .orderBy(dsql`${schema.products.revenue} DESC`, schema.products.sku)
    .limit(100)
    .offset(100);

  assert.equal(page1.length, 100);
  assert.ok(page2.length > 0);
  assert.equal(
    page1.some((r) => page2.some((s) => s.sku === r.sku)),
    false,
    "pages do not overlap",
  );
});

test("every store variant is registered as a product, searchable by name", async () => {
  const { db } = await import("../src/db");
  const { eq, and, sql: dsql } = await import("drizzle-orm");

  const [store] = await db
    .insert(schema.integrations)
    .values({ slug: "reg-test", name: "Reg Test Store", baseUrl: "https://reg.example.com", status: "ok" })
    .returning();

  // Two variants: one whose barcode already exists as a sold SKU, one brand new.
  await db.insert(schema.products).values({
    sku: "EXISTING-1", description: "Already sold thing", unitsSold: "5", revenue: "100",
  }).onConflictDoNothing();

  await db.insert(schema.medusaProducts).values([
    {
      integrationId: store.id, variantId: "reg:v1", productTitle: "Already sold thing",
      barcode: "EXISTING-1", matchedSku: "EXISTING-1", matchMethod: "barcode",
    },
    {
      integrationId: store.id, variantId: "reg:v2", productTitle: "Brand New Juice",
      variantTitle: "60ML", barcode: "9900001", sku: "INT-9900001",
      wholesaleCost: "7.25", liquidMl: "60", systemType: "OPEN",
    },
    {
      integrationId: store.id, variantId: "reg:v3", productTitle: "No Barcode Pod",
      sku: "INT-777", matchedSku: null,
    },
  ]);

  const { syncCatalogRegisterOnly } = await import("./helpers/register");
  const added = await syncCatalogRegisterOnly(store.id, store.name);
  assert.equal(added, 2, "the matched variant is not duplicated; the other two are registered");

  // Registered under the barcode, so a later Avalara export lands on this row.
  const [fresh] = await db.select().from(schema.products).where(eq(schema.products.sku, "9900001"));
  assert.ok(fresh, "registered under its barcode");
  assert.equal(fresh.description, "Brand New Juice - 60ML");
  assert.equal(fresh.source, "medusa");
  assert.equal(fresh.storeName, "Reg Test Store");
  assert.equal(Number(fresh.wholesaleCost), 7.25);
  assert.equal(Number(fresh.liquidMl), 60);
  assert.equal(fresh.systemType, "OPEN");
  assert.equal(fresh.needsReview, false, "it has never sold, so there is nothing to review yet");

  // Falls back to the internal SKU when there is no barcode.
  const [noBarcode] = await db.select().from(schema.products).where(eq(schema.products.sku, "INT-777"));
  assert.ok(noBarcode, "still registered, keyed on the Medusa sku");

  // Searchable by name, which is the point of having them all in here.
  const found = await db
    .select({ sku: schema.products.sku })
    .from(schema.products)
    .where(dsql`${schema.products.description} ILIKE ${"%brand new%"}`);
  assert.equal(found.length, 1);
  assert.equal(found[0].sku, "9900001");

  // Re-running must not create a second copy.
  const againCount = await syncCatalogRegisterOnly(store.id, store.name);
  assert.equal(againCount, 0, "already registered, so nothing is added twice");

  const all = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(schema.products)
    .where(and(eq(schema.products.storeName, "Reg Test Store")));
  assert.equal(Number(all[0].n), 2);
});

test("the jurisdiction directory loads, and its Excel keeps codes as text", async () => {
  const { db } = await import("../src/db");
  const { parseDirectoryCsv, buildDirectoryWorkbook, DIRECTORY_COLUMNS } = await import("../src/lib/jurisdictions/directory");
  const ExcelJS = (await import("exceljs")).default;

  const csv = [
    DIRECTORY_COLUMNS.join(","),
    'tax,OK,Oklahoma City,city,5521,OK COPO,Oklahoma County,5588,Oklahoma,0.0413,0.0863,false,,,https://oklahoma.gov,"spans four counties, use per county"',
    "government,WY,Natrona County,county,56025,Census FIPS,Natrona County,,,,,false,,,https://www2.census.gov,",
  ].join("\n");
  await db.insert(schema.jurisdictionDirectory).values(parseDirectoryCsv(csv));

  const saved = await db.select().from(schema.jurisdictionDirectory);
  assert.equal(saved.length, 2);
  const okc = saved.find((r) => r.officialCode === "5521")!;
  assert.equal(okc.pairedCode, "5588");
  assert.equal(Number(okc.localRate), 0.0413);
  assert.equal(okc.notes, "spans four counties, use per county");

  const book = new ExcelJS.Workbook();
  const file = await buildDirectoryWorkbook(saved, { title: "t", builtOn: "2026-09-15" });
  await book.xlsx.load(file as unknown as ArrayBuffer);
  assert.deepEqual(book.worksheets.map((w) => w.name), ["Read me", "Tax filing codes", "All governments (FIPS)", "By state"]);
  const code = book.getWorksheet("Tax filing codes")!.getRow(2).getCell(4).value;
  assert.equal(code, "5521", "a code is text, never a number");
});

const added0 = <T extends { notes: string | null }>(rows: T[]) => rows.filter((c) => c.notes?.startsWith("From directory ("));

test("adding every state at once keeps verified codes, never collides, and undoes cleanly", async () => {
  const { db } = await import("../src/db");
  const { parseDirectoryCsv } = await import("../src/lib/jurisdictions/directory");
  const { promoteStates, removeDirectoryCreatedCodes } = await import("../src/lib/jurisdictions/promote-db");
  const { codeKey, indexKey } = await import("../src/lib/engine/sales");
  const { JURISDICTION_SEED, DEFAULT_EFFECTIVE_FROM } = await import("../src/lib/seed-data");

  // The real dataset, and the hand-verified codes as seeded.
  await db.delete(schema.jurisdictionDirectory);
  await db.delete(schema.jurisdictionCodes);
  const rows = parseDirectoryCsv(readFileSync(path.join(process.cwd(), "data/jurisdictions/us-jurisdictions.csv"), "utf8"));
  for (let i = 0; i < rows.length; i += 2000) await db.insert(schema.jurisdictionDirectory).values(rows.slice(i, i + 2000));
  for (const j of JURISDICTION_SEED) {
    await db.insert(schema.jurisdictionCodes).values({
      state: j.state, jurisdictionName: j.name, jurisdictionType: j.type, officialCode: j.code,
      pairedCode: j.pairedCode ?? null, pairedName: j.pairedName ?? null,
      rate: j.rate === undefined ? null : String(j.rate), rateIncludesState: j.rateIncludesState ?? false,
      avalaraAlias: j.avalaraAlias ?? null, notes: j.notes ?? null, effectiveFrom: DEFAULT_EFFECTIVE_FROM,
    });
  }
  const seeded = await db.select().from(schema.jurisdictionCodes);

  const first = await promoteStates("test", null, false);
  assert.ok(first.added > 10_000, `expected a nationwide load, got ${first.added}`);

  const all = await db.select().from(schema.jurisdictionCodes);
  // Every seeded code is still there, unchanged.
  for (const s of seeded) {
    const now = all.find((c) => c.id === s.id);
    assert.equal(now?.officialCode, s.officialCode, `${s.state} ${s.jurisdictionName} was altered`);
  }
  // Directory codes sharing an engine key must be told apart by county (TX has
  // two Oak Ridges; Tulsa has a code per county) or be the same code - otherwise
  // the engine could not choose and a line would go unfiled.
  const shared = new Map<string, typeof all>();
  for (const c of added0(all)) {
    for (const name of [c.jurisdictionName, c.avalaraAlias]) {
      if (!name) continue;
      const k = `${c.state}|${indexKey(c.jurisdictionType, name)}`;
      shared.set(k, [...(shared.get(k) ?? []), c]);
    }
  }
  for (const [k, list] of shared) {
    if (new Set(list.map((c) => c.officialCode)).size === 1) continue;
    const perCounty = new Map<string, Set<string>>();
    for (const c of list) {
      assert.ok(c.countyName, `engine key ${k} has several codes and ${c.officialCode} has no county`);
      perCounty.set(c.countyName!, (perCounty.get(c.countyName!) ?? new Set()).add(c.officialCode));
    }
    assert.ok([...perCounty.values()].every((s) => s.size === 1), `engine key ${k}: one county, several codes`);
  }
  const okc = all.filter((c) => c.state === "OK" && c.jurisdictionType === "city" && codeKey(c.jurisdictionName) === "oklahoma");
  assert.deepEqual(okc.map((c) => c.officialCode), ["5521"], "Oklahoma City must still resolve to 5521 only");
  // Codes-only load: no rate switched on, and paired lines only where the return takes them.
  const added = all.filter((c) => c.notes?.startsWith("From directory ("));
  assert.ok(added.every((c) => c.rate === null));
  assert.ok(added.every((c) => c.pairedCode === null || c.state === "OK"));
  assert.ok(!added.some((c) => c.state === "WY" && c.officialCode === "0101"), "a WY lodging-only code was added");

  const second = await promoteStates("test", null, false);
  assert.equal(second.added, 0, "pressing it twice adds nothing");

  const removed = await removeDirectoryCreatedCodes("test");
  assert.equal(removed, first.added);
  assert.equal((await db.select().from(schema.jurisdictionCodes)).length, seeded.length);
});
