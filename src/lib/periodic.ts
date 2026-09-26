/**
 * Quarterly and annual returns, gathered in one place.
 *
 * Monthly returns are easy to find because a month is the unit everything else
 * is organised by. A quarterly or annual return is not: its amount is the SUM
 * of every month in the period, recomputed each time one of those months is
 * run, and the result used to sit in the Returns list between hundreds of
 * monthly rows. This builds the schedule the other way round - from the rule
 * tables - so every quarter and year that is owed shows up, including the ones
 * with no data yet.
 */

import { and, eq, gte, like, lte, or, isNull, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { exciseConfig, filings, purchases, stateTaxConfig, transactions } from "@/db/schema";
import { num } from "./money";
import {
  dueDate,
  isoDate,
  monthsInPeriod,
  periodIsClosed,
  periodLabel,
  periodStart,
  type Frequency,
} from "./periods";

export type PeriodicStatus =
  | "filed"
  | "overdue"
  | "due_soon"
  | "ready"
  | "in_progress"
  | "not_computed"
  | "no_data";

export type PeriodicRow = {
  state: string;
  taxType: "sales" | "excise";
  frequency: "QUARTERLY" | "ANNUAL";
  period: string;
  label: string;
  months: string[];
  /** Months of the period that have data behind them (sales rows, or purchases for receipts-basis excise). */
  monthsWithData: string[];
  closed: boolean;
  dueDate: string;
  status: PeriodicStatus;
  taxComputed: number | null;
  taxCollected: number | null;
  delta: number | null;
  amountPaid: number | null;
  confirmationNumber: string | null;
  computedAt: string | null;
  warnings: string[];
  form: string | null;
  portal: string | null;
};

/** One schedule entry: this state files this tax this often, from this config row. */
export type ScheduleConfig = {
  state: string;
  taxType: "sales" | "excise";
  frequency: string;
  dueDay: number | null;
  basis: "SALES" | "RECEIPTS";
  form: string | null;
  portal: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type FilingSnapshot = {
  state: string;
  taxType: string;
  period: string;
  status: string;
  dueDate: string | null;
  taxComputed: number | null;
  taxCollected: number | null;
  delta: number | null;
  amountPaid: number | null;
  confirmationNumber: string | null;
  computedAt: string | null;
  warnings: string[];
};

const DUE_SOON_DAYS = 30;

function periodsOfYear(year: number, frequency: "QUARTERLY" | "ANNUAL"): string[] {
  return frequency === "ANNUAL" ? [String(year)] : [1, 2, 3, 4].map((q) => `${year}-Q${q}`);
}

/** The config row in force on the first day of the period, if it files at this frequency. */
function configFor(
  configs: ScheduleConfig[],
  state: string,
  taxType: string,
  period: string,
): ScheduleConfig | null {
  const start = isoDate(periodStart(period));
  return (
    configs.find(
      (c) =>
        c.state === state &&
        c.taxType === taxType &&
        c.effectiveFrom <= start &&
        (!c.effectiveTo || c.effectiveTo > start),
    ) ?? null
  );
}

export function buildPeriodic(opts: {
  year: number;
  configs: ScheduleConfig[];
  filings: FilingSnapshot[];
  /** `${state}|${month}` for months with sales rows. */
  salesMonths: Set<string>;
  /** `${state}|${month}` for months with purchase rows. */
  purchaseMonths: Set<string>;
  asOf?: Date;
}): PeriodicRow[] {
  const asOf = opts.asOf ?? new Date();
  const today = isoDate(asOf);
  const soon = isoDate(new Date(asOf.getTime() + DUE_SOON_DAYS * 86_400_000));
  const filingBy = new Map(opts.filings.map((f) => [`${f.state}|${f.taxType}|${f.period}`, f]));

  const pairs = [
    ...new Set(
      opts.configs
        .filter((c) => c.frequency === "QUARTERLY" || c.frequency === "ANNUAL")
        .map((c) => `${c.state}|${c.taxType}`),
    ),
  ];

  const rows: PeriodicRow[] = [];
  for (const pair of pairs) {
    const [state, taxType] = pair.split("|") as [string, "sales" | "excise"];
    for (const frequency of ["QUARTERLY", "ANNUAL"] as const) {
      for (const period of periodsOfYear(opts.year, frequency)) {
        const cfg = configFor(opts.configs, state, taxType, period);
        // Only the periods this state actually files at this frequency - Kansas
        // was monthly until 2026, and must not grow phantom quarters.
        if (!cfg || cfg.frequency !== frequency) continue;

        const months = monthsInPeriod(period);
        const have = cfg.basis === "RECEIPTS" ? opts.purchaseMonths : opts.salesMonths;
        const monthsWithData = months.filter((m) => have.has(`${state}|${m}`));
        const f = filingBy.get(`${state}|${taxType}|${period}`);
        const closed = periodIsClosed(period, asOf);
        const due = f?.dueDate ?? isoDate(dueDate(period, cfg.dueDay));

        let status: PeriodicStatus;
        if (f?.status === "filed") status = "filed";
        else if (!f) status = monthsWithData.length ? "not_computed" : "no_data";
        else if (!closed) status = "in_progress";
        else if (due < today) status = "overdue";
        else if (due <= soon) status = "due_soon";
        else status = "ready";

        rows.push({
          state,
          taxType,
          frequency,
          period,
          label: periodLabel(period),
          months,
          monthsWithData,
          closed,
          dueDate: due,
          status,
          taxComputed: f?.taxComputed ?? null,
          taxCollected: f?.taxCollected ?? null,
          delta: f?.delta ?? null,
          amountPaid: f?.amountPaid ?? null,
          confirmationNumber: f?.confirmationNumber ?? null,
          computedAt: f?.computedAt ?? null,
          warnings: f?.warnings ?? [],
          form: cfg.form,
          portal: cfg.portal,
        });
      }
    }
  }

  return rows.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.state.localeCompare(b.state) ||
      a.taxType.localeCompare(b.taxType),
  );
}

export async function loadPeriodic(year: number, asOf = new Date()): Promise<PeriodicRow[]> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [salesCfg, exciseCfg, filingRows, salesMonths, purchaseMonths] = await Promise.all([
    db
      .select()
      .from(stateTaxConfig)
      .where(
        and(
          eq(stateTaxConfig.active, true),
          eq(stateTaxConfig.taxType, "sales"),
          lte(stateTaxConfig.effectiveFrom, yearEnd),
          or(isNull(stateTaxConfig.effectiveTo), gte(stateTaxConfig.effectiveTo, yearStart)),
        ),
      ),
    db
      .select()
      .from(exciseConfig)
      .where(
        and(
          eq(exciseConfig.active, true),
          lte(exciseConfig.effectiveFrom, yearEnd),
          or(isNull(exciseConfig.effectiveTo), gte(exciseConfig.effectiveTo, yearStart)),
        ),
      ),
    db
      .select()
      .from(filings)
      .where(and(like(filings.period, `${year}%`), dsql`${filings.period} !~ '^[0-9]{4}-[0-9]{2}$'`)),
    db
      .selectDistinct({ state: transactions.state, period: transactions.period })
      .from(transactions)
      .where(like(transactions.period, `${year}-%`)),
    db
      .selectDistinct({ state: purchases.state, period: purchases.period })
      .from(purchases)
      .where(like(purchases.period, `${year}-%`)),
  ]);

  const configs: ScheduleConfig[] = [
    ...salesCfg.map((c) => ({
      state: c.state,
      taxType: "sales" as const,
      frequency: c.frequency as Frequency,
      dueDay: c.dueDay,
      basis: "SALES" as const,
      form: c.formName,
      portal: c.portal,
      effectiveFrom: String(c.effectiveFrom),
      effectiveTo: c.effectiveTo ? String(c.effectiveTo) : null,
    })),
    ...exciseCfg.map((c) => ({
      state: c.state,
      taxType: "excise" as const,
      frequency: c.frequency,
      dueDay: c.dueDay,
      basis: (c.basis === "RECEIPTS" ? "RECEIPTS" : "SALES") as "SALES" | "RECEIPTS",
      form: c.formName,
      portal: c.portal,
      effectiveFrom: String(c.effectiveFrom),
      effectiveTo: c.effectiveTo ? String(c.effectiveTo) : null,
    })),
  ];

  const n = (v: string | null) => (v === null ? null : num(v));
  return buildPeriodic({
    year,
    configs,
    filings: filingRows.map((f) => ({
      state: f.state,
      taxType: f.taxType,
      period: f.period,
      status: f.status,
      dueDate: f.dueDate ? String(f.dueDate) : null,
      taxComputed: n(f.taxComputed),
      taxCollected: n(f.taxCollected),
      delta: n(f.delta),
      amountPaid: n(f.amountPaid),
      confirmationNumber: f.confirmationNumber,
      computedAt: f.computedAt ? f.computedAt.toISOString() : null,
      warnings: Array.isArray(f.result?.warnings) ? (f.result.warnings as string[]) : [],
    })),
    salesMonths: new Set(salesMonths.map((r) => `${r.state}|${r.period}`)),
    purchaseMonths: new Set(purchaseMonths.map((r) => `${r.state}|${r.period}`)),
    asOf,
  });
}
