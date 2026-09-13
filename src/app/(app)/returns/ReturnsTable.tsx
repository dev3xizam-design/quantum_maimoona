"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

export type ReturnRow = {
  id: number;
  state: string;
  taxType: string;
  period: string;
  dueDate: string | null;
  status: string;
  taxable: number | null;
  taxComputed: number | null;
  taxCollected: number | null;
  delta: number | null;
  confirmationNumber: string | null;
};

type Key = "all" | "overdue" | "ready" | "filed" | "delta";

const FILTERS: { key: Key; label: string; match: (r: ReturnRow) => boolean; tone?: "warn" }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "overdue", label: "Overdue", match: (r) => r.status === "overdue", tone: "warn" },
  { key: "ready", label: "Ready to file", match: (r) => r.status === "ready" },
  { key: "filed", label: "Filed", match: (r) => r.status === "filed" },
  {
    key: "delta",
    label: "Under-collected",
    match: (r) => (r.delta ?? 0) >= 0.01,
    tone: "warn",
  },
];

const TYPES = ["all", "sales", "excise", "pact"] as const;

export function ReturnsTable({ rows }: { rows: ReturnRow[] }) {
  const [filter, setFilter] = useState<Key>("all");
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        f.match(r) &&
        (type === "all" || r.taxType === type) &&
        (!q || r.state.toLowerCase().includes(q) || r.period.toLowerCase().includes(q)),
    );
  }, [rows, filter, type, query]);

  const total = visible.reduce((s, r) => s + (r.taxComputed ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Returns</h1>
            <p className="page-sub mt-0.5">
              Every computed return, newest period first. <strong>Delta</strong> is what the
              state&rsquo;s official rate assesses minus what Avalara collected — a positive number
              is a margin hit.
            </p>
          </div>
          <div className="pagehead-actions">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
              className="w-[150px]"
            >
              <option value="all">All tax types</option>
              <option value="sales">Sales / use tax</option>
              <option value="excise">Vapor excise</option>
              <option value="pact">PACT Act</option>
            </select>
            <input
              type="text"
              placeholder="Search state or period…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-[220px]"
            />
          </div>
        </div>

        <nav className="tabs">
          {FILTERS.map((f) => {
            const count = rows.filter((r) => f.match(r) && (type === "all" || r.taxType === type)).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="tab"
                data-active={filter === f.key}
              >
                {f.label}
                <span className="tab-count" data-tone={f.tone && count > 0 ? "warn" : undefined}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head">
          {visible.length.toLocaleString()} return{visible.length === 1 ? "" : "s"}
          <span className="ml-auto text-[12px] font-normal text-[var(--muted)]">
            Tax due in view: <strong className="tnum text-[var(--ink)]">{fmtMoney(total)}</strong>
          </span>
        </div>
        <table className="qtable">
          <thead>
            <tr>
              <th>State</th>
              <th>Type</th>
              <th>Period</th>
              <th>Due</th>
              <th>Status</th>
              <th className="num">Taxable</th>
              <th className="num">Tax due</th>
              <th className="num">Collected</th>
              <th className="num">Delta</th>
              <th>Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const delta = r.delta ?? 0;
              return (
                // Only UNDER-collection is a margin hit. Over-collection is not
                // an alarm, so it must not read like one.
                <tr key={r.id} className={delta >= 0.01 ? "flagged" : ""}>
                  <td>
                    <Link
                      href={`/returns/${r.state}/${r.taxType}/${r.period}`}
                      className="font-semibold text-[var(--accent)]"
                    >
                      {r.state}
                    </Link>
                  </td>
                  <td className="text-[12px]">{r.taxType}</td>
                  <td className="text-[12px]">{r.period}</td>
                  <td className="whitespace-nowrap text-[12px]">{r.dueDate ?? "—"}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num">{r.taxable !== null ? fmtMoney(r.taxable) : "—"}</td>
                  <td className="num font-semibold">
                    {r.taxComputed !== null ? fmtMoney(r.taxComputed) : "—"}
                  </td>
                  <td className="num">{r.taxCollected !== null ? fmtMoney(r.taxCollected) : "—"}</td>
                  <td
                    className={`num ${
                      delta >= 0.01
                        ? "font-semibold text-[var(--danger)]"
                        : delta <= -0.01
                          ? "text-[var(--muted)]"
                          : ""
                    }`}
                    title={
                      delta >= 0.01
                        ? "Under-collected - this comes out of margin"
                        : delta <= -0.01
                          ? "Over-collected - remit what was collected"
                          : undefined
                    }
                  >
                    {r.delta !== null ? fmtMoney(delta) : "—"}
                  </td>
                  <td className="font-mono text-[11px]">{r.confirmationNumber ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="empty">
            {rows.length === 0 ? (
              <>
                <strong>Nothing computed yet.</strong>
                <span>
                  Upload an Avalara export, then use <em>Close month</em> to compute every state.
                </span>
              </>
            ) : (
              "Nothing matches this filter."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
