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

  const dir = path.join(process.cwd(), "drizzle");
  const file = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()[0];
  const sqlText = readFileSync(path.join(dir, file), "utf8");
  for (const stmt of sqlText.split("--> statement-breakpoint")) {
    const s = stmt.trim();
    if (s) await client.exec(s);
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
    "accounts", "change_log", "excise_config", "filings", "jurisdiction_codes",
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
