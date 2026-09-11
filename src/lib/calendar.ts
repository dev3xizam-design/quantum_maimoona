import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { exciseConfig, filings, transactions } from "@/db/schema";
import { listActiveConfigs } from "./config";
import { num } from "./money";
import { dueDate, filingPeriod, isoDate, monthsInPeriod, periodEnd, type Frequency } from "./periods";

export type CalendarCell = {
  state: string;
  taxType: string;
  period: string;
  frequency: string;
  form: string | null;
  portal: string | null;
  dueDate: string;
  status: "no_activity" | "not_started" | "ready" | "filed" | "overdue";
  hasActivity: boolean;
  taxComputed: number | null;
  delta: number | null;
  confirmationNumber: string | null;
  filedAt: string | null;
};

type Registration = {
  state: string;
  taxType: string;
  frequency: string;
  form: string | null;
  portal: string | null;
  dueDay: number | null;
};

/**
 * One snapshot of everything the calendar needs. Loaded ONCE and then reused
 * for every month rendered - the previous version re-queried per month, which
 * at 51 states over a 14-month backlog scan meant dozens of round trips and a
 * page that timed out.
 */
export type CalendarData = {
  registrations: Registration[];
  activity: Set<string>; // `${state}|${month}`
  filings: Map<string, typeof filings.$inferSelect>; // `${state}|${taxType}|${period}`
};

export async function loadCalendarData(referenceMonth: string): Promise<CalendarData> {
  const [salesish, excise, activityRows, filingRows] = await Promise.all([
    listActiveConfigs(referenceMonth),
    db.select().from(exciseConfig).where(eq(exciseConfig.active, true)),
    db
      .select({ state: transactions.state, period: transactions.period })
      .from(transactions)
      .groupBy(transactions.state, transactions.period),
    db.select().from(filings),
  ]);

  const registrations: Registration[] = salesish
    .filter((c) => c.frequency !== "NONE")
    .map((c) => ({
      state: c.state,
      taxType: c.taxType,
      frequency: c.frequency,
      form: c.formName,
      portal: c.portal,
      dueDay: c.dueDay,
    }));

  for (const e of excise) {
    if (registrations.some((r) => r.state === e.state && r.taxType === "excise")) continue;
    registrations.push({
      state: e.state,
      taxType: "excise",
      frequency: e.frequency,
      form: e.formName,
      portal: e.portal,
      dueDay: e.dueDay,
    });
  }

  registrations.sort(
    (a, b) => a.state.localeCompare(b.state) || a.taxType.localeCompare(b.taxType),
  );

  return {
    registrations,
    activity: new Set(activityRows.map((a) => `${a.state}|${a.period}`)),
    filings: new Map(filingRows.map((f) => [`${f.state}|${f.taxType}|${f.period}`, f])),
  };
}

/**
 * The filing grid for one calendar month: rows = states, columns = tax types.
 * Frequency is resolved PER STATE PER TAX TYPE - Kansas sales is ANNUAL while
 * its EC-2 excise is MONTHLY.
 */
export function buildCalendarFrom(
  data: CalendarData,
  month: string,
  asOf = new Date(),
): CalendarCell[] {
  const today = isoDate(asOf);

  return data.registrations.map((reg) => {
    const period = filingPeriod(month, reg.frequency as Frequency);
    const due = isoDate(dueDate(period, reg.dueDay));
    const f = data.filings.get(`${reg.state}|${reg.taxType}|${period}`);
    const hasActivity = monthsInPeriod(period).some((m) =>
      data.activity.has(`${reg.state}|${m}`),
    );
    const periodClosed = isoDate(periodEnd(period)) < today;

    let status: CalendarCell["status"];
    if (f?.status === "filed") status = "filed";
    else if (due < today && periodClosed && (hasActivity || f)) status = "overdue";
    else if (f?.status === "ready") status = "ready";
    else if (hasActivity) status = "not_started";
    else status = "no_activity";

    return {
      state: reg.state,
      taxType: reg.taxType,
      period,
      frequency: reg.frequency,
      form: reg.form,
      portal: reg.portal,
      dueDate: due,
      status,
      hasActivity,
      taxComputed: f?.taxComputed ? num(f.taxComputed) : null,
      delta: f?.delta ? num(f.delta) : null,
      confirmationNumber: f?.confirmationNumber ?? null,
      filedAt: f?.filedAt ? f.filedAt.toISOString().slice(0, 10) : null,
    };
  });
}

export async function buildCalendar(month: string, asOf = new Date()): Promise<CalendarCell[]> {
  return buildCalendarFrom(await loadCalendarData(month), month, asOf);
}

/**
 * Everything overdue across the last `lookbackMonths` - the "four months behind
 * and nobody knew" problem. Computed entirely from the snapshot.
 */
export function findBacklogFrom(
  data: CalendarData,
  lookbackMonths = 14,
  asOf = new Date(),
): CalendarCell[] {
  const seen = new Set<string>();
  const out: CalendarCell[] = [];

  for (let i = 1; i <= lookbackMonths; i++) {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1));
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    for (const cell of buildCalendarFrom(data, m, asOf)) {
      const key = `${cell.state}|${cell.taxType}|${cell.period}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cell.status === "overdue") out.push(cell);
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function findBacklog(lookbackMonths = 14, asOf = new Date()): Promise<CalendarCell[]> {
  const ref = `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, "0")}`;
  return findBacklogFrom(await loadCalendarData(ref), lookbackMonths, asOf);
}

export async function listRegistrations(period: string): Promise<Registration[]> {
  return (await loadCalendarData(period)).registrations;
}

export async function getFiling(state: string, taxType: string, period: string) {
  const [row] = await db
    .select()
    .from(filings)
    .where(and(eq(filings.state, state), eq(filings.taxType, taxType), eq(filings.period, period)))
    .limit(1);
  return row ?? null;
}

export { sql, inArray };
