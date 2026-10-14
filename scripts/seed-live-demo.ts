import "../src/lib/load-env";
import { db, sql } from "../src/db";
import {
  filings,
  monthlySnapshots,
  portals,
  integrations,
  uploads,
  products,
  shipments,
  transactions,
} from "../src/db/schema";
import { PACT_STATES, SALES_SEED } from "../src/lib/seed-data";
import { stateName } from "../src/lib/states";

async function main() {
  console.log("Seeding realistic live-matching demo data into local database...");

  // Ensure missing tables exist
  const { sql: dsql } = await import("drizzle-orm");
  await db.execute(dsql`
    CREATE TABLE IF NOT EXISTS "portals" (
      "id" serial PRIMARY KEY NOT NULL,
      "state" text NOT NULL,
      "label" text NOT NULL,
      "purpose" text,
      "portal_url" text,
      "login_id" text,
      "license_number" text,
      "frequency" text,
      "status" text DEFAULT 'active' NOT NULL,
      "secret_cipher" text,
      "notes" text,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(dsql`
    CREATE TABLE IF NOT EXISTS "monthly_snapshots" (
      "id" serial PRIMARY KEY NOT NULL,
      "month" text NOT NULL,
      "status" text DEFAULT 'open' NOT NULL,
      "totals" jsonb,
      "states" jsonb,
      "states_with_activity" integer DEFAULT 0 NOT NULL,
      "gross" numeric(18, 4) DEFAULT '0' NOT NULL,
      "taxable" numeric(18, 4) DEFAULT '0' NOT NULL,
      "sales_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
      "excise_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
      "total_tax" numeric(18, 4) DEFAULT '0' NOT NULL,
      "collected" numeric(18, 4) DEFAULT '0' NOT NULL,
      "delta" numeric(18, 4) DEFAULT '0' NOT NULL,
      "pact_shipments" integer DEFAULT 0 NOT NULL,
      "warnings" integer DEFAULT 0 NOT NULL,
      "computed_at" timestamp with time zone,
      "computed_by" text,
      "closed_at" timestamp with time zone,
      "closed_by" text,
      "notes" text,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(dsql`CREATE UNIQUE INDEX IF NOT EXISTS "portal_label_idx" ON "portals" ("label")`);
  await db.execute(dsql`CREATE INDEX IF NOT EXISTS "portal_state_idx" ON "portals" ("state")`);
  await db.execute(dsql`CREATE UNIQUE INDEX IF NOT EXISTS "monthly_snapshot_month_idx" ON "monthly_snapshots" ("month")`);

  // 1. Portals (46 states)
  await db.delete(portals);
  const portalEntries = SALES_SEED.filter((s) => s.portal).map((s, idx) => ({
    state: s.state,
    label: `${stateName(s.state)} Department of Revenue`,
    purpose: s.taxType === "excise" ? "Excise Tax" : "Sales & Use Tax",
    portalUrl: s.portal!,
    loginId: `maxvapor_${s.state.toLowerCase()}`,
    licenseNumber: `MV-${s.state}-99418`,
    frequency: s.frequency,
    status: "active" as const,
    notes: s.notes || "Official State Portal",
    sortOrder: idx,
  }));
  if (portalEntries.length > 0) {
    await db.insert(portals).values(portalEntries);
    console.log(`✓ Inserted ${portalEntries.length} state portals`);
  }

  // 2. Integrations (2 connected stores)
  await db.delete(integrations);
  await db.insert(integrations).values([
    {
      slug: "shopify-retail",
      name: "MaxVapor Retail (Shopify)",
      provider: "shopify",
      baseUrl: "https://maxvapor-retail.myshopify.com",
      status: "ok",
      syncOrders: true,
      lastSyncedAt: new Date(),
      secretLast4: "8472",
    },
    {
      slug: "shopify-wholesale",
      name: "MaxVapor B2B Wholesale (Shopify)",
      provider: "shopify",
      baseUrl: "https://maxvapor-b2b.myshopify.com",
      status: "ok",
      syncOrders: true,
      lastSyncedAt: new Date(),
      secretLast4: "9130",
    },
  ]);
  console.log("✓ Inserted 2 connected Shopify store integrations");

  // 3. Monthly Snapshots (October 2026: $283.07, 13 states, open)
  await db.delete(monthlySnapshots);
  await db.insert(monthlySnapshots).values([
    {
      month: "2026-10",
      status: "open",
      gross: "5840.5000",
      taxable: "4110.2000",
      salesTax: "283.0700",
      exciseTax: "0.0000",
      totalTax: "283.0700",
      collected: "283.0700",
      delta: "0.0000",
      statesWithActivity: 13,
      pactShipments: 42,
      warnings: 0,
      computedAt: new Date(),
      computedBy: "engine",
      notes: "October 2026 open filing period",
    },
    {
      month: "2026-09",
      status: "closed",
      gross: "7420.0000",
      taxable: "5910.0000",
      salesTax: "412.8000",
      exciseTax: "0.0000",
      totalTax: "412.8000",
      collected: "412.8000",
      delta: "0.0000",
      statesWithActivity: 15,
      pactShipments: 58,
      warnings: 0,
      computedAt: new Date(),
      computedBy: "engine",
      closedAt: new Date("2026-10-01"),
      closedBy: "admin@quantum.tax",
      notes: "September 2026 closed period",
    },
    {
      month: "2026-08",
      status: "closed",
      gross: "6250.0000",
      taxable: "4920.0000",
      salesTax: "350.2500",
      exciseTax: "0.0000",
      totalTax: "350.2500",
      collected: "350.2500",
      delta: "0.0000",
      statesWithActivity: 12,
      pactShipments: 39,
      warnings: 0,
      computedAt: new Date(),
      computedBy: "engine",
      closedAt: new Date("2026-09-01"),
      closedBy: "admin@quantum.tax",
      notes: "August 2026 closed period",
    },
  ]);
  console.log("✓ Inserted monthly snapshots (Oct 2026: $283.07)");

  // 4. Filings (Upcoming ME due tomorrow, 12 other states for Oct, and 100+ overdue PACT filings)
  await db.delete(filings);

  // Tomorrow date for ME sales
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // Filings for October 2026 (totaling $283.07 across 13 states)
  const octStates = [
    { state: "ME", tax: "42.50", due: tomorrowStr },
    { state: "CA", tax: "58.12", due: "2026-10-31" },
    { state: "FL", tax: "34.80", due: "2026-10-20" },
    { state: "TX", tax: "29.45", due: "2026-10-20" },
    { state: "IL", tax: "24.10", due: "2026-10-20" },
    { state: "NC", tax: "18.30", due: "2026-10-20" },
    { state: "GA", tax: "16.70", due: "2026-10-20" },
    { state: "OH", tax: "15.20", due: "2026-10-23" },
    { state: "PA", tax: "14.90", due: "2026-10-20" },
    { state: "NV", tax: "11.60", due: "2026-10-31" },
    { state: "KS", tax: "8.40", due: "2026-10-25" },
    { state: "AZ", tax: "5.50", due: "2026-10-20" },
    { state: "NJ", tax: "3.50", due: "2026-10-20" },
  ];

  for (const s of octStates) {
    await db.insert(filings).values({
      state: s.state,
      taxType: "sales",
      period: "2026-10",
      status: "ready",
      dueDate: s.due,
      gross: "450.0000",
      taxable: "320.0000",
      taxComputed: s.tax,
      taxCollected: s.tax,
      delta: "0.0000",
    });
  }
  console.log("✓ Inserted 13 October 2026 sales filings (ME due tomorrow)");

  // Overdue PACT filings for 2025-12 and 2026-01 (due 2026-01-10, 2026-02-10) -> over 100 rows!
  const overdueFilings = [];
  for (const st of PACT_STATES) {
    overdueFilings.push({
      state: st,
      taxType: "pact",
      period: "2025-12",
      status: "not_started" as const,
      dueDate: "2026-01-10",
      gross: "0.0000",
      taxable: "0.0000",
      taxComputed: null,
    });
    overdueFilings.push({
      state: st,
      taxType: "pact",
      period: "2026-01",
      status: "not_started" as const,
      dueDate: "2026-02-10",
      gross: "0.0000",
      taxable: "0.0000",
      taxComputed: null,
    });
  }
  if (overdueFilings.length > 0) {
    await db.insert(filings).values(overdueFilings);
    console.log(`✓ Inserted ${overdueFilings.length} overdue PACT filings (badge: 99+)`);
  }

  // 5. Uploads history
  await db.delete(uploads);
  await db.insert(uploads).values([
    {
      filename: "avalara_sales_oct2026_export.csv",
      kind: "avalara",
      rowCount: 1420,
      status: "complete",
      uploadedBy: "admin@quantum.tax",
      createdAt: new Date("2026-10-12T14:30:00Z"),
    },
    {
      filename: "shopify_orders_october_batch.csv",
      kind: "shipments",
      rowCount: 388,
      status: "complete",
      uploadedBy: "admin@quantum.tax",
      createdAt: new Date("2026-10-10T11:15:00Z"),
    },
    {
      filename: "wholesale_catalog_update_q4.csv",
      kind: "products",
      rowCount: 850,
      status: "complete",
      uploadedBy: "admin@quantum.tax",
      createdAt: new Date("2026-10-05T09:40:00Z"),
    },
    {
      filename: "avalara_sales_sep2026_final.csv",
      kind: "avalara",
      rowCount: 1840,
      status: "complete",
      uploadedBy: "admin@quantum.tax",
      createdAt: new Date("2026-09-30T17:00:00Z"),
    },
  ]);
  console.log("✓ Inserted recent uploads history");

  // 6. Products sample catalog
  await db.delete(products);
  const sampleProducts = [
    { sku: "SUORIN-AIR-PRO-GUNMETAL", description: "Suorin Air Pro Pod Kit - Gunmetal", wholesaleCost: "16.50", retailPrice: "29.99", liquidMl: "4.9", containsNicotine: true, unitsSold: "240", revenue: "7197.60", observedUnitPrice: "29.99", observedUnitCost: "16.50" },
    { sku: "SUORIN-DROP-2-PEACOCK", description: "Suorin Drop 2 Pod System - Peacock", wholesaleCost: "14.20", retailPrice: "24.99", liquidMl: "3.7", containsNicotine: true, unitsSold: "185", revenue: "4623.15", observedUnitPrice: "24.99", observedUnitCost: "14.20" },
    { sku: "SUORIN-SHINE-CARTRIDGE-3PK", description: "Suorin Shine Replacement Cartridge 3-Pack", wholesaleCost: "4.80", retailPrice: "9.99", liquidMl: "6.0", containsNicotine: false, unitsSold: "420", revenue: "4195.80", observedUnitPrice: "9.99", observedUnitCost: "4.80" },
    { sku: "SALT-NIC-MANGO-30ML-50MG", description: "MaxVapor Salts Mango Burst 30ml 50mg", wholesaleCost: "5.50", retailPrice: "14.99", liquidMl: "30.0", containsNicotine: true, unitsSold: "310", revenue: "4646.90", observedUnitPrice: "14.99", observedUnitCost: "5.50" },
    { sku: "SALT-NIC-BLUE-RAZZ-30ML-50MG", description: "MaxVapor Salts Blue Razz Ice 30ml 50mg", wholesaleCost: "5.50", retailPrice: "14.99", liquidMl: "30.0", containsNicotine: true, unitsSold: "295", revenue: "4422.05", observedUnitPrice: "14.99", observedUnitCost: "5.50" },
  ];
  await db.insert(products).values(sampleProducts);
  console.log(`✓ Inserted ${sampleProducts.length} catalog products`);

  // 7. Shipments sample
  await db.delete(shipments);
  const sampleShipments = [
    { period: "2026-10", state: "CA", orderNumber: "ORD-9401", customerName: "John Doe", product: "Suorin Air Pro Pod Kit", quantity: "2", mlTotal: "9.8" },
    { period: "2026-10", state: "TX", orderNumber: "ORD-9402", customerName: "Alice Smith", product: "MaxVapor Salts Mango Burst", quantity: "4", mlTotal: "120.0" },
    { period: "2026-10", state: "FL", orderNumber: "ORD-9403", customerName: "Robert Johnson", product: "Suorin Drop 2 Pod System", quantity: "1", mlTotal: "3.7" },
    { period: "2026-10", state: "ME", orderNumber: "ORD-9404", customerName: "Emily Davis", product: "Suorin Shine Replacement Cartridge", quantity: "3", mlTotal: "18.0" },
  ];
  await db.insert(shipments).values(sampleShipments);
  console.log(`✓ Inserted ${sampleShipments.length} sample PACT shipments`);

  // 8. Transactions for 2026-10, 2026-09, 2026-08 across all 13 states
  await db.delete(transactions);
  const periods = ["2026-10", "2026-09", "2026-08"];
  const txRows = [];
  let docCount = 1000;
  for (const period of periods) {
    for (const s of octStates) {
      docCount++;
      txRows.push({
        sourceFile: "avalara_sales_export.csv",
        documentId: `DOC-${docCount}`,
        lineNo: "1",
        ref1: `ORDER-${docCount}`,
        documentStatus: "Committed",
        docType: "Sales Invoice",
        sign: 1,
        documentDate: `${period}-10`,
        period,
        reportingDate: `${period}-10`,
        taxCalcDate: `${period}-10`,
        state: s.state,
        destCounty: "Central",
        destCity: "Metro",
        destZip: "00000",
        jurisdictionType: "State",
        jurisdictionDescription: stateName(s.state),
        taxTypeDescription: "Sales and Use Tax",
        rate: "0.0600",
        lineAmount: "450.0000",
        discountAmount: "0.0000",
        taxableAmount: "320.0000",
        exemptAmount: "130.0000",
        taxAmount: s.tax,
        quantity: "2.0000",
        itemCode: "SUORIN-AIR-PRO",
        itemDescription: "Suorin Air Pro Pod Kit",
      });
    }
  }
  await db.insert(transactions).values(txRows);
  console.log(`✓ Inserted ${txRows.length} transactions across ${periods.join(", ")}`);

  console.log("\n All live demo data successfully seeded into local database!");
  await sql.end();
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
