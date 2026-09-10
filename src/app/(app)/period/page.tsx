import { monthKey } from "@/lib/periods";
import { MonthClose } from "./MonthClose";

export const dynamic = "force-dynamic";

export default async function PeriodPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const now = new Date();
  const fallback = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Close the month</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Computes every registered state in one pass — sales tax, vapor excise and PACT — stores
          the results, and produces a single workbook with a tab per state. Each state&rsquo;s tab
          carries its own form lines in portal order, its jurisdiction breakdown and its filing
          steps.
        </p>
      </div>

      <MonthClose initialMonth={month ?? fallback} />
    </div>
  );
}
