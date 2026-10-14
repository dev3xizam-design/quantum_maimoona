import { desc, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations, taxDocuments, taxRates } from "@/db/schema";
import { fmtMoney, num } from "@/lib/money";
import { DEFAULT_COST_ESTIMATE_RATIO, getTaxSetting } from "@/lib/tax/calculate";
import { saveCostRatio } from "@/app/actions/realtime-tax";
import { QuoteTester } from "./QuoteTester";

export const dynamic = "force-dynamic";

export default async function RealtimeTaxPage() {
  const [ratio, coverage, docs, totals, stores] = await Promise.all([
    getTaxSetting<number | null>("cost_estimate_ratio", DEFAULT_COST_ESTIMATE_RATIO),
    db
      .select({
        states: dsql<number>`count(distinct ${taxRates.state})::int`,
        zips: dsql<number>`count(distinct ${taxRates.state} || ${taxRates.zip5})::int`,
        loaded: dsql<string | null>`max(${taxRates.loadedAt})::text`,
      })
      .from(taxRates),
    db.select().from(taxDocuments).orderBy(desc(taxDocuments.committedAt)).limit(100),
    db
      .select({
        period: taxDocuments.period,
        orders: dsql<number>`count(*)::int`,
        sales: dsql<string>`sum(${taxDocuments.salesTax})::text`,
        excise: dsql<string>`sum(${taxDocuments.exciseTax})::text`,
        collected: dsql<string>`sum(${taxDocuments.collectedTax})::text`,
      })
      .from(taxDocuments)
      .where(eq(taxDocuments.status, "committed"))
      .groupBy(taxDocuments.period)
      .orderBy(desc(taxDocuments.period))
      .limit(6),
    db
      .select({ id: integrations.id, name: integrations.name })
      .from(integrations)
      .where(eq(integrations.provider, "medusa")),
  ]);
  const cov = coverage[0];

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="text-[13.5px] font-semibold">How it works</div>
        <p className="mt-1 text-[12.5px] text-[var(--muted)]">
          The store&apos;s checkout asks Quantum for sales tax (by ship-to address) and vapor excise (by
          product) on every cart. When an order <strong>ships</strong> it is committed here and joins the
          month&apos;s returns; when it is <strong>cancelled</strong> it is voided. Unshipped orders are never
          reported. Give a store its key on <a href="/config/stores" className="text-[var(--accent)]">Stores</a>.
        </p>
        <div className="mt-3 grid gap-3 text-[12.5px] sm:grid-cols-3">
          <div>
            <div className="field">Rate table</div>
            <div className="tnum">
              {cov?.zips ? `${cov.zips.toLocaleString()} ZIPs · ${cov.states} states` : "not loaded — run npm run db:rates"}
            </div>
            {cov?.loaded && <div className="text-[11px] text-[var(--muted)]">loaded {cov.loaded.slice(0, 16)}</div>}
          </div>
          <form action={saveCostRatio}>
            <label className="field">Estimated wholesale cost (% of list price)</label>
            <div className="flex gap-2">
              <input name="ratio" type="text" defaultValue={ratio === null ? "" : Math.round(ratio * 1000) / 10} className="w-24" />
              <button className="btn btn-sm" type="submit">Save</button>
            </div>
            <div className="mt-1 text-[11px] text-[var(--muted)]">
              Used only where a product has no cost in Quantum. Blank = never estimate (those lines charge
              no %-of-wholesale excise).
            </div>
          </form>
        </div>
      </section>

      <section className="panel p-4">
        <div className="mb-3 text-[13.5px] font-semibold">Try an address</div>
        <QuoteTester stores={stores} />
      </section>

      {totals.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="panel-head">Committed by month</div>
          <table className="qtable">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Orders</th>
                <th className="num">Sales tax</th>
                <th className="num">Excise</th>
                <th className="num">Collected</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => (
                <tr key={t.period}>
                  <td>{t.period}</td>
                  <td className="num">{t.orders}</td>
                  <td className="num">{fmtMoney(num(t.sales))}</td>
                  <td className="num">{fmtMoney(num(t.excise))}</td>
                  <td className="num">{fmtMoney(num(t.collected))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel overflow-hidden">
        <div className="panel-head">Orders (latest 100)</div>
        <div className="overflow-x-auto">
          <table className="qtable">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Shipped</th>
                <th>Ship to</th>
                <th className="num">Subtotal</th>
                <th className="num">Sales tax</th>
                <th className="num">Excise</th>
                <th className="num">Collected</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-[var(--muted)]">
                    No orders committed yet.
                  </td>
                </tr>
              )}
              {docs.map((d) => {
                const a = (d.address ?? {}) as Record<string, string | null>;
                const due = num(d.salesTax) + num(d.exciseTax);
                const off = d.collectedTax !== null && Math.abs(num(d.collectedTax) - due) >= 0.02;
                return (
                  <tr key={d.id}>
                    <td className="font-semibold">#{d.orderNumber ?? d.orderId}</td>
                    <td>
                      <span className={`badge ${d.status === "committed" ? "badge-filed" : "badge-no_activity"}`}>{d.status}</span>
                    </td>
                    <td>{d.documentDate}</td>
                    <td>
                      {a.city}, {d.state} {a.zip}
                    </td>
                    <td className="num">{fmtMoney(num(d.subtotal))}</td>
                    <td className="num">{fmtMoney(num(d.salesTax))}</td>
                    <td className="num">{fmtMoney(num(d.exciseTax))}</td>
                    <td className={`num ${off ? "text-[var(--danger,#b42318)] font-semibold" : ""}`}>
                      {d.collectedTax === null ? "—" : fmtMoney(num(d.collectedTax))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
