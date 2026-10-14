"use client";

import { useActionState } from "react";
import { testQuote, type TestQuoteState } from "@/app/actions/realtime-tax";

const money = (n: number) => `$${n.toFixed(2)}`;
const pct = (r: number) => `${(r * 100).toFixed(4).replace(/\.?0+$/, "")}%`;

export function QuoteTester({ stores }: { stores: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(testQuote, null as TestQuoteState);
  const q = state?.quote;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field">Store</label>
            <select name="store" defaultValue={stores[0]?.id}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field">Street</label>
            <input name="line1" defaultValue="233 S Wacker Dr" />
          </div>
          <div>
            <label className="field">City</label>
            <input name="city" defaultValue="Chicago" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field">State</label>
              <input name="state" defaultValue="IL" />
            </div>
            <div>
              <label className="field">ZIP</label>
              <input name="zip" defaultValue="60606" />
            </div>
          </div>
          <div className="col-span-2">
            <label className="field">Product title</label>
            <input name="title" defaultValue="Menthol Tyson 2.0 Iron Mike 15,000 Puff Disposable Vape" />
          </div>
          <div>
            <label className="field">Variant</label>
            <input name="variant" defaultValue="5 Pack" />
          </div>
          <div>
            <label className="field">SKU (optional)</label>
            <input name="sku" />
          </div>
          <div className="col-span-2">
            <label className="field">Description (optional — mL is read from it)</label>
            <input name="description" placeholder="Preloaded E-Liquid Capacity: 15mL" />
          </div>
          <div>
            <label className="field">Unit price</label>
            <input name="price" defaultValue="59.99" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field">Qty</label>
              <input name="quantity" defaultValue="1" />
            </div>
            <div>
              <label className="field">Shipping</label>
              <input name="shipping" defaultValue="7.99" />
            </div>
          </div>
        </div>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Calculating…" : "Calculate"}
        </button>
        {state && !state.ok && <div className="callout callout-warn">{state.message}</div>}
      </form>

      {q && (
        <div className="space-y-3 text-[12.5px]">
          <div className="text-[var(--muted)]">
            {q.address.city ?? "—"}, {q.address.county ? `${q.address.county} County, ` : ""}
            {q.address.state} {q.address.zip}
            {q.address.rate_source ? ` · ${q.address.rate_source} (${q.address.matched_by})` : " · no local rate on file"}
          </div>
          <table className="qtable">
            <tbody>
              {q.lines[0]?.sales_tax.jurisdictions.map((j, i) => (
                <tr key={i}>
                  <td>{j.type}</td>
                  <td>{j.name}</td>
                  <td className="num">{pct(j.rate)}</td>
                  <td className="num">{money(j.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="font-semibold">Sales tax (goods + shipping)</td>
                <td className="num font-semibold">{money(q.totals.sales_tax)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="font-semibold">
                  {q.lines[0]?.excise_tax
                    ? `${q.lines[0].excise_tax.label} — ${q.lines[0].excise_tax.basis} ${q.lines[0].excise_tax.basis_amount}`
                    : "Excise tax"}
                </td>
                <td className="num font-semibold">{money(q.totals.excise_tax)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="font-semibold">Total tax</td>
                <td className="num font-semibold">{money(q.totals.total_tax)}</td>
              </tr>
            </tbody>
          </table>
          <div className="text-[11.5px] text-[var(--muted)]">
            mL {q.lines[0]?.facts.ml_per_unit ?? "unknown"} ({q.lines[0]?.facts.sources.ml}) · cost{" "}
            {q.lines[0]?.facts.cost_per_unit ?? "unknown"} ({q.lines[0]?.facts.sources.cost}) ·{" "}
            {q.lines[0]?.facts.system_type ?? "open/closed unknown"} ({q.lines[0]?.facts.sources.system})
          </div>
          {q.warnings.map((w, i) => (
            <div key={i} className="callout callout-warn">
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
