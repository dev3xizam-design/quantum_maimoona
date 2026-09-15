"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  changeLog,
  exciseConfig,
  jurisdictionCodes,
  nexusThresholds,
  stateTaxConfig,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  const s = v === null ? "" : String(v).trim();
  return s === "" ? null : s;
};
const numStr = (fd: FormData, k: string) => {
  const s = str(fd, k);
  return s === null ? null : String(Number(s));
};
const int = (fd: FormData, k: string) => {
  const s = str(fd, k);
  return s === null ? null : Number.parseInt(s, 10);
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function log(
  actor: string,
  table: string,
  rowId: number | null,
  action: string,
  before: unknown,
  after: unknown,
  effectiveFrom: string | null,
) {
  await db.insert(changeLog).values({
    actor,
    tableName: table,
    rowId,
    action,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    effectiveFrom,
  });
}

/**
 * The monthly workflow: change a rate, give it an effective date, save.
 * A new effective date CLOSES the old row and opens a new one, so past periods
 * keep the rate that applied then and future periods pick up the new one.
 */
export async function reviseStateConfig(formData: FormData) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const [existing] = await db.select().from(stateTaxConfig).where(eq(stateTaxConfig.id, id)).limit(1);
  if (!existing) return;

  const effectiveFrom = str(formData, "effectiveFrom") ?? existing.effectiveFrom;
  const values = {
    state: existing.state,
    taxType: existing.taxType,
    frequency: str(formData, "frequency") ?? existing.frequency,
    stateRate: numStr(formData, "stateRate") ?? existing.stateRate,
    hasLocal: bool(formData, "hasLocal"),
    allocation: str(formData, "allocation") ?? existing.allocation,
    rounding: str(formData, "rounding") ?? existing.rounding,
    portal: str(formData, "portal"),
    formName: str(formData, "formName"),
    dueDay: int(formData, "dueDay") ?? existing.dueDay,
    rateLabel: str(formData, "rateLabel"),
    notes: str(formData, "notes"),
    active: bool(formData, "active"),
    effectiveFrom,
    updatedAt: new Date(),
  };

  if (effectiveFrom === existing.effectiveFrom) {
    await db.update(stateTaxConfig).set(values).where(eq(stateTaxConfig.id, id));
    await log(session.email, "state_tax_config", id, "update", existing, values, effectiveFrom);
  } else {
    await db
      .update(stateTaxConfig)
      .set({ effectiveTo: dayBefore(effectiveFrom), updatedAt: new Date() })
      .where(eq(stateTaxConfig.id, id));
    const [created] = await db.insert(stateTaxConfig).values(values).returning({ id: stateTaxConfig.id });
    await log(session.email, "state_tax_config", created.id, "create", existing, values, effectiveFrom);
  }

  revalidatePath("/config");
  revalidatePath("/", "layout");
}

export async function reviseExciseConfig(formData: FormData) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const [existing] = await db.select().from(exciseConfig).where(eq(exciseConfig.id, id)).limit(1);
  if (!existing) return;

  const effectiveFrom = str(formData, "effectiveFrom") ?? existing.effectiveFrom;
  const values = {
    state: existing.state,
    structure: str(formData, "structure") ?? existing.structure,
    basis: str(formData, "basis") ?? existing.basis,
    rate: numStr(formData, "rate") ?? existing.rate,
    rateUnit: str(formData, "rateUnit") ?? existing.rateUnit,
    openRate: numStr(formData, "openRate"),
    openRateUnit: str(formData, "openRateUnit"),
    closedRate: numStr(formData, "closedRate"),
    closedRateUnit: str(formData, "closedRateUnit"),
    frequency: str(formData, "frequency") ?? existing.frequency,
    portal: str(formData, "portal"),
    formName: str(formData, "formName"),
    dueDay: int(formData, "dueDay") ?? existing.dueDay,
    notes: str(formData, "notes"),
    active: bool(formData, "active"),
    effectiveFrom,
    updatedAt: new Date(),
  };

  if (effectiveFrom === existing.effectiveFrom) {
    await db.update(exciseConfig).set(values).where(eq(exciseConfig.id, id));
    await log(session.email, "excise_config", id, "update", existing, values, effectiveFrom);
  } else {
    await db
      .update(exciseConfig)
      .set({ effectiveTo: dayBefore(effectiveFrom), updatedAt: new Date() })
      .where(eq(exciseConfig.id, id));
    const [created] = await db.insert(exciseConfig).values(values).returning({ id: exciseConfig.id });
    await log(session.email, "excise_config", created.id, "create", existing, values, effectiveFrom);
  }

  revalidatePath("/config/excise");
  revalidatePath("/", "layout");
}

export async function saveJurisdictionCode(formData: FormData) {
  const session = await requireSession();
  const idRaw = str(formData, "id");
  const values = {
    state: (str(formData, "state") ?? "").toUpperCase(),
    jurisdictionName: str(formData, "jurisdictionName") ?? "",
    jurisdictionType: str(formData, "jurisdictionType") ?? "county",
    officialCode: str(formData, "officialCode") ?? "",
    pairedCode: str(formData, "pairedCode"),
    pairedName: str(formData, "pairedName"),
    rate: numStr(formData, "rate"),
    rateIncludesState: bool(formData, "rateIncludesState"),
    avalaraAlias: str(formData, "avalaraAlias"),
    countyName: str(formData, "countyName"),
    notes: str(formData, "notes"),
    effectiveFrom: str(formData, "effectiveFrom") ?? "2026-01-01",
    updatedAt: new Date(),
  };
  if (!values.state || !values.jurisdictionName || !values.officialCode) return;

  if (idRaw) {
    const id = Number(idRaw);
    const [existing] = await db.select().from(jurisdictionCodes).where(eq(jurisdictionCodes.id, id)).limit(1);
    await db.update(jurisdictionCodes).set(values).where(eq(jurisdictionCodes.id, id));
    await log(session.email, "jurisdiction_codes", id, "update", existing, values, values.effectiveFrom);
  } else {
    const [created] = await db.insert(jurisdictionCodes).values(values).returning({ id: jurisdictionCodes.id });
    await log(session.email, "jurisdiction_codes", created.id, "create", null, values, values.effectiveFrom);
  }
  revalidatePath("/config/jurisdictions");
}

export async function deleteJurisdictionCode(formData: FormData) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const [existing] = await db.select().from(jurisdictionCodes).where(eq(jurisdictionCodes.id, id)).limit(1);
  await db.delete(jurisdictionCodes).where(eq(jurisdictionCodes.id, id));
  await log(session.email, "jurisdiction_codes", id, "delete", existing, null, null);
  revalidatePath("/config/jurisdictions");
}

export async function saveAccount(formData: FormData) {
  const session = await requireSession();
  const idRaw = str(formData, "id");
  const values = {
    state: (str(formData, "state") ?? "").toUpperCase(),
    taxType: str(formData, "taxType") ?? "sales",
    accountNumber: str(formData, "accountNumber"),
    licenseNumber: str(formData, "licenseNumber"),
    loginField: str(formData, "loginField"),
    frequencyOverride: str(formData, "frequencyOverride"),
    notes: str(formData, "notes"),
    updatedAt: new Date(),
  };
  if (!values.state) return;

  if (idRaw) {
    const id = Number(idRaw);
    const [existing] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    await db.update(accounts).set(values).where(eq(accounts.id, id));
    await log(session.email, "accounts", id, "update", existing, values, null);
  } else {
    const [created] = await db.insert(accounts).values(values).returning({ id: accounts.id });
    await log(session.email, "accounts", created.id, "create", null, values, null);
  }
  revalidatePath("/config/accounts");
}

export async function saveNexus(formData: FormData) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const values = {
    amountThreshold: numStr(formData, "amountThreshold"),
    txnThreshold: int(formData, "txnThreshold"),
    notes: str(formData, "notes"),
  };
  await db.update(nexusThresholds).set(values).where(eq(nexusThresholds.id, id));
  await log(session.email, "nexus_thresholds", id, "update", null, values, null);
  revalidatePath("/config/nexus");
}
