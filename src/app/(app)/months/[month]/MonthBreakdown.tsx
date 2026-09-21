"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmtMoney } from "@/lib/money";
import { stateName } from "@/lib/states";
import type { StateMonth } from "@/lib/months";

type Status = "all" | "open" | "filed" | "quiet";

/**
 * Every state as a row rather than forty-two chips. The old tab strip put a red
 * count on each one, which read as forty-two errors before you had looked at
 * anything — here the same information is a quiet column you can sort by.
 */
export function MonthBreakdown({ month, states }: { month: string; states: StateMonth[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<"state" | "tax" | "gross" | "attention">("tax");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = states.filter((s) => {
      if (status === "open") return s.hasActivity;
      if (status === "quiet") return !s.hasActivity;
      if (status === "filed") return false;
      return true;
    });
    if (q) {
      list = list.filter(
        (s) => s.state.toLowerCase().includes(q) || stateName(s.state).toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "state") return a.state.localeCompare(b.state);
      if (sort === "gross") return b.gross - a.gross;
      if (sort === "attention") return b.warnings - a.warnings;
      return b.salesTax + (b.excise ?? 0) - (a.salesTax + (a.excise ?? 0));
    });
  }, [states, query, status, sort]);

  const active = states.filter((s) => s.hasActivity).length;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Monthly breakdown</h2>
          <p className="text-[12px] text-[var(--muted)]">
            {active} states with activity this month
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 md:flex-nowrap">
          <input
            type="text"
            placeholder="Search state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-[170px]"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-[140px]">
            <option value="all">All states</option>
            <option value="open">With activity</option>
            <option value="quiet">No activity</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-[150px]">
            <option value="tax">Sort: tax due</option>
            <option value="gross">Sort: gross sales</option>
            <option value="state">Sort: state A–Z</option>
            <option value="attention">Sort: needs attention</option>
          </select>
        </div>
      </div>

      <div className="max-h-[68vh] min-h-[280px] overflow-auto">
        <table className="qtable">
          <thead>
            <tr>
              <th>State</th>
              <th>Status</th>
              <th className="num">Gross sales</th>
              <th className="num">Tax due</th>
              <th className="num">Under-collected</th>
              <th className="num">To review</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const href = `/months/${month}/${s.state}`;
              const selected = pathname === href;
              const due = s.salesTax + (s.excise ?? 0);
              return (
                <tr key={s.state} className={selected ? "flagged" : ""}>
                  <td>
                    <Link href={href} className="font-semibold text-[var(--accent)]">
                      {s.state}
                    </Link>
                    <div className="text-[10.5px] text-[var(--muted)]">{stateName(s.state)}</div>
                  </td>
                  <td>
                    <span className={`badge ${s.hasActivity ? "badge-ready" : "badge-no_activity"}`}>
                      {s.hasActivity ? "open" : "no activity"}
                    </span>
                  </td>
                  <td className="num">{s.hasActivity ? fmtMoney(s.gross) : "—"}</td>
                  <td className="num font-semibold">{s.hasActivity ? fmtMoney(due) : "—"}</td>
                  <td className={`num ${s.delta >= 0.01 ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                    {s.delta >= 0.01 ? fmtMoney(s.delta) : "—"}
                  </td>
                  <td className="num">
                    {s.warnings > 0 ? (
                      <span className="badge badge-not_started">{s.warnings}</span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td>
                    <Link href={href} className="btn btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">Nothing matches that filter.</div>}
      </div>
    </section>
  );
}
