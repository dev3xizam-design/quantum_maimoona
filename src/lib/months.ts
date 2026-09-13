import "server-only";
import { desc, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { monthlySnapshots, transactions } from "@/db/schema";
import { num, round2 } from "./money";
import { computePeriodEverything, type PeriodComputation } from "./period";

/** One state's line in a stored month. */
export type StateMonth = {
  state: string;
  hasActivity: boolean;
  gross: number;
  exempt: number;
  taxable: number;
  salesTax: number;
  collected: number;
  delta: number;
  salesPeriod: string | null;
  salesDue: string | null;
  salesForm: string | null;
  reconciles: boolean;
  excise: number | null;
  excisePeriod: string | null;
  exciseDue: string | null;
  exciseForm: string | null;
  exciseBasis: string | null;
  pactLines: number;
  pactDue: string | null;
  warnings: number;
  warningList: string[];
};

export type MonthTotals = {
  states: number;
  statesWithActivity: number;
  gross: number;
  taxable: number;
  salesTax: number;
  exciseTax: number;
  totalTax: number;
  collected: number;
  delta: number;
  pactShipments: number;
  warnings: number;
  reconcileFailures: string[];
};

export function summarizeStates(comp: PeriodComputation): StateMonth[] {
  return comp.bundles.map((b) => {
    const warningList = [
      ...(b.sales?.warnings ?? []),
      ...(b.excise?.warnings ?? []),
      ...(b.pact?.warnings ?? []),
    ];
    return {
      state: b.state,
      hasActivity: b.hasActivity,
      gross: b.sales?.gross ?? 0,
      exempt: b.sales?.exempt ?? 0,
      taxable: b.sales?.taxable ?? 0,
      salesTax: b.sales?.taxComputed ?? 0,
      collected: b.sales?.taxCollected ?? 0,
      delta: b.sales?.delta ?? 0,
      salesPeriod: b.salesPeriod,
      salesDue: b.sales?.dueDate ?? null,
      salesForm: b.sales?.form ?? null,
      reconciles: b.sales?.reconciles ?? true,
      excise: b.excise ? b.excise.taxComputed : null,
      excisePeriod: b.excisePeriod,
      exciseDue: b.excise?.dueDate ?? null,
      exciseForm: b.excise?.form ?? null,
      exciseBasis: b.excise?.basis ?? null,
      pactLines: b.pact?.shipmentCount ?? 0,
      pactDue: b.pact?.dueDate ?? null,
      warnings: warningList.length,
      warningList,
    };
  });
}

/**
 * Compute the month, store every return, and write the month's own snapshot.
 * The snapshot is what the month page reads, so the figures you reviewed stay
 * put even if a later upload changes the underlying transactions.
 */
export async function computeAndStoreMonth(month: string, actor: string) {
  const comp = await computePeriodEverything(month, { persist: true });
  const states = summarizeStates(comp);
  const t = comp.totals;

  const values = {
    month,
    totals: t as unknown as Record<string, unknown>,
    states: states as unknown as Record<string, unknown>[],
    statesWithActivity: t.statesWithActivity,
    gross: t.gross.toFixed(4),
    taxable: t.taxable.toFixed(4),
    salesTax: t.salesTax.toFixed(4),
    exciseTax: t.exciseTax.toFixed(4),
    totalTax: t.totalTax.toFixed(4),
    collected: t.collected.toFixed(4),
    delta: t.delta.toFixed(4),
    pactShipments: t.pactShipments,
    warnings: t.warnings,
    computedAt: new Date(),
    computedBy: actor,
    updatedAt: new Date(),
  };

  await db
    .insert(monthlySnapshots)
    .values(values)
    .onConflictDoUpdate({ target: monthlySnapshots.month, set: values });

  return { comp, states, totals: t };
}

export async function getMonthSnapshot(month: string) {
  const [row] = await db
    .select()
    .from(monthlySnapshots)
    .where(eq(monthlySnapshots.month, month))
    .limit(1);
  return row ?? null;
}

export type MonthListRow = {
  month: string;
  status: string;
  statesWithActivity: number;
  gross: number;
  totalTax: number;
  delta: number;
  warnings: number;
  computedAt: string | null;
  closedAt: string | null;
  stored: boolean;
  transactionRows: number;
};

/**
 * Every month that has data, whether or not it has been computed yet - a month
 * with transactions and no snapshot is exactly the thing you need to see.
 */
export async function listMonths(): Promise<MonthListRow[]> {
  const [snapshots, activity] = await Promise.all([
    db.select().from(monthlySnapshots).orderBy(desc(monthlySnapshots.month)),
    db
      .select({ period: transactions.period, rows: dsql<number>`count(*)::int` })
      .from(transactions)
      .groupBy(transactions.period),
  ]);

  const byMonth = new Map<string, MonthListRow>();

  for (const a of activity) {
    byMonth.set(a.period, {
      month: a.period,
      status: "open",
      statesWithActivity: 0,
      gross: 0,
      totalTax: 0,
      delta: 0,
      warnings: 0,
      computedAt: null,
      closedAt: null,
      stored: false,
      transactionRows: Number(a.rows),
    });
  }

  for (const s of snapshots) {
    const existing = byMonth.get(s.month);
    byMonth.set(s.month, {
      month: s.month,
      status: s.status,
      statesWithActivity: s.statesWithActivity,
      gross: num(s.gross),
      totalTax: num(s.totalTax),
      delta: num(s.delta),
      warnings: s.warnings,
      computedAt: s.computedAt ? s.computedAt.toISOString().slice(0, 16).replace("T", " ") : null,
      closedAt: s.closedAt ? s.closedAt.toISOString().slice(0, 10) : null,
      stored: true,
      transactionRows: existing?.transactionRows ?? 0,
    });
  }

  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export async function setMonthStatus(month: string, status: "open" | "closed", actor: string) {
  await db
    .update(monthlySnapshots)
    .set({
      status,
      closedAt: status === "closed" ? new Date() : null,
      closedBy: status === "closed" ? actor : null,
      updatedAt: new Date(),
    })
    .where(eq(monthlySnapshots.month, month));
}

export function statesFromSnapshot(row: typeof monthlySnapshots.$inferSelect): StateMonth[] {
  const raw = (row.states ?? []) as unknown as StateMonth[];
  return raw.map((s) => ({ ...s, gross: round2(s.gross ?? 0) }));
}
