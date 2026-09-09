/**
 * Loads the editable rule tables and creates the first admin user.
 * Idempotent: re-running refreshes seeded rules but never touches transactions
 * or filings, and never overwrites a user's password.
 *
 *   npm run db:seed -- --email you@example.com --password 'a-strong-one' --name 'Your Name'
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db, sql } from "../src/db";
import {
  accounts,
  exciseConfig,
  jurisdictionCodes,
  nexusThresholds,
  stateTaxConfig,
  users,
} from "../src/db/schema";
import {
  ACCOUNT_SEED,
  DEFAULT_EFFECTIVE_FROM,
  EXCISE_SEED,
  JURISDICTION_SEED,
  NEXUS_SEED,
  PACT_STATES,
  SALES_SEED,
} from "../src/lib/seed-data";
import { hashPassword } from "../src/lib/auth";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  console.log("Seeding rule tables...");

  await db.delete(stateTaxConfig);
  await db.delete(exciseConfig);
  await db.delete(jurisdictionCodes);
  await db.delete(nexusThresholds);

  for (const s of SALES_SEED) {
    await db.insert(stateTaxConfig).values({
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
  console.log(`  ${SALES_SEED.length} sales-tax rules`);

  for (const state of PACT_STATES) {
    const sales = SALES_SEED.find((s) => s.state === state);
    await db.insert(stateTaxConfig).values({
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
      effectiveFrom: DEFAULT_EFFECTIVE_FROM,
    });
  }
  console.log(`  ${PACT_STATES.length} PACT registrations`);

  for (const e of EXCISE_SEED) {
    await db.insert(exciseConfig).values({
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
  console.log(`  ${EXCISE_SEED.length} excise rules`);

  for (const j of JURISDICTION_SEED) {
    await db.insert(jurisdictionCodes).values({
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
  console.log(`  ${JURISDICTION_SEED.length} jurisdiction codes`);

  for (const n of NEXUS_SEED) {
    await db.insert(nexusThresholds).values({
      state: n.state,
      amountThreshold: String(n.amount),
      txnThreshold: n.txns,
      effectiveFrom: DEFAULT_EFFECTIVE_FROM,
    });
  }
  console.log(`  ${NEXUS_SEED.length} nexus thresholds`);

  for (const a of ACCOUNT_SEED) {
    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.state, a.state), eq(accounts.taxType, a.taxType)))
      .limit(1);
    if (existing) continue;
    await db.insert(accounts).values({
      state: a.state,
      taxType: a.taxType,
      accountNumber: a.accountNumber ?? null,
      licenseNumber: a.licenseNumber ?? null,
      loginField: a.loginField ?? null,
      notes: a.notes ?? null,
    });
  }
  console.log(`  accounts ensured`);

  const email = arg("email");
  const password = arg("password");
  const name = arg("name") ?? "Admin";
  if (email && password) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (existing) {
      console.log(`  user ${email} already exists - password unchanged`);
    } else {
      await db.insert(users).values({
        email: email.toLowerCase(),
        name,
        passwordHash: await hashPassword(password),
        role: "admin",
      });
      console.log(`  created user ${email}`);
    }
  } else {
    console.log("  (no --email/--password given - create the first user at /login)");
  }

  console.log("Done.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
