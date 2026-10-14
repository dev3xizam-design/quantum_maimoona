import Link from "next/link";
import { and, desc, eq, gte, isNotNull, isNull, lt, ne, or, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations, storeOrders, taxDocuments } from "@/db/schema";
import { fmtMoney, num } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

const PAGE_SIZE = 50;
const STATUSES = ["all", "shipped", "waiting", "canceled"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_WHERE = {
  all: undefined,
  shipped: and(isNotNull(storeOrders.shippedAt), ne(storeOrders.status, "canceled")),
  waiting: and(isNull(storeOrders.shippedAt), ne(storeOrders.status, "canceled")),
  canceled: eq(storeOrders.status, "canceled"),
} as const;

const dateTime = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

function statusOf(o: { status: string | null; shippedAt: Date | null }) {
  if (o.status === "canceled") return { label: "Canceled", cls: "badge badge-no_activity" };
  if (o.shippedAt) return { label: "Shipped", cls: "badge badge-filed" };
  return { label: "Waiting to ship", cls: "badge badge-not_started" };
}

/**
 * Every order from every connected store - who bought, where it went, what was
 * in it, what the store charged and what Quantum says the tax is. Filled by
 * the 5-minute order pull.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; store?: string; status?: string; state?: string; month?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const store = sp.store ? Number(sp.store) : null;
  const status = (STATUSES.includes(sp.status as Status) ? sp.status : "all") as Status;
  const state = (sp.state ?? "").trim().toUpperCase();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const search = q
    ? or(
        dsql`${storeOrders.customerName} ILIKE ${"%" + q + "%"}`,
        dsql`${storeOrders.email} ILIKE ${"%" + q + "%"}`,
        dsql`${storeOrders.orderNumber} = ${q.replace(/^#/, "")}`,
        dsql`${storeOrders.zip} ILIKE ${q + "%"}`,
        dsql`${storeOrders.city} ILIKE ${q + "%"}`,
        dsql`${storeOrders.items}::text ILIKE ${"%" + q + "%"}`,
      )
    : undefined;
  const monthWhere = month
    ? and(
        gte(storeOrders.orderedAt, new Date(`${month}-01T00:00:00Z`)),
        lt(storeOrders.orderedAt, new Date(new Date(`${month}-01T00:00:00Z`).setUTCMonth(Number(month.slice(5)) ))),
      )
    : undefined;
  const parts = [
    search,
    store ? eq(storeOrders.integrationId, store) : undefined,
    STATUS_WHERE[status],
    state ? eq(storeOrders.state, state) : undefined,
    monthWhere,
  ].filter(Boolean);
  const where = parts.length ? and(...parts) : undefined;

  // Quantum's tax document for the order, if it has been committed.
  const docJoin = and(
    eq(taxDocuments.documentCode, dsql`'quantum:' || ${integrations.slug} || ':' || ${storeOrders.orderId}`),
    eq(taxDocuments.status, "committed"),
  );

  const [totals] = await db
    .select({
      n: dsql<number>`count(*)::int`,
      gross: dsql<number>`coalesce(sum(${storeOrders.total}), 0)::float8`,
      collected: dsql<number>`coalesce(sum(${storeOrders.taxCollected}), 0)::float8`,
      quantumSales: dsql<number>`coalesce(sum(${taxDocuments.salesTax}), 0)::float8`,
      quantumExcise: dsql<number>`coalesce(sum(${taxDocuments.exciseTax}), 0)::float8`,
    })
    .from(storeOrders)
    .innerJoin(integrations, eq(integrations.id, storeOrders.integrationId))
    .leftJoin(taxDocuments, docJoin)
    .where(where);

  const total = Number(totals.n);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);

  const rows = await db
    .select({
      id: storeOrders.id,
      storeName: storeOrders.storeName,
      orderNumber: storeOrders.orderNumber,
      orderedAt: storeOrders.orderedAt,
      shippedAt: storeOrders.shippedAt,
      status: storeOrders.status,
      customerName: storeOrders.customerName,
      email: storeOrders.email,
      city: storeOrders.city,
      state: storeOrders.state,
      zip: storeOrders.zip,
      items: storeOrders.items,
      itemCount: storeOrders.itemCount,
      total: storeOrders.total,
      refunded: storeOrders.refunded,
      taxCollected: storeOrders.taxCollected,
      quantumSales: taxDocuments.salesTax,
      quantumExcise: taxDocuments.exciseTax,
    })
    .from(storeOrders)
    .innerJoin(integrations, eq(integrations.id, storeOrders.integrationId))
    .leftJoin(taxDocuments, docJoin)
    .where(where)
    .orderBy(desc(storeOrders.orderedAt))
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);

  const stores = await db
    .select({ id: integrations.id, name: integrations.name, n: dsql<number>`count(${storeOrders.id})::int` })
    .from(integrations)
    .leftJoin(storeOrders, eq(storeOrders.integrationId, integrations.id))
    .groupBy(integrations.id, integrations.name)
    .orderBy(integrations.name);
  const states = await db
    .selectDistinct({ state: storeOrders.state })
    .from(storeOrders)
    .where(isNotNull(storeOrders.state))
    .orderBy(storeOrders.state);

  const link = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, store: store ?? undefined, status: status === "all" ? undefined : status, state, month, page: current, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return s ? `/orders?${s}` : "/orders";
  };

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Orders</h1>
            <p className="page-sub mt-0.5">
              Every order from every connected store, refreshed every 5 minutes. Open one for the
              customer, both addresses, every product and the tax line by line.
            </p>
          </div>
        </div>
        <form method="get" action="/orders" className="mt-3 flex flex-wrap items-center gap-2">
          <input type="text" name="q" defaultValue={q} placeholder="Name, email, order #, ZIP, city or product…" className="w-[300px]" />
          <select name="store" defaultValue={store ?? ""} className="w-[200px]">
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({Number(s.n).toLocaleString()})
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className="w-[160px]">
            <option value="all">Any status</option>
            <option value="shipped">Shipped</option>
            <option value="waiting">Waiting to ship</option>
            <option value="canceled">Canceled</option>
          </select>
          <select name="state" defaultValue={state} className="w-[110px]">
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s.state} value={s.state!}>
                {s.state}
              </option>
            ))}
          </select>
          <input type="month" name="month" defaultValue={month} className="w-[160px]" aria-label="Ordered in month" />
          <button type="submit" className="btn btn-primary">
            Filter
          </button>
          {(q || store || status !== "all" || state || month) && (
            <Link href="/orders" className="btn btn-ghost">
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="stat stat-sand h-[108px] flex flex-col justify-between">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{total.toLocaleString()}</div>
          <div className="stat-sub text-[11px] text-[var(--muted)]">across connected stores</div>
        </div>
        <div className="stat stat-sand h-[108px] flex flex-col justify-between">
          <div className="stat-label">Order totals</div>
          <div className="stat-value">{fmtMoney(Number(totals.gross))}</div>
          <div className="stat-sub text-[11px] text-[var(--muted)]">gross checkout value</div>
        </div>
        <div className="stat stat-sand h-[108px] flex flex-col justify-between">
          <div className="stat-label">Tax collected</div>
          <div className="stat-value">{fmtMoney(Number(totals.collected))}</div>
          <div className="stat-sub text-[11px] text-[var(--muted)]">charged at checkout</div>
        </div>
        <div className="stat stat-sand h-[108px] flex flex-col justify-between">
          <div className="stat-label">Quantum tax</div>
          <div className="stat-value">
            {fmtMoney(Number(totals.quantumSales) + Number(totals.quantumExcise))}
          </div>
          <div className="stat-sub text-[11px] text-[var(--muted)] truncate">
            sales {fmtMoney(Number(totals.quantumSales))} · excise {fmtMoney(Number(totals.quantumExcise))}
          </div>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        {rows.length === 0 ? (
          <div className="empty">
            {total === 0 && !where
              ? "No orders yet. They appear here after the next 5-minute pull."
              : "No orders match these filters."}
          </div>
        ) : (
          <table className="qtable">
            <thead>
              <tr>
                <th>Ordered</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Ship to</th>
                <th>Products</th>
                <th className="num">Total</th>
                <th className="num">Tax collected</th>
                <th className="num">Quantum tax</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const st = statusOf(o);
                const first = o.items[0];
                const quantum = o.quantumSales === null ? null : num(o.quantumSales) + num(o.quantumExcise ?? 0);
                return (
                  <tr key={o.id}>
                    <td className="text-[12px]">{dateTime(o.orderedAt)}</td>
                    <td className="whitespace-nowrap">
                      <Link href={`/orders/${o.id}`} className="font-semibold text-[var(--accent)]">
                        #{o.orderNumber ?? "—"}
                      </Link>
                      <div className="text-[11px] text-[var(--muted)]">{o.storeName}</div>
                    </td>
                    <td className="max-w-[190px]">
                      <div className="truncate">{o.customerName ?? "—"}</div>
                      <div className="truncate text-[11px] text-[var(--muted)]">{o.email ?? ""}</div>
                    </td>
                    <td className="whitespace-nowrap text-[12px]">
                      {[o.city, o.state].filter(Boolean).join(", ")} {o.zip ?? ""}
                    </td>
                    <td className="max-w-[230px]">
                      <div className="truncate">
                        {first ? `${first.quantity} × ${first.title ?? first.sku ?? "item"}${first.variant ? ` — ${first.variant}` : ""}` : "—"}
                      </div>
                      {o.items.length > 1 && (
                        <div className="text-[11px] text-[var(--muted)]">
                          + {o.items.length - 1} more line{o.items.length > 2 ? "s" : ""} · {o.itemCount} units
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {fmtMoney(num(o.total))}
                      {num(o.refunded) > 0 && (
                        <div className="text-[11px] text-[var(--danger)]">refunded {fmtMoney(num(o.refunded))}</div>
                      )}
                    </td>
                    <td className="num">{fmtMoney(num(o.taxCollected))}</td>
                    <td className="num">{quantum === null ? <span className="text-[var(--muted)]">—</span> : fmtMoney(quantum)}</td>
                    <td>
                      <span className={st.cls}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-[12px] text-[var(--muted)]">
          <Link href={link({ page: Math.max(1, current - 1) })} className={`btn btn-sm ${current <= 1 ? "pointer-events-none opacity-40" : ""}`}>
            Previous
          </Link>
          Page {current} of {pages}
          <Link href={link({ page: Math.min(pages, current + 1) })} className={`btn btn-sm ${current >= pages ? "pointer-events-none opacity-40" : ""}`}>
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
