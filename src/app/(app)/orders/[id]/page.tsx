import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations, storeOrders, taxDocuments } from "@/db/schema";
import { fmtMoney, num } from "@/lib/money";
import type { QuoteLine } from "@/lib/tax/quote";
import { getTaxSetting } from "@/lib/tax/calculate";
import { DEFAULT_PULL_START } from "@/lib/tax/order-pull";

export const dynamic = "force-dynamic";

type Addr = Record<string, string | null | undefined> | null;

const when = (d: Date | null) =>
  d
    ? d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET"
    : "—";
const pct = (r: number) => `${Number(r.toFixed(4))}%`;

function Address({ title, a }: { title: string; a: Addr }) {
  if (!a) return null;
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const cityLine = [a.city, [a.province?.replace(/^us-/i, "").toUpperCase(), a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <div>
      <div className="stat-label">{title}</div>
      <div className="mt-1 text-[13px] leading-5">
        {name && <div className="font-semibold">{name}</div>}
        {a.company && <div>{a.company}</div>}
        {a.address_1 && <div>{a.address_1}</div>}
        {a.address_2 && <div>{a.address_2}</div>}
        {cityLine && <div>{cityLine}</div>}
        {a.country_code && <div>{String(a.country_code).toUpperCase()}</div>}
        {a.phone && <div className="text-[var(--muted)]">{a.phone}</div>}
      </div>
    </div>
  );
}

/** One order: customer, both addresses, every product, the tax charged and Quantum's tax. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [row] = await db
    .select({ o: storeOrders, slug: integrations.slug })
    .from(storeOrders)
    .innerJoin(integrations, eq(integrations.id, storeOrders.integrationId))
    .where(eq(storeOrders.id, Number(id)))
    .limit(1);
  if (!row) notFound();
  const o = row.o;
  const [doc] = await db
    .select()
    .from(taxDocuments)
    .where(eq(taxDocuments.documentCode, `quantum:${row.slug}:${o.orderId}`))
    .limit(1);
  const pullStart = (await getTaxSetting<string | null>("order_pull_start", DEFAULT_PULL_START)) ?? DEFAULT_PULL_START;
  const qLines = new Map(((doc?.lines ?? []) as unknown as QuoteLine[]).map((l) => [l.id, l]));

  const status =
    o.status === "canceled"
      ? { label: "Canceled", cls: "badge badge-no_activity" }
      : o.shippedAt
        ? { label: "Shipped", cls: "badge badge-filed" }
        : { label: "Waiting to ship", cls: "badge badge-not_started" };

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <div className="text-[12px] text-[var(--muted)]">
              <Link href="/orders" className="text-[var(--accent)]">
                Orders
              </Link>{" "}
              / {o.storeName}
            </div>
            <h1 className="page-title flex items-center gap-2">
              Order #{o.orderNumber ?? o.orderId} <span className={status.cls}>{status.label}</span>
            </h1>
            <p className="page-sub mt-0.5">
              Ordered {when(o.orderedAt)} · Shipped {when(o.shippedAt)} · Payment {o.paymentStatus ?? "—"} · Store id{" "}
              <span className="font-mono text-[11px]">{o.orderId}</span>
            </p>
          </div>
        </div>
      </div>

      <section className="panel grid gap-5 p-5 md:grid-cols-3">
        <div>
          <div className="stat-label">Customer</div>
          <div className="mt-1 text-[13px] leading-5">
            <div className="font-semibold">{o.customerName ?? "—"}</div>
            {o.email && <div>{o.email}</div>}
            {o.phone && <div className="text-[var(--muted)]">{o.phone}</div>}
          </div>
        </div>
        <Address title="Ship to" a={o.shippingAddress as Addr} />
        <Address title="Bill to" a={o.billingAddress as Addr} />
      </section>

      <section className="panel overflow-x-auto">
        <div className="panel-head">Products</div>
        <table className="qtable">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Discount</th>
              <th className="num">Line total</th>
              <th className="num">Tax collected</th>
              <th className="num">Quantum sales tax</th>
              <th className="num">Quantum excise</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => {
              const q = qLines.get(i.id);
              return (
                <tr key={i.id}>
                  <td className="max-w-[340px]">
                    <div>{i.title ?? "—"}</div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {[i.variant, i.productType].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="font-mono text-[11px]">{i.sku ?? "—"}</td>
                  <td className="num">{i.quantity}</td>
                  <td className="num">{fmtMoney(i.unitPrice)}</td>
                  <td className="num">{i.discount ? `−${fmtMoney(i.discount)}` : "—"}</td>
                  <td className="num">{fmtMoney(i.total)}</td>
                  <td className="num">
                    {fmtMoney(i.taxCollected)}
                    {i.taxLines.length > 0 && (
                      <div className="text-[11px] text-[var(--muted)]">{i.taxLines.map((t) => pct(t.rate)).join(" + ")}</div>
                    )}
                  </td>
                  <td className="num">
                    {q ? fmtMoney(q.sales.amount) : "—"}
                    {q && q.sales.rate > 0 && <div className="text-[11px] text-[var(--muted)]">{pct(q.sales.rate * 100)}</div>}
                  </td>
                  <td className="num">
                    {q ? fmtMoney(q.excise?.amount ?? 0) : "—"}
                    {q?.excise?.estimated && <div className="text-[11px] text-[var(--warn)]">cost estimated</div>}
                  </td>
                </tr>
              );
            })}
            {o.shipping.map((m) => (
              <tr key={m.id}>
                <td className="text-[var(--muted)]">{m.name ?? "Shipping"}</td>
                <td />
                <td />
                <td />
                <td />
                <td className="num">{fmtMoney(m.amount)}</td>
                <td className="num">{fmtMoney(m.taxCollected)}</td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel p-5">
          <div className="stat-label">What the store charged</div>
          <dl className="mt-2 space-y-1 text-[13px]">
            {[
              ["Products", num(o.subtotal)],
              ["Shipping & fees", num(o.shippingTotal)],
              ...(num(o.discountTotal) ? [["Discounts", -num(o.discountTotal)]] : []),
              ["Tax collected", num(o.taxCollected)],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <dt className="text-[var(--muted)]">{k}</dt>
                <dd className="num">{fmtMoney(v as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-[var(--line)] pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="num">{fmtMoney(num(o.total))}</dd>
            </div>
            {num(o.refunded) > 0 && (
              <div className="flex justify-between text-[var(--danger)]">
                <dt>Refunded to the customer</dt>
                <dd className="num">{fmtMoney(num(o.refunded))}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="panel p-5">
          <div className="stat-label">Quantum tax</div>
          {doc ? (
            <dl className="mt-2 space-y-1 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Sales tax owed</dt>
                <dd className="num">{fmtMoney(num(doc.salesTax))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Vapor excise owed</dt>
                <dd className="num">{fmtMoney(num(doc.exciseTax))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Collected by the store</dt>
                <dd className="num">{fmtMoney(num(doc.collectedTax ?? 0))}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--line)] pt-1 font-semibold">
                <dt>Owed − collected</dt>
                <dd className="num">{fmtMoney(num(doc.salesTax) + num(doc.exciseTax) - num(doc.collectedTax ?? 0))}</dd>
              </div>
              <div className="pt-1 text-[12px] text-[var(--muted)]">
                {doc.status === "committed" ? "Committed" : "Voided"} to {doc.state} {doc.period}
                {doc.status === "committed" && (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/months/${doc.period}/${doc.state}`} className="text-[var(--accent)]">
                      open the {doc.state} return
                    </Link>
                  </>
                )}
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-[12.5px] text-[var(--muted)]">
              {o.status === "canceled"
                ? "Canceled - nothing is reported for this order."
                : o.shippedAt && o.shippedAt.toISOString().slice(0, 10) >= pullStart
                  ? "Shipped - Quantum records it on the next 5-minute pull."
                  : o.shippedAt
                  ? `Shipped before ${pullStart}, when monthly data started coming from the stores - it is reported from the uploaded files.`
                  : "Not shipped yet. It is taxed into the month it ships in."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
