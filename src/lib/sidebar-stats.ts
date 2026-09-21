import "server-only";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { num } from "./money";

/**
 * What the sidebar shows. Deliberately a handful of cheap aggregates — it
 * renders on every page, so it must not cost a table scan to draw a badge.
 */
export type SidebarStats = {
  overdue: number;
  toReview: number;
  monthsWithData: number;
  monthsUncomputed: number;
  latest: { month: string; totalTax: number; states: number; status: string } | null;
  nextDue: { state: string; taxType: string; period: string; dueDate: string; days: number } | null;
};

const rowsOf = (r: unknown) =>
  (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows) as Record<string, unknown>[];

export async function getSidebarStats(): Promise<SidebarStats> {
  const empty: SidebarStats = {
    overdue: 0,
    toReview: 0,
    monthsWithData: 0,
    monthsUncomputed: 0,
    latest: null,
    nextDue: null,
  };

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [counts] = rowsOf(
      await db.execute(dsql`
        SELECT
          (SELECT count(*) FROM filings
             WHERE status <> 'filed' AND due_date IS NOT NULL AND due_date < ${today})::int AS overdue,
          (SELECT count(*) FROM products
             WHERE needs_review AND reviewed_at IS NULL)::int AS to_review,
          (SELECT count(DISTINCT period) FROM transactions)::int AS months_with_data,
          (SELECT count(*) FROM monthly_snapshots)::int AS months_computed
      `),
    );

    const [latest] = rowsOf(
      await db.execute(dsql`
        SELECT month, total_tax, states_with_activity, status
        FROM monthly_snapshots ORDER BY month DESC LIMIT 1
      `),
    );

    const [next] = rowsOf(
      await db.execute(dsql`
        SELECT state, tax_type, period, due_date::text AS due_date
        FROM filings
        WHERE status <> 'filed' AND due_date IS NOT NULL AND due_date >= ${today}
        ORDER BY due_date ASC, state ASC LIMIT 1
      `),
    );

    const monthsWithData = Number(counts?.months_with_data ?? 0);
    const monthsComputed = Number(counts?.months_computed ?? 0);

    return {
      overdue: Number(counts?.overdue ?? 0),
      toReview: Number(counts?.to_review ?? 0),
      monthsWithData,
      monthsUncomputed: Math.max(0, monthsWithData - monthsComputed),
      latest: latest
        ? {
            month: String(latest.month),
            totalTax: num(latest.total_tax as string),
            states: Number(latest.states_with_activity ?? 0),
            status: String(latest.status ?? "open"),
          }
        : null,
      nextDue: next
        ? {
            state: String(next.state),
            taxType: String(next.tax_type),
            period: String(next.period),
            dueDate: String(next.due_date),
            days: Math.round(
              (new Date(`${next.due_date}T00:00:00Z`).getTime() -
                new Date(`${today}T00:00:00Z`).getTime()) /
                86_400_000,
            ),
          }
        : null,
    };
  } catch {
    // A fresh install has no tables yet; the sidebar still has to draw.
    return empty;
  }
}
