"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import type { CalendarCell } from "@/lib/calendar";
import { StatusBadge } from "@/components/StatusBadge";
import { PeriodPicker } from "@/components/PeriodPicker";
import { RunPeriodButton } from "@/components/RunPeriodButton";

const TYPES = ["sales", "excise", "pact"] as const;

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div
        className={`stat-value ${tone === "warn" ? "text-[var(--danger)]" : tone === "ok" ? "text-[var(--ok)]" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Cell({ cell }: { cell: CalendarCell }) {
  if (cell.status === "no_activity") {
    return <span className="badge badge-no_activity">no activity</span>;
  }
  return (
    <Link href={`/returns/${cell.state}/${cell.taxType}/${cell.period}`} className="inline-flex flex-col gap-0.5">
      <StatusBadge status={cell.status} />
      <span className="tnum text-[11px] text-[var(--muted)]">
        {cell.taxComputed !== null ? fmtMoney(cell.taxComputed) : `due ${cell.dueDate.slice(5)}`}
      </span>
    </Link>
  );
}

export function CalendarView({
  month,
  cells,
  backlog,
}: {
  month: string;
  cells: CalendarCell[];
  backlog: CalendarCell[];
}) {
  const [tab, setTab] = useState<"grid" | "backlog">("grid");
  const [onlyActive, setOnlyActive] = useState(true);

  const states = [...new Set(cells.map((c) => c.state))].sort();
  const byKey = new Map(cells.map((c) => [`${c.state}|${c.taxType}`, c]));
  const active = cells.filter((c) => c.status !== "no_activity");
  const totalDue = active
    .filter((c) => c.status !== "filed")
    .reduce((s, c) => s + (c.taxComputed ?? 0), 0);
  const underCollected = active.reduce((s, c) => s + Math.max(0, c.delta ?? 0), 0);
  const overdue = cells.filter((c) => c.status === "overdue").length;

  const rows = states.filter((state) =>
    onlyActive ? TYPES.some((t) => byKey.get(`${state}|${t}`)?.status !== "no_activity") : true,
  );

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Filing calendar</h1>
            <p className="page-sub mt-0.5">
              Rows are states, columns are three separate obligations — different returns, different
              accounts, different due dates. Frequency is resolved per state per tax type.
            </p>
          </div>
          <div className="pagehead-actions">
            <PeriodPicker month={month} />
            <RunPeriodButton month={month} />
          </div>
        </div>

        <nav className="tabs">
          <button className="tab" data-active={tab === "grid"} onClick={() => setTab("grid")}>
            {periodLabel(month)}
            <span className="tab-count">{active.length}</span>
          </button>
          <button className="tab" data-active={tab === "backlog"} onClick={() => setTab("backlog")}>
            Backlog
            <span className="tab-count" data-tone={backlog.length ? "warn" : undefined}>
              {backlog.length}
            </span>
          </button>
        </nav>
      </div>

      {tab === "grid" ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Returns with activity" value={String(active.length)} sub={`across ${rows.length} states`} />
            <Tile label="Overdue this period" value={String(overdue)} tone={overdue ? "warn" : "ok"} />
            <Tile label={`Tax due · ${periodLabel(month)}`} value={fmtMoney(totalDue)} />
            <Tile
              label="Under-collection exposure"
              value={fmtMoney(underCollected)}
              tone={underCollected > 0 ? "warn" : "ok"}
              sub={underCollected > 0 ? "comes out of margin" : "nothing outstanding"}
            />
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-head">
              {rows.length} state{rows.length === 1 ? "" : "s"}
              <button className="btn btn-sm ml-auto" onClick={() => setOnlyActive((v) => !v)}>
                {onlyActive ? "Show all registered states" : "Only states with activity"}
              </button>
            </div>
            <table className="grid">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Sales / use tax</th>
                  <th>Vapor excise</th>
                  <th>PACT Act</th>
                  <th>Forms</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((state) => {
                  const row = TYPES.map((t) => byKey.get(`${state}|${t}`));
                  const anything = row.some((c) => c && c.status !== "no_activity");
                  return (
                    <tr key={state} className={anything ? "" : "opacity-55"}>
                      <td className="font-semibold">{state}</td>
                      {row.map((cell, i) => (
                        <td key={TYPES[i]}>
                          {cell ? (
                            <>
                              <Cell cell={cell} />
                              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                                {cell.frequency.toLowerCase()} · {cell.period}
                              </div>
                            </>
                          ) : (
                            <span className="text-[11.5px] text-[var(--muted)]">not registered</span>
                          )}
                        </td>
                      ))}
                      <td className="text-[11px] text-[var(--muted)]">
                        {[row[0]?.form, row[1]?.form].filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="empty">
                <strong>Nothing with activity in {periodLabel(month)}.</strong>
                <span>Upload that month&rsquo;s Avalara export, or pick another month.</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="panel overflow-hidden">
          <div className="panel-head">
            Overdue returns
            <span className="ml-auto text-[11.5px] font-normal text-[var(--muted)]">
              looking back 14 months
            </span>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>State</th>
                <th>Type</th>
                <th>Period</th>
                <th>Was due</th>
                <th>Form</th>
                <th className="num">Tax due</th>
              </tr>
            </thead>
            <tbody>
              {backlog.map((c) => (
                <tr key={`${c.state}${c.taxType}${c.period}`} className="flagged">
                  <td>
                    <Link
                      href={`/returns/${c.state}/${c.taxType}/${c.period}`}
                      className="font-semibold text-[var(--accent)]"
                    >
                      {c.state}
                    </Link>
                  </td>
                  <td className="text-[12px]">{c.taxType}</td>
                  <td className="text-[12px]">{c.period}</td>
                  <td className="whitespace-nowrap text-[12px] font-semibold text-[var(--danger)]">
                    {c.dueDate}
                  </td>
                  <td className="text-[11.5px] text-[var(--muted)]">{c.form ?? "—"}</td>
                  <td className="num">{c.taxComputed !== null ? fmtMoney(c.taxComputed) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {backlog.length === 0 && (
            <div className="empty">
              <strong>Nothing overdue.</strong>
              <span>Every return that has come due has been filed.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
