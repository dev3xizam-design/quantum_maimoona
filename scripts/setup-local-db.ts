import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/lib/password";
import {
  ACCOUNT_SEED,
  DEFAULT_EFFECTIVE_FROM,
  PACT_EFFECTIVE_FROM,
  EXCISE_SEED,
  JURISDICTION_SEED,
  NEXUS_SEED,
  PACT_STATES,
  SALES_SEED,
} from "../src/lib/seed-data";

async function main() {
  const dataDir = path.join(process.cwd(), "data", "pgdata");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  console.log("Connecting to local PGlite at", dataDir);
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });

  console.log("Applying migrations...");
  const dir = path.join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    console.log("  Running", file);
    const sqlText = readFileSync(path.join(dir, file), "utf8");
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      const s = stmt.trim();
      if (s) {
        try {
          await client.exec(s);
        } catch (e: any) {
          if (!e.message?.includes("already exists")) {
            console.warn("Notice on statement:", e.message);
          }
        }
      }
    }
  }

  console.log("Seeding base tax data...");
  await db.delete(schema.stateTaxConfig);
  await db.delete(schema.exciseConfig);
  await db.delete(schema.jurisdictionCodes);
  await db.delete(schema.nexusThresholds);
  await db.delete(schema.accounts);

  for (const s of SALES_SEED) {
    await db.insert(schema.stateTaxConfig).values({
      state: s.state,
      taxType: "sales",
      frequency: s.frequency,
      stateRate: String(s.rate),
      hasLocal: s.hasLocal,
      allocation: s.allocation,
      rounding: s.rounding,
      portal: s.portal,
      formName: s.form,
      dueDay: s.dueDay,
      rateLabel: s.rateLabel,
      notes: s.notes,
      active: s.active ?? true,
      effectiveFrom: s.effectiveFrom ?? DEFAULT_EFFECTIVE_FROM,
    });
  }

  for (const state of PACT_STATES) {
    const sales = SALES_SEED.find((s) => s.state === state);
    await db.insert(schema.stateTaxConfig).values({
      state,
      taxType: "pact",
      frequency: "MONTHLY",
      stateRate: "0",
      hasLocal: false,
      allocation: "none",
      rounding: "cents",
      portal: sales?.portal ?? null,
      formName: "PACT Act ENDS report",
      dueDay: 10,
      rateLabel: "Not a tax - a per-shipment disclosure",
      notes:
        "Monthly, due the 10th. Applies from the FIRST interstate shipment - no economic-nexus threshold. Cigarette PA-1 sections stay blank.",
      active: true,
      effectiveFrom: PACT_EFFECTIVE_FROM,
    });
  }

  for (const e of EXCISE_SEED) {
    await db.insert(schema.exciseConfig).values({
      state: e.state,
      structure: e.structure,
      basis: e.basis,
      rate: String(e.rate),
      rateUnit: e.rateUnit,
      openRate: e.openRate === undefined ? null : String(e.openRate),
      openRateUnit: e.openRateUnit ?? null,
      closedRate: e.closedRate === undefined ? null : String(e.closedRate),
      closedRateUnit: e.closedRateUnit ?? null,
      frequency: e.frequency,
      portal: e.portal,
      formName: e.form,
      dueDay: e.dueDay,
      notes: e.notes,
      active: true,
      effectiveFrom: e.effectiveFrom ?? DEFAULT_EFFECTIVE_FROM,
    });
  }

  for (const j of JURISDICTION_SEED) {
    await db.insert(schema.jurisdictionCodes).values({
      state: j.state,
      jurisdictionName: j.name,
      jurisdictionType: j.type,
      officialCode: j.code,
      pairedCode: j.pairedCode ?? null,
      pairedName: j.pairedName ?? null,
      rate: j.rate === undefined ? null : String(j.rate),
      rateIncludesState: j.rateIncludesState ?? false,
      avalaraAlias: j.avalaraAlias ?? null,
      notes: j.notes ?? null,
      effectiveFrom: DEFAULT_EFFECTIVE_FROM,
    });
  }

  for (const n of NEXUS_SEED) {
    await db.insert(schema.nexusThresholds).values({
      state: n.state,
      amountThreshold: String(n.amount),
      txnThreshold: n.txns,
      effectiveFrom: DEFAULT_EFFECTIVE_FROM,
    });
  }

  for (const a of ACCOUNT_SEED) {
    await db.insert(schema.accounts).values({
      state: a.state,
      taxType: a.taxType,
      accountNumber: a.accountNumber ?? null,
      licenseNumber: a.licenseNumber ?? null,
      loginField: a.loginField ?? null,
      notes: a.notes ?? null,
    });
  }

  console.log("Creating default admin user...");
  const existingUsers = await db.select().from(schema.users);
  if (existingUsers.length === 0) {
    const pw = await hashPassword("admin123");
    await db.insert(schema.users).values({
      email: "admin@quantum.tax",
      passwordHash: pw,
      name: "Admin User",
      role: "admin",
    });
    console.log("Admin user created: admin@quantum.tax / admin123");
  } else {
    console.log("Users already exist:", existingUsers.map((u) => u.email).join(", "));
  }

  await client.close();
  console.log("Local database setup complete!");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
