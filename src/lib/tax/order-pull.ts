import "server-only";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations, monthlySnapshots, storeOrders, taxDocuments, type StoreOrderItem } from "@/db/schema";
import { computeAndStoreMonth } from "../months";
import { authHeader } from "../medusa/match";
import { credentialsFor } from "../medusa/sync";
import { getTaxSetting } from "./calculate";
import { commitOrder, commitSchema, voidOrder, type CommitInput } from "./commit";

/**
 * Pulls each connected Medusa store's orders on a schedule and runs them through
 * the same commit / void lifecycle the checkout push uses, so a store without
 * the Quantum tax provider (or with it, as a safety net) still lands in the
 * month it shipped in:
 *
 *   shipped on/after the start date  -> commitOrder (sales, excise, PACT rows)
 *   canceled                          -> voidOrder
 *   anything else                     -> left until it ships
 *
 * Only orders changed since the last pull are read. An order that is already
 * committed and has not changed since is skipped, so a quiet store costs one
 * small API call per run.
 */

/** Orders that SHIPPED before this day are not pulled (earlier months come from the uploaded files). */
export const DEFAULT_PULL_START = "2026-10-01";
/** Re-read a margin before the cursor: store clocks and slow writes. */
const OVERLAP_MS = 15 * 60_000;
/** First run: orders placed this long before the start can still ship after it. */
const FIRST_RUN_LOOKBACK_DAYS = 60;
/** A run that dies keeps the lock this long before the next run may take it. */
const LOCK_MS = 10 * 60_000;

const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "updated_at",
  "email",
  "status",
  "fulfillment_status",
  "payment_status",
  "total",
  "subtotal",
  "tax_total",
  "summary.refunded_total",
  "*billing_address",
  "*items",
  "*items.tax_lines",
  "*items.adjustments",
  "*shipping_address",
  "*shipping_methods",
  "*shipping_methods.tax_lines",
  "*fulfillments",
].join(",");

type PullState = {
  cursor?: string;
  lockedUntil?: string | null;
  lastRunAt?: string;
  lastResult?: PullResult;
};

export type PullResult = {
  store: string;
  read: number;
  committed: number;
  unchanged: number;
  voided: number;
  waiting: number;
  skipped: number;
  errors: { order: string; error: string }[];
  /** Months whose figures changed (committed into or voided out of). */
  periods: string[];
  since: string;
  ms: number;
};

type AnyOrder = Record<string, any>;

function shippedAt(order: AnyOrder): string | null {
  const dates = (order.fulfillments ?? [])
    .filter((f: AnyOrder) => f.shipped_at && !f.canceled_at)
    .map((f: AnyOrder) => new Date(f.shipped_at).toISOString())
    .sort();
  return dates[0] ?? null;
}

/** The same payload the Medusa Quantum provider pushes, built from an admin order. */
export function commitPayloadFromOrder(order: AnyOrder, shipped: string): CommitInput {
  const a = order.shipping_address ?? {};
  return commitSchema.parse({
    order_id: order.id,
    order_number: order.display_id != null ? String(order.display_id) : null,
    ordered_at: new Date(order.created_at).toISOString(),
    shipped_at: shipped,
    email: order.email ?? null,
    address: {
      first_name: a.first_name ?? null,
      last_name: a.last_name ?? null,
      company: a.company ?? null,
      line1: a.address_1 ?? null,
      line2: a.address_2 ?? null,
      city: a.city ?? null,
      state: String(a.province ?? "").replace(/^us-/i, "").toUpperCase(),
      zip: a.postal_code ?? "",
      country: (a.country_code ?? "us").toUpperCase(),
    },
    lines: (order.items ?? []).map((i: AnyOrder) => {
      const gross = Number(i.unit_price ?? 0) * Number(i.quantity ?? 0);
      const discount = (i.adjustments ?? []).reduce((s: number, x: AnyOrder) => s + Number(x.amount ?? 0), 0);
      return {
        id: i.id,
        variant_id: i.variant_id ?? null,
        product_id: i.product_id ?? null,
        sku: i.variant_sku ?? null,
        barcode: i.variant_barcode ?? null,
        title: i.product_title ?? i.title ?? null,
        variant_title: i.variant_title ?? i.subtitle ?? null,
        product_type: i.product_type ?? null,
        description: i.product_description ? String(i.product_description).slice(0, 4000) : null,
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
        discount,
        tax_lines: (i.tax_lines ?? []).map((t: AnyOrder) => ({
          code: t.code ?? null,
          rate: Number(t.rate ?? 0),
          amount: (Number(t.rate ?? 0) / 100) * (gross - discount),
        })),
      };
    }),
    shipping: (order.shipping_methods ?? []).map((s: AnyOrder) => ({
      id: s.id,
      amount: Number(s.amount ?? 0),
      tax_lines: (s.tax_lines ?? []).map((t: AnyOrder) => ({
        code: t.code ?? null,
        rate: Number(t.rate ?? 0),
        amount: (Number(t.rate ?? 0) / 100) * Number(s.amount ?? 0),
      })),
    })),
  });
}

const money = (n: unknown) => Math.round((Number(n) || 0) * 10000) / 10000;

/** The store_orders row for an admin order: what the store has, as it has it. */
function storeOrderRow(conn: { id: number; name: string }, order: AnyOrder): typeof storeOrders.$inferInsert {
  const a = order.shipping_address ?? {};
  const items: StoreOrderItem[] = (order.items ?? []).map((i: AnyOrder) => {
    const quantity = Number(i.quantity ?? 0);
    const unitPrice = money(i.unit_price);
    const discount = money((i.adjustments ?? []).reduce((s: number, x: AnyOrder) => s + Number(x.amount ?? 0), 0));
    const total = money(unitPrice * quantity - discount);
    const taxLines = (i.tax_lines ?? []).map((t: AnyOrder) => ({ code: t.code ?? null, rate: Number(t.rate ?? 0) }));
    return {
      id: i.id,
      title: i.product_title ?? i.title ?? null,
      variant: i.variant_title ?? i.subtitle ?? null,
      sku: i.variant_sku ?? null,
      productType: i.product_type ?? null,
      quantity,
      unitPrice,
      discount,
      total,
      taxCollected: money(taxLines.reduce((s: number, t: { rate: number }) => s + (t.rate / 100) * total, 0)),
      taxLines,
    };
  });
  const shipping = (order.shipping_methods ?? []).map((m: AnyOrder) => {
    const amount = money(m.amount);
    return {
      id: m.id,
      name: m.name ?? null,
      amount,
      taxCollected: money((m.tax_lines ?? []).reduce((s: number, t: AnyOrder) => s + (Number(t.rate ?? 0) / 100) * amount, 0)),
    };
  });
  const itemsTotal = items.reduce((s, i) => s + i.total, 0);
  const shippingTotal = shipping.reduce((s: number, m: { amount: number }) => s + m.amount, 0);
  const taxFromLines = items.reduce((s, i) => s + i.taxCollected, 0) + shipping.reduce((s: number, m: { taxCollected: number }) => s + m.taxCollected, 0);
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  return {
    integrationId: conn.id,
    storeName: conn.name,
    orderId: order.id,
    orderNumber: order.display_id != null ? String(order.display_id) : null,
    status: order.status ?? null,
    fulfillmentStatus: order.fulfillment_status ?? null,
    paymentStatus: order.payment_status ?? null,
    orderedAt: new Date(order.created_at),
    shippedAt: shippedAt(order) ? new Date(shippedAt(order)!) : null,
    customerName: name || a.company || null,
    email: order.email ?? null,
    phone: a.phone ?? null,
    state: a.province ? String(a.province).replace(/^us-/i, "").toUpperCase() : null,
    city: a.city ?? null,
    zip: a.postal_code ?? null,
    shippingAddress: order.shipping_address ?? null,
    billingAddress: order.billing_address ?? null,
    items,
    shipping,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    // From the lines, before tax: Medusa's item_total / shipping_total include tax.
    subtotal: String(money(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))),
    shippingTotal: String(money(shippingTotal)),
    discountTotal: String(money(items.reduce((s, i) => s + i.discount, 0))),
    taxCollected: String(money(order.tax_total ?? taxFromLines)),
    refunded: String(money(order.summary?.refunded_total ?? 0)),
    total: String(money(order.total ?? itemsTotal + shippingTotal + taxFromLines)),
    storeUpdatedAt: order.updated_at ? new Date(order.updated_at) : null,
    syncedAt: new Date(),
  };
}

async function saveOrders(conn: { id: number; name: string }, orders: AnyOrder[]) {
  const rows = orders.filter((o) => o.id && o.created_at).map((o) => storeOrderRow(conn, o));
  if (!rows.length) return;
  await db
    .insert(storeOrders)
    .values(rows)
    .onConflictDoUpdate({
      target: [storeOrders.integrationId, storeOrders.orderId],
      set: {
        storeName: dsql`excluded.store_name`,
        orderNumber: dsql`excluded.order_number`,
        status: dsql`excluded.status`,
        fulfillmentStatus: dsql`excluded.fulfillment_status`,
        paymentStatus: dsql`excluded.payment_status`,
        orderedAt: dsql`excluded.ordered_at`,
        shippedAt: dsql`excluded.shipped_at`,
        customerName: dsql`excluded.customer_name`,
        email: dsql`excluded.email`,
        phone: dsql`excluded.phone`,
        state: dsql`excluded.state`,
        city: dsql`excluded.city`,
        zip: dsql`excluded.zip`,
        shippingAddress: dsql`excluded.shipping_address`,
        billingAddress: dsql`excluded.billing_address`,
        items: dsql`excluded.items`,
        shipping: dsql`excluded.shipping`,
        itemCount: dsql`excluded.item_count`,
        subtotal: dsql`excluded.subtotal`,
        shippingTotal: dsql`excluded.shipping_total`,
        discountTotal: dsql`excluded.discount_total`,
        taxCollected: dsql`excluded.tax_collected`,
        refunded: dsql`excluded.refunded`,
        total: dsql`excluded.total`,
        storeUpdatedAt: dsql`excluded.store_updated_at`,
        syncedAt: dsql`excluded.synced_at`,
      },
    });
}

async function* changedOrders(
  baseUrl: string,
  auth: string,
  filter: { field: "updated_at" | "created_at"; since: string },
): AsyncGenerator<AnyOrder[]> {
  const limit = 100;
  for (let offset = 0; offset < 50_000; ) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      fields: ORDER_FIELDS,
      order: filter.field,
      [`${filter.field}[$gte]`]: filter.since,
    });
    const res = await fetch(`${baseUrl}/admin/orders?${params}`, {
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Store returned ${res.status} listing orders: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { orders?: AnyOrder[]; count?: number };
    const orders = body.orders ?? [];
    if (!orders.length) return;
    yield orders;
    offset += orders.length;
    if (typeof body.count === "number" && offset >= body.count) return;
  }
}

/** Takes the store's pull lock in one statement; false when another run holds it. */
async function lock(id: number): Promise<boolean> {
  const until = new Date(Date.now() + LOCK_MS).toISOString();
  const pull = dsql`coalesce(${integrations.config} -> 'orderPull', '{}'::jsonb)`;
  const rows = await db
    .update(integrations)
    .set({
      config: dsql`coalesce(${integrations.config}, '{}'::jsonb) || jsonb_build_object('orderPull', ${pull} || jsonb_build_object('lockedUntil', ${until}::text))`,
    })
    .where(
      and(
        eq(integrations.id, id),
        dsql`(${pull} ->> 'lockedUntil' IS NULL OR (${pull} ->> 'lockedUntil')::timestamptz < now())`,
      ),
    )
    .returning({ id: integrations.id });
  return rows.length > 0;
}

async function saveState(id: number, patch: PullState) {
  const [row] = await db.select({ config: integrations.config }).from(integrations).where(eq(integrations.id, id));
  const config = (row?.config ?? {}) as { orderPull?: PullState };
  await db
    .update(integrations)
    .set({ config: { ...config, orderPull: { ...(config.orderPull ?? {}), ...patch } } })
    .where(eq(integrations.id, id));
}

/**
 * `history`: save every order the store has into store_orders and nothing else -
 * no commits, no voids, the cursor stays where it is. For the one-time backfill.
 */
export async function pullStoreOrders(
  integrationId: number,
  opts: { since?: string; history?: boolean } = {},
): Promise<PullResult | null> {
  const started = Date.now();
  if (!(await lock(integrationId))) return null;

  const { row, baseUrl, secret, scheme } = await credentialsFor(integrationId);
  const conn = { id: row.id, slug: row.slug, name: row.name };
  const state = ((row.config ?? {}) as { orderPull?: PullState }).orderPull ?? {};
  const start = (await getTaxSetting<string | null>("order_pull_start", DEFAULT_PULL_START)) ?? DEFAULT_PULL_START;

  // Later runs: everything CHANGED since the cursor. The first run selects by
  // order date instead - a bulk edit can touch every order in a store's history
  // (Vape Closeouts: all 8,902 updated since August), and only recent orders can
  // ship on or after the start date.
  const filter: { field: "updated_at" | "created_at"; since: string } = opts.history
    ? { field: "created_at", since: "2000-01-01T00:00:00.000Z" }
    : opts.since || state.cursor
      ? { field: "updated_at", since: opts.since ?? new Date(new Date(state.cursor!).getTime() - OVERLAP_MS).toISOString() }
      : { field: "created_at", since: new Date(new Date(start).getTime() - FIRST_RUN_LOOKBACK_DAYS * 86_400_000).toISOString() };
  const since = filter.since;

  const result: PullResult = {
    store: row.name,
    read: 0,
    committed: 0,
    unchanged: 0,
    voided: 0,
    waiting: 0,
    skipped: 0,
    errors: [],
    periods: [],
    since,
    ms: 0,
  };
  let cursor = state.cursor ?? since;
  const periods = new Set<string>();

  try {
    const auth = authHeader(secret, scheme);
    for await (const page of changedOrders(baseUrl, auth, filter)) {
      await saveOrders(conn, page);
      if (opts.history) {
        result.read += page.length;
        continue;
      }
      for (const order of page) {
        result.read += 1;
        if (order.updated_at && order.updated_at > cursor) cursor = order.updated_at;
        try {
          const country = String(order.shipping_address?.country_code ?? "us").toLowerCase();
          const [doc] = await db
            .select({ status: taxDocuments.status, committedAt: taxDocuments.committedAt })
            .from(taxDocuments)
            .where(eq(taxDocuments.documentCode, `quantum:${conn.slug}:${order.id}`))
            .limit(1);
          if (String(order.status).toLowerCase() === "canceled") {
            // Only orders Quantum committed need voiding; the PACT rows of others
            // are removed by the daily store sync.
            if (doc?.status === "committed") {
              const r = await voidOrder(conn, order.id, "Canceled in the store");
              if (r.status === "voided" || r.status === "returned") {
                result.voided += 1;
                if (r.period) periods.add(r.period);
                if (r.status === "returned") periods.add(new Date().toISOString().slice(0, 7));
              }
            } else result.skipped += 1;
            continue;
          }
          const shipped = shippedAt(order);
          if (!shipped) {
            result.waiting += 1;
            continue;
          }
          if (shipped.slice(0, 10) < start || country !== "us" || !(order.items ?? []).length) {
            result.skipped += 1;
            continue;
          }
          if (doc?.status === "committed" && order.updated_at && doc.committedAt.toISOString() >= new Date(order.updated_at).toISOString()) {
            result.unchanged += 1;
            continue;
          }
          const c = await commitOrder(conn, commitPayloadFromOrder(order, shipped));
          if (c.status === "committed") periods.add(c.period);
          result.committed += 1;
        } catch (e) {
          result.errors.push({ order: String(order.display_id ?? order.id), error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  } catch (e) {
    result.errors.push({ order: "*", error: e instanceof Error ? e.message : String(e) });
  } finally {
    result.periods = [...periods].sort();
    result.ms = Date.now() - started;
    // The cursor only moves past orders that were read; a failed order is
    // retried because it is re-read inside the overlap or when it changes.
    const failedAll = result.errors.some((x) => x.order === "*");
    await saveState(integrationId, {
      cursor: failedAll || opts.history ? state.cursor : cursor,
      lockedUntil: null,
      lastRunAt: new Date().toISOString(),
      lastResult: result,
    });
  }
  return result;
}

/** Every active Medusa store with order sync on. */
export async function pullAllStores() {
  const rows = await db
    .select({ id: integrations.id, name: integrations.name })
    .from(integrations)
    .where(and(eq(integrations.active, true), eq(integrations.syncOrders, true), eq(integrations.provider, "medusa")));
  const results: (PullResult | { store: string; skipped: "locked" } | { store: string; error: string })[] = [];
  for (const r of rows) {
    try {
      results.push((await pullStoreOrders(r.id)) ?? { store: r.name, skipped: "locked" });
    } catch (e) {
      results.push({ store: r.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Rebuild the months these orders landed in, so the month page shows them
  // without a manual compute. A CLOSED month keeps the figures that were
  // reviewed - its new activity shows as a recompute the reviewer chooses.
  const months = [...new Set(results.flatMap((r) => ("periods" in r ? r.periods : [])))].sort();
  const recomputed: string[] = [];
  for (const month of months) {
    const [snap] = await db
      .select({ status: monthlySnapshots.status })
      .from(monthlySnapshots)
      .where(eq(monthlySnapshots.month, month))
      .limit(1);
    if (snap?.status === "closed") continue;
    await computeAndStoreMonth(month, "order pull");
    recomputed.push(month);
  }
  return { results, recomputed };
}
