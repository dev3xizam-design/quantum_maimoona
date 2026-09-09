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

/** Every return the company is registered to file, sales + excise + PACT. */
export async function listRegistrations(period: string): Promise<Registration[]> {
  const salesish = await listActiveConfigs(period);
  const excise = await db.select().from(exciseConfig).where(eq(exciseConfig.active, true));

  const out: Registration[] = salesish
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
    if (out.some((r) => r.state === e.state && r.taxType === "excise")) continue;
    out.push({
      state: e.state,
      taxType: "excise",
      frequency: e.frequency,
      form: e.formName,
      portal: e.portal,
      dueDay: e.dueDay,
    });
  }
  return out.sort((a, b) => a.state.localeCompare(b.state) || a.taxType.localeCompare(b.taxType));
}

/**
 * The filing grid for one calendar month: rows = states, columns = tax types.
 * Frequency is resolved PER STATE PER TAX TYPE - the #1 lesson from doc 03
 * (Kansas sales is ANNUAL while its EC-2 excise is MONTHLY).
 */
export async function buildCalendar(month: string, asOf = new Date()): Promise<CalendarCell[]> {
  const regs = await listRegistrations(month);

  const activity = await db
    .select({
      state: transactions.state,
      period: transactions.period,
      rows: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .groupBy(transactions.state, transactions.period);
  const activeSet = new Set(activity.map((a) => `${a.state}|${a.period}`));

  const wanted = regs.map((r) => ({
    ...r,
    period: filingPeriod(month, r.frequency as Frequency),
  }));

  const periods = [...new Set(wanted.map((w) => w.period))];
  const existing = periods.length
    ? await db.select().from(filings).where(inArray(filings.period, periods))
    : [];
  const filingByKey = new Map(existing.map((f) => [`${f.state}|${f.taxType}|${f.period}`, f]));

  const today = isoDate(asOf);

  return wanted.map((w) => {
    const due = isoDate(dueDate(w.period, w.dueDay));
    const f = filingByKey.get(`${w.state}|${w.taxType}|${w.period}`);
    const hasActivity = monthsInPeriod(w.period).some((m) => activeSet.has(`${w.state}|${m}`));
    const periodClosed = isoDate(periodEnd(w.period)) < today;

    let status: CalendarCell["status"];
    if (f?.status === "filed") status = "filed";
    else if (due < today && periodClosed && (hasActivity || f)) status = "overdue";
    else if (f?.status === "ready") status = "ready";
    else if (hasActivity) status = "not_started";
    else status = "no_activity";

    return {
      state: w.state,
      taxType: w.taxType,
      period: w.period,
      frequency: w.frequency,
      form: w.form,
      portal: w.portal,
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

/**
 * Everything overdue across the last `lookbackMonths` - the Louisiana/Kentucky
 * "four months behind and nobody knew" problem.
 */
export async function findBacklog(lookbackMonths = 14, asOf = new Date()): Promise<CalendarCell[]> {
  const months: string[] = [];
  for (let i = 1; i <= lookbackMonths; i++) {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const seen = new Set<string>();
  const out: CalendarCell[] = [];
  for (const m of months) {
    for (const cell of await buildCalendar(m, asOf)) {
      const key = `${cell.state}|${cell.taxType}|${cell.period}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cell.status === "overdue") out.push(cell);
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function getFiling(state: string, taxType: string, period: string) {
  const [row] = await db
    .select()
    .from(filings)
    .where(and(eq(filings.state, state), eq(filings.taxType, taxType), eq(filings.period, period)))
    .limit(1);
  return row ?? null;
}
