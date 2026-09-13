import { monthKey } from "@/lib/periods";
import { MonthClose } from "./MonthClose";
import { PageHeader } from "@/components/PageHeader";

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
    <div>
      <PageHeader
        title="Close the month"
        description="Computes every registered state in one pass — sales tax, vapor excise and PACT — stores the results, and produces the workbooks. Each state's tab carries its own form lines in portal order, its jurisdiction breakdown and its filing steps."
      />
      <MonthClose initialMonth={month ?? fallback} />
    </div>
  );
}
