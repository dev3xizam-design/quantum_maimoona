"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { runWholeMonth } from "@/app/actions/period";
import { fmtMoney } from "@/lib/money";
import { periodLabel, recentMonths } from "@/lib/periods";

type StateRow = {
  state: string;
  gross: number;
  taxable: number;
  salesTax: number;
  collected: number;
  delta: number;
  excise: number;
  pact: number;
  salesPeriod: string | null;
  dueDate: string | null;
  reconciles: boolean;
  warnings: number;
};

export function MonthClose({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof runWholeMonth>> | null>(null);

  const months = recentMonths(24);
  if (!months.includes(month)) months.unshift(month);

  const run = () =>
    start(async () => {
      setResult(null);
      setResult(await runWholeMonth(month));
    });

  const totals = result?.ok ? result.totals : null;
  const states: StateRow[] = result?.ok ? (result.states as StateRow[]) : [];

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="field" htmlFor="month">Month to close</label>
            <select id="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[200px]">
              {months.map((m) => (
                <option key={m} value={m}>{periodLabel(m)}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={run} disabled={pending}>
            {pending ? "Computing every state…" : "1 · Compute & store the whole month"}
          </button>
        </div>

        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
            2 · Download
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn" href={`/api/period-workbook/${month}`}>
              All states — one workbook, a tab per state
            </a>
            <a className="btn" href={`/api/period-bundle/${month}`}>
              Every state as its own workbook (ZIP)
            </a>
            <a className="btn btn-ghost" href={`/api/period-workbook/${month}?all=1`}>
              Include states with no sales
            </a>
          </div>
          <div className="help mt-3">
            <strong>Which one?</strong> The single workbook is for reviewing the month — Summary,
            Action Items, then a tab per state with that state&rsquo;s form lines in portal order.
            The ZIP is for actually filing: one folder per state, and inside it each return as its
            own workbook with the full five-tab set (Filing Sheet, Return, Jurisdiction Detail,
            Reconciliation, Notes), plus a READ ME with the running order. Either download also
            computes and stores the month, so you can go straight to the ZIP.
          </div>
        </div>
      </div>

      {result && !result.ok && (
        <div className="callout callout-warn">
          <strong>Could not compute {periodLabel(month)}.</strong>
          <div className="mt-1 font-mono text-[11px]">{result.error}</div>
        </div>
      )}

      {totals && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: "States with activity", value: `${totals.statesWithActivity} / ${totals.states}` },
              { label: "Gross sales", value: fmtMoney(totals.gross) },
              { label: "Sales tax due", value: fmtMoney(totals.salesTax) },
              { label: "Vapor excise due", value: fmtMoney(totals.exciseTax) },
              { label: "Total tax due", value: fmtMoney(totals.totalTax), strong: true },
            ].map((t) => (
              <div key={t.label} className="panel px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {t.label}
                </div>
                <div className={`mt-1 tnum ${t.strong ? "text-[22px] font-bold text-[var(--accent)]" : "text-[20px] font-semibold"}`}>
                  {t.value}
                </div>
              </div>
            ))}
          </div>

          {totals.reconcileFailures.length > 0 && (
            <div className="callout callout-warn">
              <strong>Reconciliation failed in {totals.reconcileFailures.join(", ")}.</strong> Taxable
              + Exempt does not equal Gross in those states — do not file them until the upload is
              corrected.
            </div>
          )}
          {Math.abs(totals.delta) >= 0.01 && (
            <div className="callout callout-warn">
              Across every state, the official rates assess{" "}
              <strong>{fmtMoney(totals.delta)}</strong> more than Avalara collected. That difference
              comes out of margin — check the Avalara rate configuration for the states flagged
              below.
            </div>
          )}
          {totals.warnings > 0 && (
            <div className="callout callout-note">
              {totals.warnings} item(s) need attention before filing. Every one is listed on the
              <strong> Action Items</strong> tab of the workbook, and on each state&rsquo;s own tab.
            </div>
          )}

          <div className="panel overflow-x-auto">
            <table className="grid">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Period</th>
                  <th className="num">Gross</th>
                  <th className="num">Taxable</th>
                  <th className="num">Sales tax</th>
                  <th className="num">Collected</th>
                  <th className="num">Delta</th>
                  <th className="num">Excise</th>
                  <th className="num">PACT</th>
                  <th>Due</th>
                  <th className="num">Flags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => (
                  <tr key={s.state}>
                    <td className="font-semibold">{s.state}</td>
                    <td className="text-[11px]">{s.salesPeriod ?? "—"}</td>
                    <td className="num">{fmtMoney(s.gross)}</td>
                    <td className="num">{fmtMoney(s.taxable)}</td>
                    <td className="num font-semibold">{fmtMoney(s.salesTax)}</td>
                    <td className="num">{fmtMoney(s.collected)}</td>
                    <td className={`num ${Math.abs(s.delta) >= 0.01 ? "font-semibold text-[var(--danger)]" : ""}`}>
                      {fmtMoney(s.delta)}
                    </td>
                    <td className="num">{s.excise ? fmtMoney(s.excise) : "—"}</td>
                    <td className="num">{s.pact || "—"}</td>
                    <td className="text-[11px]">{s.dueDate ?? "—"}</td>
                    <td className="num">
                      {!s.reconciles && <span className="badge badge-overdue">recon</span>}
                      {s.warnings > 0 && <span className="badge badge-not_started">{s.warnings}</span>}
                    </td>
                    <td>
                      {s.salesPeriod && (
                        <Link
                          href={`/returns/${s.state}/sales/${s.salesPeriod}`}
                          className="text-[var(--accent)]"
                        >
                          open
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {states.length === 0 && (
              <div className="p-6 text-center text-[13px] text-[var(--muted)]">
                No state had transactions in {periodLabel(month)}. Upload the export first.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
