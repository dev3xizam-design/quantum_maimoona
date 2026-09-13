import Link from "next/link";
import { notFound } from "next/navigation";
import { getFiling } from "@/lib/calendar";
import { getAccount } from "@/lib/config";
import { computeFiling } from "@/lib/compute";
import { fmtMoney, fmtPct } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import { rateUnitLabel } from "@/lib/engine/excise";
import type { AnyResult } from "@/lib/engine/types";
import { StatusBadge } from "@/components/StatusBadge";
import { FiledForm } from "./FiledForm";
import { RecomputeButton } from "./RecomputeButton";

export const dynamic = "force-dynamic";

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "warn" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2 last:border-0">
      <span className={`text-[13px] ${strong ? "font-semibold" : "text-[var(--muted)]"}`}>{label}</span>
      <span
        className={`tnum text-[13px] ${strong ? "text-[15px] font-semibold" : ""} ${
          tone === "warn" ? "text-[var(--danger)] font-semibold" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default async function ReturnPage({
  params,
}: {
  params: Promise<{ state: string; taxType: string; period: string }>;
}) {
  const p = await params;
  const state = p.state.toUpperCase();
  const { taxType, period } = p;
  if (!["sales", "excise", "pact"].includes(taxType)) notFound();

  let result: AnyResult | null = null;
  let error: string | null = null;
  try {
    result = await computeFiling(state, taxType, period);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const [filing, account] = await Promise.all([
    getFiling(state, taxType, period),
    getAccount(state, taxType),
  ]);

  if (error || !result) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-[12px] text-[var(--accent)]">&larr; Calendar</Link>
        <div className="callout callout-warn">
          <strong>Cannot compute {state} {taxType} for {period}.</strong>
          <div className="mt-1">{error}</div>
        </div>
      </div>
    );
  }

  const status = filing?.status === "filed" ? "filed" : filing ? "ready" : "not_started";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <Link href="/" className="text-[12px] text-[var(--accent)]">&larr; Calendar</Link>
          <h1 className="mt-1 text-[18px] font-semibold tracking-tight">
            {state} · {taxType === "pact" ? "PACT Act" : taxType === "excise" ? "Vapor excise" : "Sales / use tax"} · {periodLabel(period)}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted)]">
            <StatusBadge status={status} />
            <span>Due {result.dueDate}</span>
            {result.form && <span>· {result.form}</span>}
            {result.portal && (
              <a className="text-[var(--accent)]" href={result.portal} target="_blank" rel="noreferrer">
                {result.portal.replace(/^https?:\/\//, "")}
              </a>
            )}
            {account?.accountNumber && <span>· Acct {account.accountNumber}</span>}
            {account?.licenseNumber && <span>· License {account.licenseNumber}</span>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <RecomputeButton state={state} taxType={taxType} period={period} />
          <a className="btn btn-primary" href={`/api/worksheet/${state}/${taxType}/${period}`}>
            Download worksheet
          </a>
        </div>
      </div>

      {result.warnings.map((w, i) => (
        <div key={i} className="callout callout-warn">{w}</div>
      ))}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {result.taxType === "sales" && (
            <>
              <section className="panel p-4">
                <h2 className="mb-2 text-[13px] font-semibold">Return figures</h2>
                <Row label="Gross sales" value={fmtMoney(result.gross)} />
                <Row label="Exempt sales" value={fmtMoney(result.exempt)} />
                <Row label="Taxable sales" value={fmtMoney(result.taxable)} strong />
                <Row label={`State rate (${fmtPct(result.stateRate)})`} value={result.rounding === "whole_dollar" ? "whole dollars" : "cents"} />
                <Row label="Tax due" value={fmtMoney(result.taxComputed)} strong />
                <Row label="Tax collected by Avalara" value={fmtMoney(result.taxCollected)} />
                <Row
                  label={
                    result.delta >= 0.01
                      ? "Under-collected (comes out of margin)"
                      : result.delta <= -0.01
                        ? "Over-collected"
                        : "Delta (computed − collected)"
                  }
                  value={fmtMoney(result.delta)}
                  tone={result.delta >= 0.01 ? "warn" : undefined}
                />
              </section>

              {(result.byCounty.length > 1 || result.allocation !== "flat") && (
                <section className="panel overflow-hidden">
                  <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">
                    Jurisdiction allocation
                  </h2>
                  <table className="grid">
                    <thead>
                      <tr>
                        <th>Jurisdiction</th>
                        <th>Code</th>
                        <th>Paired</th>
                        <th className="num">Gross</th>
                        <th className="num">Exempt</th>
                        <th className="num">Taxable</th>
                        <th className="num">Rate</th>
                        <th className="num">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.byCounty
                        .filter((l) => l.gross !== 0 || l.tax !== 0)
                        .map((l) => (
                          <tr key={l.name}>
                            <td>{l.name}</td>
                            <td className={l.code ? "font-mono text-[12px]" : "text-[var(--danger)]"}>
                              {l.code ?? "missing"}
                            </td>
                            <td className="font-mono text-[12px]">{l.pairedCode ?? ""}</td>
                            <td className="num">{fmtMoney(l.gross)}</td>
                            <td className="num">{fmtMoney(l.exempt)}</td>
                            <td className="num">{fmtMoney(l.taxable)}</td>
                            <td className="num">{fmtPct(l.rate)}</td>
                            <td className="num">{fmtMoney(l.tax)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          )}

          {result.taxType === "excise" && (
            <>
              <section className="panel p-4">
                <h2 className="mb-2 text-[13px] font-semibold">
                  Structure {result.structure} · {result.basis === "RECEIPTS" ? "receipts basis (purchased)" : "sales basis (sold)"}
                </h2>
                <Row label="Total mL" value={result.totalMl.toLocaleString()} />
                <Row label="Total units" value={result.totalUnits.toLocaleString()} />
                <Row label="Total cartridges" value={result.totalCartridges.toLocaleString()} />
                <Row label="Wholesale cost" value={fmtMoney(result.wholesaleCost)} />
                <Row label="Retail price" value={fmtMoney(result.retailPrice)} />
                <Row label="Excise tax due" value={fmtMoney(result.taxComputed)} strong />
              </section>

              {(result.dataGaps.cost.length > 0 ||
                result.dataGaps.ml.length > 0 ||
                result.dataGaps.systemType.length > 0) && (
                <section className="panel overflow-hidden">
                  <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">
                    SKUs blocking this return
                  </h2>
                  <table className="grid">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product</th>
                        <th>Missing</th>
                        <th className="num">Units</th>
                        <th className="num">Retail this period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...result.dataGaps.cost.map((g) => ({ ...g, missing: "wholesale cost" })),
                        ...result.dataGaps.ml.map((g) => ({ ...g, missing: "mL per unit" })),
                        ...result.dataGaps.systemType.map((g) => ({ ...g, missing: "open/closed" })),
                      ]
                        .sort((a, b) => b.retail - a.retail)
                        .slice(0, 25)
                        .map((g, i) => (
                          <tr key={`${g.sku}-${g.missing}-${i}`}>
                            <td className="font-mono text-[11px] font-semibold">{g.sku}</td>
                            <td className="max-w-[280px] truncate">{g.description ?? "—"}</td>
                            <td className="text-[var(--danger)]">{g.missing}</td>
                            <td className="num">{g.units.toLocaleString()}</td>
                            <td className="num">{fmtMoney(g.retail)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div className="border-t border-[var(--line)] px-4 py-3">
                    <Link href="/products" className="btn btn-sm btn-primary">
                      Fill these in on Products
                    </Link>
                  </div>
                </section>
              )}

              <section className="panel overflow-hidden">
                <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">
                  Calculation
                </h2>
                <table className="grid">
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
                    {result.components.map((c) => (
                      <tr key={c.label}>
                        <td>{c.label}</td>
                        <td>{c.basisLabel}</td>
                        <td className="num">{c.basisAmount.toLocaleString()}</td>
                        <td>
                          {c.rateUnit.startsWith("pct") ? fmtPct(c.rate) : fmtMoney(c.rate)}{" "}
                          <span className="text-[var(--muted)]">{rateUnitLabel(c.rateUnit)}</span>
                        </td>
                        <td className="num">{fmtMoney(c.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {result.taxType === "pact" && (
            <section className="panel p-4">
              <h2 className="mb-2 text-[13px] font-semibold">Shipment report</h2>
              <Row label="Shipment lines" value={String(result.shipmentCount)} strong />
              <Row label="Total quantity" value={result.totalQuantity.toLocaleString()} />
              <Row label="Total mL" value={result.totalMl.toLocaleString()} />
              <Row
                label="Data source"
                value={result.source === "shipments" ? "Shipment feed" : "Avalara export (incomplete)"}
              />
              <p className="mt-3 text-[12px] text-[var(--muted)]">
                Customer names and addresses are in the downloaded worksheet only - they are not
                rendered here.
              </p>
            </section>
          )}

          {result.notes.length > 0 && (
            <section className="panel p-4">
              <h2 className="mb-2 text-[13px] font-semibold">Notes</h2>
              <ul className="space-y-1.5 text-[12px] text-[var(--muted)]">
                {result.notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <FiledForm
            state={state}
            taxType={taxType}
            period={period}
            filed={filing?.status === "filed"}
            confirmationNumber={filing?.confirmationNumber ?? ""}
            filedAt={filing?.filedAt ? filing.filedAt.toISOString().slice(0, 10) : null}
            filedBy={filing?.filedBy ?? null}
            suggestedAmount={result.taxType === "pact" ? 0 : result.taxComputed}
          />

          {result.taxType === "sales" && (
            <section className="panel p-4">
              <h2 className="mb-2 text-[13px] font-semibold">Reconciliation</h2>
              <Row label="Avalara rows read" value={String(result.rowCount)} />
              <Row label="Unique lines (deduped)" value={String(result.lineCount)} />
              <Row label="Documents" value={String(result.documentCount)} />
              <Row label="Return lines netted" value={String(result.returnLineCount)} />
              <div
                className={`mt-3 callout ${result.reconciles ? "callout-ok" : "callout-warn"}`}
              >
                {result.reconciles
                  ? "Taxable + Exempt = Gross. Reconciled."
                  : `Reconciliation FAILED - off by ${result.reconcileDiff}. Do not file.`}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
