import { listMonths } from "@/lib/months";
import { recentMonths } from "@/lib/periods";
import { PageHeader } from "@/components/PageHeader";
import { MonthsTable } from "./MonthsTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Months" };

export default async function MonthsPage() {
  const months = await listMonths();
  const known = new Set(months.map((m) => m.month));
  const suggestions = recentMonths(3).filter((m) => !known.has(m));

  return (
    <div>
      <PageHeader
        title="Months"
        description="Everything is stored a month at a time. Open a month to see every state that had activity in it."
      />
      <MonthsTable months={months} suggestions={suggestions} />
    </div>
  );
}
