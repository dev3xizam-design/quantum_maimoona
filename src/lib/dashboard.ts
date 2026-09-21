import "server-only";
import { desc, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations, monthlySnapshots, uploads } from "@/db/schema";
import { num } from "./money";

/**
 * Everything the dashboard shows, in one place. Each piece is a small
 * aggregate — the landing page should open instantly, not run a report.
 */

export type DeadlineRow = {
  state: string;
  taxType: string;
  period: string;
  dueDate: string;
  days: number;
  amount: number | null;
};

export type MonthRow = {
  month: string;
  totalTax: number;
  states: number;
  status: string;
  warnings: number;
};

export type DashboardData = {
  latest: MonthRow | null;
  months: MonthRow[];
  overdue: DeadlineRow[];
  overdueCount: number;
  upcoming: DeadlineRow[];
  gaps: { noCost: number; noMl: number; noSystem: number; soldSkus: number };
  pactRows: number;
  stores: { total: number; connected: number };
  uploads: { filename: string; kind: string; rows: number; when: string }[];
  monthsWithData: number;
  monthsComputed: number;
};

const rowsOf = (r: unknown) =>
  (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows) as Record<string, unknown>[];

const daysFrom = (today: string, date: string) =>
  Math.round(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000,
  );

function deadline(r: Record<string, unknown>, today: string): DeadlineRow {
  const due = String(r.due_date);
  return {
    state: String(r.state),
    taxType: String(r.tax_type),
    period: String(r.period),
    dueDate: due,
    days: daysFrom(today, due),
    amount: r.tax_computed === null || r.tax_computed === undefined ? null : num(r.tax_computed as string),
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);
  const empty: DashboardData = {
    latest: null, months: [], overdue: [], overdueCount: 0, upcoming: [],
    gaps: { noCost: 0, noMl: 0, noSystem: 0, soldSkus: 0 },
    pactRows: 0, stores: { total: 0, connected: 0 }, uploads: [],
    monthsWithData: 0, monthsComputed: 0,
  };

  try {
    const [snapshots, overdueRows, upcomingRows, gapRow, miscRow, storeRows, uploadRows] =
      await Promise.all([
        db.select().from(monthlySnapshots).orderBy(desc(monthlySnapshots.month)).limit(6),
        db.execute(dsql`
          SELECT state, tax_type, period, due_date::text AS due_date, tax_computed
          FROM filings
          WHERE status <> 'filed' AND due_date IS NOT NULL AND due_date < ${today}
          ORDER BY due_date ASC, state ASC LIMIT 6`),
        db.execute(dsql`
          SELECT state, tax_type, period, due_date::text AS due_date, tax_computed
          FROM filings
          WHERE status <> 'filed' AND due_date IS NOT NULL AND due_date >= ${today}
          ORDER BY due_date ASC, state ASC LIMIT 6`),
        db.execute(dsql`
          SELECT
            count(*) FILTER (WHERE units_sold <> 0 AND contains_nicotine AND wholesale_cost IS NULL)::int no_cost,
            count(*) FILTER (WHERE units_sold <> 0 AND contains_nicotine AND liquid_ml IS NULL)::int no_ml,
            count(*) FILTER (WHERE units_sold <> 0 AND contains_nicotine AND system_type IS NULL)::int no_system,
            count(*) FILTER (WHERE units_sold <> 0)::int sold
          FROM products`),
        db.execute(dsql`
          SELECT
            (SELECT count(*) FROM shipments)::int pact_rows,
            (SELECT count(*) FROM filings WHERE status <> 'filed' AND due_date < ${today})::int overdue_total,
            (SELECT count(DISTINCT period) FROM transactions)::int months_with_data,
            (SELECT count(*) FROM monthly_snapshots)::int months_computed`),
        db.select({ status: integrations.status }).from(integrations),
        db.select().from(uploads).orderBy(desc(uploads.createdAt)).limit(4),
      ]);

    const months: MonthRow[] = snapshots.map((s) => ({
      month: s.month,
      totalTax: num(s.totalTax),
      states: s.statesWithActivity,
      status: s.status,
      warnings: s.warnings,
    }));
    const gap = rowsOf(gapRow)[0] ?? {};
    const misc = rowsOf(miscRow)[0] ?? {};

    return {
      latest: months[0] ?? null,
      months,
      overdue: rowsOf(overdueRows).map((r) => deadline(r, today)),
      overdueCount: Number(misc.overdue_total ?? 0),
      upcoming: rowsOf(upcomingRows).map((r) => deadline(r, today)),
      gaps: {
        noCost: Number(gap.no_cost ?? 0),
        noMl: Number(gap.no_ml ?? 0),
        noSystem: Number(gap.no_system ?? 0),
        soldSkus: Number(gap.sold ?? 0),
      },
      pactRows: Number(misc.pact_rows ?? 0),
      stores: {
        total: storeRows.length,
        connected: storeRows.filter((s) => s.status === "ok").length,
      },
      uploads: uploadRows.map((u) => ({
        filename: u.filename,
        kind: u.kind,
        rows: u.rowCount,
        when: u.createdAt.toISOString().slice(0, 10),
      })),
      monthsWithData: Number(misc.months_with_data ?? 0),
      monthsComputed: Number(misc.months_computed ?? 0),
    };
  } catch {
    return empty;
  }
}
