import "server-only";
import { and, eq, gte, isNull, lte, or, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  exciseConfig,
  jurisdictionCodes,
  nexusThresholds,
  stateTaxConfig,
} from "@/db/schema";
import { num } from "./money";
import { isoDate, periodStart } from "./periods";
import type { SalesConfig, JurisdictionCode } from "./engine/sales";
import type { ExciseConfigRow } from "./engine/excise";
import { DIRECTORY_NOTE } from "./jurisdictions/directory";

/**
 * Effective dating: the row in force at the START of the filing period wins.
 * This is what lets a rate change going forward without touching a past return
 * (WA -> 95% Jan 2026, SC -> $0.05/mL Oct 2026, LA -> 5% 2025).
 */
function effectiveOn(period: string) {
  const at = isoDate(periodStart(period));
  return { at };
}

export async function resolveStateConfig(
  state: string,
  taxType: string,
  period: string,
): Promise<SalesConfig | null> {
  const { at } = effectiveOn(period);
  const [row] = await db
    .select()
    .from(stateTaxConfig)
    .where(
      and(
        eq(stateTaxConfig.state, state),
        eq(stateTaxConfig.taxType, taxType),
        eq(stateTaxConfig.active, true),
        lte(stateTaxConfig.effectiveFrom, at),
        or(isNull(stateTaxConfig.effectiveTo), gte(stateTaxConfig.effectiveTo, at)),
      ),
    )
    .orderBy(desc(stateTaxConfig.effectiveFrom))
    .limit(1);

  if (!row) return null;
  return {
    state: row.state,
    frequency: row.frequency,
    stateRate: num(row.stateRate),
    hasLocal: row.hasLocal,
    allocation: row.allocation,
    rounding: row.rounding,
    portal: row.portal,
    formName: row.formName,
    dueDay: row.dueDay,
  };
}

export async function resolveJurisdictionCodes(
  state: string,
  period: string,
): Promise<JurisdictionCode[]> {
  const { at } = effectiveOn(period);
  const rows = await db
    .select()
    .from(jurisdictionCodes)
    .where(
      and(
        eq(jurisdictionCodes.state, state),
        lte(jurisdictionCodes.effectiveFrom, at),
        or(isNull(jurisdictionCodes.effectiveTo), gte(jurisdictionCodes.effectiveTo, at)),
      ),
    );
  return rows.map((r) => ({
    jurisdictionName: r.jurisdictionName,
    jurisdictionType: r.jurisdictionType,
    officialCode: r.officialCode,
    pairedCode: r.pairedCode,
    pairedName: r.pairedName,
    rate: r.rate === null ? null : num(r.rate),
    rateIncludesState: r.rateIncludesState,
    avalaraAlias: r.avalaraAlias,
    fromDirectory: r.notes?.startsWith(DIRECTORY_NOTE) ?? false,
    countyName: r.countyName,
  }));
}

export async function resolveExciseConfig(
  state: string,
  period: string,
): Promise<ExciseConfigRow | null> {
  const { at } = effectiveOn(period);
  const [row] = await db
    .select()
    .from(exciseConfig)
    .where(
      and(
        eq(exciseConfig.state, state),
        eq(exciseConfig.active, true),
        lte(exciseConfig.effectiveFrom, at),
        or(isNull(exciseConfig.effectiveTo), gte(exciseConfig.effectiveTo, at)),
      ),
    )
    .orderBy(desc(exciseConfig.effectiveFrom))
    .limit(1);

  if (!row) return null;
  return {
    state: row.state,
    structure: row.structure,
    basis: (row.basis as "SALES" | "RECEIPTS") ?? "SALES",
    rate: num(row.rate),
    rateUnit: row.rateUnit,
    openRate: row.openRate === null ? null : num(row.openRate),
    openRateUnit: row.openRateUnit,
    closedRate: row.closedRate === null ? null : num(row.closedRate),
    closedRateUnit: row.closedRateUnit,
    frequency: row.frequency,
    portal: row.portal,
    formName: row.formName,
    dueDay: row.dueDay,
    notes: row.notes,
  };
}

/** Every state/tax-type registration in force for a period. */
export async function listActiveConfigs(period: string) {
  const { at } = effectiveOn(period);
  return db
    .select()
    .from(stateTaxConfig)
    .where(
      and(
        eq(stateTaxConfig.active, true),
        lte(stateTaxConfig.effectiveFrom, at),
        or(isNull(stateTaxConfig.effectiveTo), gte(stateTaxConfig.effectiveTo, at)),
      ),
    )
    .orderBy(asc(stateTaxConfig.state), asc(stateTaxConfig.taxType));
}

export async function getAccount(state: string, taxType: string) {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.state, state), eq(accounts.taxType, taxType)))
    .limit(1);
  return row ?? null;
}

export async function listNexusThresholds() {
  return db.select().from(nexusThresholds).orderBy(asc(nexusThresholds.state));
}
