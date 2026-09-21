import { notFound } from "next/navigation";
import { getMonthSnapshot, statesFromSnapshot } from "@/lib/months";
import { getFiling } from "@/lib/calendar";
import { getAccount } from "@/lib/config";
import { computeFiling } from "@/lib/compute";
import { fmtMoney, fmtPct } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import { rateUnitLabel } from "@/lib/engine/excise";
import { allocationLabel, allocationLines } from "@/lib/engine/sales";
import { salesFormFor } from "@/lib/excel/forms/sales";
import type { ExciseResult, PactResult, SalesResult } from "@/lib/engine/types";
import { stateName } from "@/lib/states";
import { IssueList } from "@/components/IssueList";
import { groupIssues } from "@/lib/issues";
import { FiledForm } from "../../../returns/[state]/[taxType]/[period]/FiledForm";

export const dynamic = "force-dynamic";

function Row({ label, value, strong, tone, note }: { label: string; value: string; strong?: boolean; tone?: "warn"; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2 last:border-0">
      <span className={`text-[13px] ${strong ? "font-semibold" : "text-[var(--muted)]"}`}>
        {label}
        {note && <span className="ml-2 text-[11px] text-[var(--muted)]">{note}</span>}
      </span>
      <span
        className={`tnum text-[13px] ${strong ? "text-[15px] font-semibold" : ""} ${
          tone === "warn" ? "font-semibold text-[var(--danger)]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default async function StateMonthPage({
  params,
}: {
  params: Promise<{ month: string; state: string }>;
}) {
  const p = await params;
  const month = p.month;
  const state = p.state.toUpperCase();

  const snapshot = await getMonthSnapshot(month);
  if (!snapshot) notFound();
  const summary = statesFromSnapshot(snapshot).find((s) => s.state === state);
  if (!summary) notFound();

  if (!summary.hasActivity) {
    return (
      <div className="panel">
        <div className="empty">
          <strong>
            {stateName(state)} had no transactions in {periodLabel(month)}.
          </strong>
          <span>Nothing to file for this state this month.</span>
        </div>
      </div>
    );
  }

  const [sales, excise, pact] = await Promise.all([
    summary.salesPeriod
      ? computeFiling(state, "sales", summary.salesPeriod).catch(() => null)
      : Promise.resolve(null),
    summary.excisePeriod
      ? computeFiling(state, "excise", summary.excisePeriod).catch(() => null)
      : Promise.resolve(null),
    computeFiling(state, "pact", month).catch(() => null),
  ]);

  const [account, exciseAccount, salesFiling, exciseFiling] = await Promise.all([
    getAccount(state, "sales"),
    getAccount(state, "excise"),
    summary.salesPeriod ? getFiling(state, "sales", summary.salesPeriod) : Promise.resolve(null),
    summary.excisePeriod ? getFiling(state, "excise", summary.excisePeriod) : Promise.resolve(null),
  ]);

  const s = sales as SalesResult | null;
  const e = excise as ExciseResult | null;
  const pa = pact as PactResult | null;
  const allWarnings = [
    ...(s?.warnings ?? []),
    ...(e?.warnings ?? []),
    ...(pa?.warnings ?? []),
  ];

  const totalDue = (s?.taxComputed ?? 0) + (e?.taxComputed ?? 0);
  const { blocking } = groupIssues(allWarnings);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex items-start gap-3">
          <span className="tile-icon" style={{ background: "var(--q-100)", color: "var(--q-700)" }}>
            {iconDoc}
          </span>
          <div>
            <div className="text-[15px] font-semibold">{stateName(state)}</div>
            <div className="text-[11.5px] text-[var(--muted)]">
              {account?.accountNumber ? `Acct ${account.accountNumber}` : "State tax filing"}
            </div>
          </div>
          <span className="badge badge-ready ml-auto">{summary.salesPeriod ?? month}</span>
        </div>

        <div className="mt-4">
          <div className="text-[30px] font-bold tracking-tight tnum">{fmtMoney(totalDue)}</div>
          <div className="text-[12px] text-[var(--muted)]">
            total due
            {s && ` · sales ${fmtMoney(s.taxComputed)}`}
            {e && ` · excise ${fmtMoney(e.taxComputed)}`}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {s && (
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-[15px] font-semibold tnum">{fmtMoney(s.taxComputed)}</div>
              <div className="text-[11px] text-[var(--muted)]">Sales tax</div>
              <div className="text-[11px] text-[var(--muted)]">Due {s.dueDate}</div>
            </div>
          )}
          {e && (
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-[15px] font-semibold tnum">{fmtMoney(e.taxComputed)}</div>
              <div className="text-[11px] text-[var(--muted)]">Vapor excise</div>
              <div className="text-[11px] text-[var(--muted)]">Due {e.dueDate}</div>
            </div>
          )}
          {pa && pa.shipmentCount > 0 && (
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-[15px] font-semibold tnum">{pa.shipmentCount.toLocaleString()}</div>
              <div className="text-[11px] text-[var(--muted)]">PACT lines</div>
              <div className="text-[11px] text-[var(--muted)]">Due {pa.dueDate}</div>
            </div>
          )}
        </div>

        {blocking.length > 0 && (
          <div className="callout callout-warn mt-4">
            <strong>{blocking[0].title}.</strong> Do not file this state yet — see below.
          </div>
        )}
      </section>

      {s && summary.salesPeriod && (
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <span className="truncate">Sales / use tax · {s.form ?? "return"}</span>
            <a
              className="btn btn-sm btn-primary ml-auto"
              href={`/api/worksheet/${state}/sales/${summary.salesPeriod}`}
            >
              Worksheet
            </a>
          </div>
          <div className="p-4">
            <Row label="Gross sales" value={fmtMoney(s.gross)} />
            <Row label="Exempt sales" value={fmtMoney(s.exempt)} />
            <Row label="Taxable sales" value={fmtMoney(s.taxable)} strong />
            <Row label={`Tax due · ${fmtPct(s.stateRate)}`} value={fmtMoney(s.taxComputed)} strong />
            <Row label="Collected by Avalara" value={fmtMoney(s.taxCollected)} />
            {s.delta >= 0.01 && (
              <Row label="Under-collected" value={fmtMoney(s.delta)} tone="warn" />
            )}
            <div className={`callout mt-3 ${s.reconciles ? "callout-ok" : "callout-warn"}`}>
              {s.reconciles
                ? "Taxable + Exempt = Gross. Reconciled."
                : `Reconciliation FAILED — off by ${s.reconcileDiff}.`}
            </div>
          </div>

          {s.allocation !== "flat" && s.byCounty.some((l) => l.gross !== 0 || l.tax !== 0) && (
            <details className="border-t border-[var(--line)]">
              <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-[var(--muted)] hover:bg-[#f8faf9]">
                Jurisdiction breakdown
              </summary>
              <table className="qtable">
                <thead>
                  <tr>
                    <th>Jurisdiction</th>
                    <th>Code</th>
                    <th className="num">Taxable</th>
                    <th className="num">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {s.byCounty
                    .filter((l) => l.gross !== 0 || l.tax !== 0)
                    .map((l) => (
                      <tr key={l.name} className={l.code ? "" : "flagged"}>
                        <td className="max-w-[130px] truncate">{l.name}</td>
                        <td className={l.code ? "font-mono text-[11px]" : "text-[var(--danger)]"}>
                          {l.code ?? "missing"}
                        </td>
                        <td className="num">{fmtMoney(l.taxable)}</td>
                        <td className="num">{fmtMoney(l.tax)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          )}

          <details className="border-t border-[var(--line)]">
            <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-[var(--muted)] hover:bg-[#f8faf9]">
              How to file it
            </summary>
            <div className="p-4">
              <ol className="steps">
                {salesFormFor(state)
                  .steps(s, {
                    company: "Maximum Vapor Inc.",
                    fein: "82-1098441",
                    accountNumber: account?.accountNumber ?? null,
                    licenseNumber: account?.licenseNumber ?? null,
                    loginField: null,
                    accountNotes: null,
                  })
                  .map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
              </ol>
            </div>
          </details>
        </section>
      )}

      {e && summary.excisePeriod && (
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <span className="truncate">Vapor excise · structure {e.structure}</span>
            <a
              className="btn btn-sm ml-auto"
              href={`/api/worksheet/${state}/excise/${summary.excisePeriod}`}
            >
              Worksheet
            </a>
          </div>
          <div className="p-4">
            {e.components.map((c) => (
              <Row
                key={c.label}
                label={`${c.label} · ${rateUnitLabel(c.rateUnit)}`}
                value={fmtMoney(c.tax)}
              />
            ))}
            <Row label="Total excise due" value={fmtMoney(e.taxComputed)} strong />
            <div className="mt-2 text-[11.5px] text-[var(--muted)]">
              {e.basis === "RECEIPTS"
                ? "Receipts basis — taxes what you purchased, not what you sold."
                : "Sales basis — taxes what you sold this period."}
            </div>
          </div>
        </section>
      )}

      {s && summary.salesPeriod && (
        <FiledForm
          state={state}
          taxType="sales"
          period={summary.salesPeriod}
          filed={salesFiling?.status === "filed"}
          confirmationNumber={salesFiling?.confirmationNumber ?? ""}
          filedAt={salesFiling?.filedAt ? salesFiling.filedAt.toISOString().slice(0, 10) : null}
          filedBy={salesFiling?.filedBy ?? null}
          suggestedAmount={s.taxComputed}
        />
      )}
      {e && summary.excisePeriod && (
        <FiledForm
          state={state}
          taxType="excise"
          period={summary.excisePeriod}
          filed={exciseFiling?.status === "filed"}
          confirmationNumber={exciseFiling?.confirmationNumber ?? ""}
          filedAt={exciseFiling?.filedAt ? exciseFiling.filedAt.toISOString().slice(0, 10) : null}
          filedBy={exciseFiling?.filedBy ?? null}
          suggestedAmount={e.taxComputed}
        />
      )}

      <IssueList warnings={allWarnings} />
    </div>
  );
}

const iconDoc = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5M8 13h8M8 17h5" />
  </svg>
);
