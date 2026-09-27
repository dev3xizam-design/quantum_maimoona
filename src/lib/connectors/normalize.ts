import { normalizeState } from "@/lib/states";
import type { NormalizedAddress, NormalizedOrder } from "./types";

/**
 * NormalizedOrder[] -> PACT shipment rows. Same rules as the Medusa mapper
 * (src/lib/medusa/orders.ts) so a store's platform never changes what is filed:
 * one row per line, anything that cannot be placed in a US state is COUNTED and
 * reported, never dropped silently.
 */

export type ShipmentRow = {
  externalId: string;
  orderNumber: string | null;
  period: string;
  state: string;
  customerName: string | null;
  shipToAddress: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  shipToZip: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  product: string | null;
  brand: string | null;
  quantity: number;
  sku: string | null;
};

export type NormalizeResult = {
  rows: ShipmentRow[];
  ordersRead: number;
  skippedNoAddress: number;
  skippedNonUs: number;
  skippedCancelled: number;
  /** Orders cancelled at the source - any rows synced before the cancellation must go. */
  cancelledOrderIds: string[];
};

export function emptyResult(): NormalizeResult {
  return { rows: [], ordersRead: 0, skippedNoAddress: 0, skippedNonUs: 0, skippedCancelled: 0, cancelledOrderIds: [] };
}

export function addressName(a: NormalizedAddress | null | undefined, email?: string | null) {
  const name = [a?.firstName, a?.lastName].filter(Boolean).join(" ").trim() || (a?.name ?? "").trim();
  return name || a?.company?.trim() || email || null;
}

/** "US", "USA", "United States" all count; a blank country is assumed US. */
function isUs(country: string | null | undefined) {
  const c = (country ?? "").trim().toLowerCase();
  return !c || c === "us" || c === "usa" || c === "united states" || c === "united states of america";
}

/** First 10 chars of an ISO or "YYYY-MM-DD hh:mm" timestamp, only if it is a real date. */
export function isoDay(raw: string | null | undefined): string | null {
  const d = (raw ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export function normalizeOrders(
  orders: NormalizedOrder[],
  provider: string,
  storeSlug: string,
  into: NormalizeResult = emptyResult(),
): NormalizeResult {
  for (const order of orders) {
    into.ordersRead += 1;
    if (order.cancelled) {
      into.skippedCancelled += 1;
      into.cancelledOrderIds.push(order.id);
      continue;
    }
    const a = order.shipTo;
    if (a && !isUs(a.country)) {
      into.skippedNonUs += 1;
      continue;
    }
    // Wix and some Magento installs send ISO 3166-2 ("US-CA").
    const state = normalizeState(a?.state?.replace(/^US-/i, ""));
    const day = isoDay(order.createdAt);
    if (!a || !state || !day) {
      into.skippedNoAddress += 1;
      continue;
    }

    const number = (order.number ?? "").toString().trim() || order.id;
    const street = [a.address1, a.address2].filter((s) => s && String(s).trim()).join(", ") || null;

    for (const line of order.lines) {
      const qty = Number(line.quantity ?? 0);
      if (!Number.isFinite(qty) || qty === 0) continue;
      into.rows.push({
        externalId: `${provider}:${storeSlug}:${order.id}:${line.id}`,
        orderNumber: number,
        period: day.slice(0, 7),
        state,
        customerName: addressName(a, order.email),
        shipToAddress: street,
        shipToCity: a.city?.trim() || null,
        shipToState: state,
        shipToZip: a.zip?.trim() || null,
        invoiceDate: day,
        invoiceNumber: number,
        product: line.name?.trim() || null,
        brand: line.brand?.trim() || null,
        quantity: qty,
        sku: line.sku?.trim() || null,
      });
    }
  }
  return into;
}
