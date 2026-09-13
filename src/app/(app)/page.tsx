import { buildCalendarFrom, findBacklogFrom, loadCalendarData, type CalendarCell } from "@/lib/calendar";
import { monthKey } from "@/lib/periods";
import { CalendarView } from "./CalendarView";

export const dynamic = "force-dynamic";

function defaultMonth() {
  const now = new Date();
  return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = monthParam ?? defaultMonth();

  let cells: CalendarCell[] = [];
  let backlog: CalendarCell[] = [];
  let error: string | null = null;
  try {
    const data = await loadCalendarData(month);
    cells = buildCalendarFrom(data, month);
    backlog = findBacklogFrom(data);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <div className="callout callout-warn">
        <strong>Could not load the calendar.</strong>
        <div className="mt-1 font-mono text-[11px] break-all">{error}</div>
        <div className="mt-2">
          If this is a fresh install, run <code>npm run db:push</code> then{" "}
          <code>npm run db:seed</code>.
        </div>
      </div>
    );
  }

  return <CalendarView month={month} cells={cells} backlog={backlog} />;
}
