import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthSnapshot, statesFromSnapshot } from "@/lib/months";
import { getFiling } from "@/lib/calendar";
import { getAccount } from "@/lib/config";
import { computeFiling } from "@/lib/compute";
import { fmtMoney, fmtPct } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import { rateUnitLabel } from "@/lib/engine/excise";
import { salesFormFor } from "@/lib/excel/forms/sales";
import type { ExciseResult, PactResult, SalesResult } from "@/lib/engine/types";
import { stateName } from "@/lib/states";
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

function Section({ title, badge, actions, children }: { title: string; badge?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      <div className="panel-head">
        {title}
        {badge}
        {actions && <span className="ml-auto flex items-center gap-2">{actions}</span>}
      </div>
      {children}
    </section>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[16px] font-semibold tracking-tight">{stateName(state)}</h2>
        {account?.accountNumber && (
          <span className="text-[11.5px] text-[var(--muted)]">Acct {account.accountNumber}</span>
        )}
        {exciseAccount?.licenseNumber && (
          <span className="text-[11.5px] text-[var(--muted)]">
            License {exciseAccount.licenseNumber}
          </span>
        )}
      </div>

      {allWarnings.map((w, i) => (
        <div key={i} className="callout callout-warn">{w}</div>
      ))}

      <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          {s && summary.salesPeriod && (
            <Section
              title={`Sales / use tax · ${s.form ?? "return"} · ${s.periodLabel}`}
              badge={<span className="badge badge-ready">due {s.dueDate}</span>}
              actions={
                <a className="btn btn-sm btn-primary" href={`/api/worksheet/${state}/sales/${summary.salesPeriod}`}>
                  Worksheet
                </a>
              }
            >
              <div className="p-4">
                <Row label="Gross sales" value={fmtMoney(s.gross)} />
                <Row label="Exempt sales" value={fmtMoney(s.exempt)} />
                <Row label="Taxable sales" value={fmtMoney(s.taxable)} strong />
                <Row label="Tax due" value={fmtMoney(s.taxComputed)} strong note={`state rate ${fmtPct(s.stateRate)}`} />
                <Row label="Collected by Avalara" value={fmtMoney(s.taxCollected)} />
                <Row
                  label={s.delta >= 0.01 ? "Under-collected (margin hit)" : s.delta <= -0.01 ? "Over-collected" : "Delta"}
                  value={fmtMoney(s.delta)}
                  tone={s.delta >= 0.01 ? "warn" : undefined}
                />
                <div className={`callout mt-3 ${s.reconciles ? "callout-ok" : "callout-warn"}`}>
                  {s.reconciles
                    ? "Taxable + Exempt = Gross. Reconciled."
                    : `Reconciliation FAILED — off by ${s.reconcileDiff}. Do not file.`}
                </div>
              </div>

              {s.allocation !== "flat" && s.byCounty.some((l) => l.gross !== 0 || l.tax !== 0) && (
                <table className="qtable">
                  <thead>
                    <tr>
                      <th>Jurisdiction</th>
                      <th>Code</th>
                      <th>Paired</th>
                      <th className="num">Taxable</th>
                      <th className="num">Rate</th>
                      <th className="num">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.byCounty
                      .filter((l) => l.gross !== 0 || l.tax !== 0)
                      .map((l) => (
                        <tr key={l.name} className={l.code ? "" : "flagged"}>
                          <td>{l.name}</td>
                          <td className={l.code ? "font-mono text-[11.5px]" : "text-[var(--danger)]"}>
                            {l.code ?? "missing"}
                          </td>
                          <td className="font-mono text-[11.5px]">{l.pairedCode ?? ""}</td>
                          <td className="num">{fmtMoney(l.taxable)}</td>
                          <td className="num">{fmtPct(l.rate)}</td>
                          <td className="num">{fmtMoney(l.tax)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              <div className="border-t border-[var(--line)] p-4">
                <div className="field mb-2">How to file it</div>
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
            </Section>
          )}

          {e && summary.excisePeriod && (
            <Section
              title={`Vapor excise · ${e.form ?? "return"} · structure ${e.structure}`}
              badge={
                <>
                  <span className="badge badge-ready">due {e.dueDate}</span>
                  <span className={`badge ${e.basis === "RECEIPTS" ? "badge-not_started" : "badge-no_activity"}`}>
                    {e.basis} basis
                  </span>
                </>
              }
              actions={
                <a className="btn btn-sm" href={`/api/worksheet/${state}/excise/${summary.excisePeriod}`}>
                  Worksheet
                </a>
              }
            >
              <table className="qtable">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Basis</th>
                    <th className="num">Amount</th>
                    <th>Rate</th>
                    <th className="num">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {e.components.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td>{c.basisLabel}</td>
                      <td className="num">{c.basisAmount.toLocaleString()}</td>
                      <td className="text-[12px]">
                        {c.rateUnit.startsWith("pct") ? fmtPct(c.rate) : fmtMoney(c.rate)}{" "}
                        <span className="text-[var(--muted)]">{rateUnitLabel(c.rateUnit)}</span>
                      </td>
                      <td className="num font-semibold">{fmtMoney(c.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-[var(--line)] p-4">
                <Row label="Total excise due" value={fmtMoney(e.taxComputed)} strong />
              </div>
            </Section>
          )}

          {pa && pa.shipmentCount > 0 && (
            <Section
              title="PACT Act · ENDS report"
              badge={<span className="badge badge-overdue">due {pa.dueDate}</span>}
              actions={
                <a className="btn btn-sm" href={`/api/worksheet/${state}/pact/${month}`}>
                  Worksheet
                </a>
              }
            >
              <div className="p-4">
                <Row label="Shipment lines to report" value={pa.shipmentCount.toLocaleString()} strong />
                <Row label="Total quantity" value={pa.totalQuantity.toLocaleString()} />
                <Row
                  label="Data source"
                  value={pa.source === "shipments" ? "Shipment feed" : "Avalara export (incomplete)"}
                />
                <p className="mt-3 text-[11.5px] text-[var(--muted)]">
                  Customer names and addresses are in the downloaded worksheet only — never rendered
                  here.
                </p>
              </div>
            </Section>
          )}
        </div>

        <aside className="space-y-4">
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
          <div className="help">
            Sales tax, excise and PACT are <strong>three separate returns</strong> on different
            accounts with different due dates. Filing one does not file the others.{" "}
            <Link className="font-semibold text-[var(--accent)]" href="/guide#excise">
              More on that
            </Link>
            .
          </div>
        </aside>
      </div>
    </div>
  );
}
