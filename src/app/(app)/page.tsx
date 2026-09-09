import Link from "next/link";
import { buildCalendar, findBacklog, type CalendarCell } from "@/lib/calendar";
import { fmtMoney } from "@/lib/money";
import { monthKey, periodLabel } from "@/lib/periods";
import { StatusBadge } from "@/components/StatusBadge";
import { PeriodPicker } from "@/components/PeriodPicker";
import { RunPeriodButton } from "@/components/RunPeriodButton";

export const dynamic = "force-dynamic";

const TYPES = ["sales", "excise", "pact"] as const;

function defaultMonth() {
  const now = new Date();
  return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div
        className={`mt-1 text-[22px] font-semibold tnum ${
          tone === "warn" ? "text-[var(--danger)]" : tone === "ok" ? "text-[var(--ok)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CellLink({ cell }: { cell: CalendarCell }) {
  if (cell.status === "no_activity") {
    return <span className="badge badge-no_activity">-</span>;
  }
  return (
    <Link
      href={`/returns/${cell.state}/${cell.taxType}/${cell.period}`}
      className="inline-flex flex-col gap-0.5"
    >
      <StatusBadge status={cell.status} />
      <span className="text-[11px] text-[var(--muted)] tnum">
        {cell.taxComputed !== null ? fmtMoney(cell.taxComputed) : `due ${cell.dueDate.slice(5)}`}
      </span>
    </Link>
  );
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
    [cells, backlog] = await Promise.all([buildCalendar(month), findBacklog()]);
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

  const states = [...new Set(cells.map((c) => c.state))].sort();
  const byKey = new Map(cells.map((c) => [`${c.state}|${c.taxType}`, c]));
  const active = cells.filter((c) => c.status !== "no_activity");
  const totalDue = active
    .filter((c) => c.status !== "filed")
    .reduce((s, c) => s + (c.taxComputed ?? 0), 0);
  const underCollected = active.reduce((s, c) => s + Math.max(0, c.delta ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Filing calendar</h1>
          <p className="text-[12px] text-[var(--muted)]">
            Frequency is resolved per state per tax type - Kansas sales is annual while its EC-2
            excise is monthly.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <PeriodPicker month={month} />
          <RunPeriodButton month={month} />
        </div>
      </div>

      {backlog.length > 0 && (
        <div className="callout callout-warn">
          <strong>{backlog.length} overdue return{backlog.length === 1 ? "" : "s"} in the backlog.</strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {backlog.slice(0, 24).map((c) => (
              <Link
                key={`${c.state}${c.taxType}${c.period}`}
                href={`/returns/${c.state}/${c.taxType}/${c.period}`}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-[12px] font-medium text-[var(--danger)]"
              >
                {c.state} {c.taxType} {c.period} <span className="opacity-60">due {c.dueDate}</span>
              </Link>
            ))}
            {backlog.length > 24 && (
              <span className="px-2 py-1 text-[12px]">+{backlog.length - 24} more</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Returns with activity" value={String(active.length)} />
        <Tile
          label="Overdue"
          value={String(cells.filter((c) => c.status === "overdue").length)}
          tone={cells.some((c) => c.status === "overdue") ? "warn" : undefined}
        />
        <Tile label={`Tax due - ${periodLabel(month)}`} value={fmtMoney(totalDue)} />
        <Tile
          label="Under-collection exposure"
          value={fmtMoney(underCollected)}
          tone={underCollected > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="panel overflow-hidden">
        <table className="grid">
          <thead>
            <tr>
              <th>State</th>
              <th>Sales / use tax</th>
              <th>Vapor excise</th>
              <th>PACT Act</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {states.map((state) => {
              const row = TYPES.map((t) => byKey.get(`${state}|${t}`));
              const anything = row.some((c) => c && c.status !== "no_activity");
              return (
                <tr key={state} className={anything ? "" : "opacity-50"}>
                  <td className="font-semibold">{state}</td>
                  {row.map((cell, i) => (
                    <td key={TYPES[i]}>
                      {cell ? (
                        <div>
                          <CellLink cell={cell} />
                          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                            {cell.frequency.toLowerCase()} - {cell.period}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">not registered</span>
                      )}
                    </td>
                  ))}
                  <td className="text-[11px] text-[var(--muted)]">
                    {row[0]?.form ?? ""}
                    {row[1]?.form ? ` · ${row[1].form}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {states.length === 0 && (
        <div className="callout callout-note">
          No registrations loaded yet. Run <code>npm run db:seed</code> to load the state rules, then
          upload an Avalara export.
        </div>
      )}
    </div>
  );
}
