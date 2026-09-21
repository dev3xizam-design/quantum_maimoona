"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import type { MonthListRow } from "@/lib/months";

type Status = "all" | "open" | "closed" | "uncomputed";
type Sort = "newest" | "oldest" | "tax" | "attention";

export function MonthsTable({ months, suggestions }: { months: MonthListRow[]; suggestions: string[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = months.filter((m) => {
      if (status === "open") return m.stored && m.status === "open";
      if (status === "closed") return m.status === "closed";
      if (status === "uncomputed") return !m.stored;
      return true;
    });
    if (q) {
      list = list.filter(
        (m) => m.month.includes(q) || periodLabel(m.month).toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "oldest") return a.month.localeCompare(b.month);
      if (sort === "tax") return b.totalTax - a.totalTax;
      if (sort === "attention") return b.warnings - a.warnings;
      return b.month.localeCompare(a.month);
    });
  }, [months, query, status, sort]);

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">
            {months.length} month{months.length === 1 ? "" : "s"} with data
          </h2>
          <p className="text-[12px] text-[var(--muted)]">Newest first</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 md:flex-nowrap">
          <input
            type="text"
            placeholder="Search month…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-[170px]"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-[150px]">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="uncomputed">Not computed</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-[150px]">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="tax">Largest tax due</option>
            <option value="attention">Needs attention</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="qtable">
          <thead>
            <tr>
              <th>Month</th>
              <th>Status</th>
              <th className="num">States</th>
              <th className="num">Gross sales</th>
              <th className="num">Total tax due</th>
              <th className="num">Under-collected</th>
              <th className="num">To review</th>
              <th>Computed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.month}>
                <td>
                  <Link href={`/months/${m.month}`} className="font-semibold text-[var(--accent)]">
                    {periodLabel(m.month)}
                  </Link>
                  <div className="text-[10.5px] text-[var(--muted)]">
                    {m.transactionRows.toLocaleString()} rows
                  </div>
                </td>
                <td>
                  {!m.stored ? (
                    <span className="badge badge-not_started">not computed</span>
                  ) : m.status === "closed" ? (
                    <span className="badge badge-filed">closed</span>
                  ) : (
                    <span className="badge badge-ready">open</span>
                  )}
                </td>
                <td className="num">{m.stored ? m.statesWithActivity : "—"}</td>
                <td className="num">{m.stored ? fmtMoney(m.gross) : "—"}</td>
                <td className="num font-semibold">{m.stored ? fmtMoney(m.totalTax) : "—"}</td>
                <td className={`num ${m.delta >= 0.01 ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                  {m.stored && m.delta >= 0.01 ? fmtMoney(m.delta) : "—"}
                </td>
                <td className="num">
                  {m.stored && m.warnings > 0 ? (
                    <span className="badge badge-not_started">{m.warnings}</span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-[11.5px] text-[var(--muted)]">
                  {m.computedAt ?? "—"}
                </td>
                <td>
                  <Link href={`/months/${m.month}`} className="btn btn-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="empty">
          <strong>Nothing matches that filter.</strong>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex items-start gap-3 border-t border-[var(--line)] bg-[#f8faf9] px-5 py-4 text-[12.5px]">
          <span
            className="tile-icon"
            style={{ width: 26, height: 26, borderRadius: 9, background: "var(--blue-soft)", color: "var(--blue)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 8h.01M11 12h1v5h1" /><circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <span className="text-[var(--muted)]">
            <strong className="text-[var(--ink)]">Nothing uploaded for {periodLabel(suggestions[0])}.</strong>{" "}
            A month with no transactions has nothing to file.
          </span>
        </div>
      )}
    </section>
  );
}
