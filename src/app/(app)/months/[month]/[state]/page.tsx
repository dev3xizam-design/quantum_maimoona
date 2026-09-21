import Link from "next/link";
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

  const totalDue = (s?.taxComputed ?? 0) + (e?.taxComputed ?? 0);
  const { blocking } = groupIssues(allWarnings);

  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <div className="hero">
          <div className="hero-label">{stateName(state)} · total tax due</div>
          <div className="hero-value">{fmtMoney(totalDue)}</div>
          <div className="hero-sub">
            {s && `sales ${fmtMoney(s.taxComputed)}`}
            {e && ` · excise ${fmtMoney(e.taxComputed)}`}
            {pa && pa.shipmentCount > 0 && ` · ${pa.shipmentCount} PACT lines`}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {s && (
            <div className="tile">
              <span className="tile-icon" style={{ background: "var(--q-100)", color: "var(--q-700)" }}>
                {iconDoc}
              </span>
              <div>
                <div className="tile-title">{fmtMoney(s.taxComputed)}</div>
                <div className="tile-sub">Sales tax · due {s.dueDate}</div>
              </div>
            </div>
          )}
          {e && (
            <div className="tile">
              <span className="tile-icon" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
                {iconDrop}
              </span>
              <div>
                <div className="tile-title">{fmtMoney(e.taxComputed)}</div>
                <div className="tile-sub">Vapor excise · due {e.dueDate}</div>
              </div>
            </div>
          )}
          {pa && pa.shipmentCount > 0 && (
            <div className="tile">
              <span className="tile-icon" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
                {iconTruck}
              </span>
              <div>
                <div className="tile-title">{pa.shipmentCount.toLocaleString()}</div>
                <div className="tile-sub">PACT lines · due {pa.dueDate}</div>
              </div>
            </div>
          )}
        </div>

        {blocking.length > 0 && (
          <div className="callout callout-warn mt-4">
            <strong>{blocking[0].title}.</strong> Do not file this state until it is resolved —
            details at the bottom of the page.
          </div>
        )}
      </div>

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

              {s.allocation !== "flat" && allocationLines(s).length > 0 && (
                <table className="qtable">
                  <caption className="px-4 pt-3 text-left text-[12px] font-semibold text-[var(--muted)]">
                    {allocationLabel(s)}
                  </caption>
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
                    {allocationLines(s).map((l) => (
                        <tr key={`${l.type}|${l.name}`} className={l.code ? "" : "flagged"}>
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

const iconDrop = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3s6 6.4 6 10a6 6 0 0 1-12 0c0-3.6 6-10 6-10z" />
  </svg>
);

const iconTruck = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" />
  </svg>
);
