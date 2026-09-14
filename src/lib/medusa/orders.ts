import "server-only";
import { normalizeState } from "@/lib/states";
import { authHeader, type AuthScheme } from "./match";

export { normalizeState };

/**
 * Order reading for the PACT Act feed.
 *
 * PACT is a per-shipment disclosure: who you shipped to, where, when, and what.
 * A sales-tax export cannot answer "who" - only the order system can - so this
 * is the feed that makes those reports fileable.
 */

export type MedusaAddress = {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  company?: string | null;
};

export type MedusaLineItem = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  product_title?: string | null;
  variant_title?: string | null;
  variant_sku?: string | null;
  variant_barcode?: string | null;
  quantity?: number | null;
  variant?: { sku?: string | null; barcode?: string | null; title?: string | null } | null;
};

export type MedusaOrder = {
  id: string;
  display_id?: number | string | null;
  created_at?: string | null;
  email?: string | null;
  status?: string | null;
  shipping_address?: MedusaAddress | null;
  items?: MedusaLineItem[] | null;
};

export function customerName(address: MedusaAddress | null | undefined, email?: string | null) {
  const name = [address?.first_name, address?.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (address?.company) return address.company;
  return email ?? null;
}

export type ShipmentRowInput = {
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

export type OrderMapResult = {
  rows: ShipmentRowInput[];
  skippedNoAddress: number;
  skippedNonUs: number;
  skippedCancelled: number;
};

/**
 * One shipment row per order line. Anything that cannot be placed in a state is
 * counted and reported rather than dropped silently - an under-reported PACT
 * filing is the failure mode that matters here.
 */
export function mapOrdersToShipments(orders: MedusaOrder[], storeSlug: string): OrderMapResult {
  const rows: ShipmentRowInput[] = [];
  let skippedNoAddress = 0;
  let skippedNonUs = 0;
  let skippedCancelled = 0;

  for (const order of orders) {
    if ((order.status ?? "").toLowerCase() === "canceled") {
      skippedCancelled += 1;
      continue;
    }
    const address = order.shipping_address;
    const country = (address?.country_code ?? "us").toLowerCase();
    if (country && country !== "us") {
      skippedNonUs += 1;
      continue;
    }
    const state = normalizeState(address?.province);
    if (!state) {
      skippedNoAddress += 1;
      continue;
    }

    const createdAt = order.created_at ? String(order.created_at).slice(0, 10) : null;
    const period = createdAt ? createdAt.slice(0, 7) : null;
    if (!period) {
      skippedNoAddress += 1;
      continue;
    }

    const orderNumber = order.display_id != null ? String(order.display_id) : order.id;
    const street = [address?.address_1, address?.address_2].filter(Boolean).join(", ") || null;

    for (const item of order.items ?? []) {
      rows.push({
        externalId: `medusa:${storeSlug}:${order.id}:${item.id}`,
        orderNumber,
        period,
        state,
        customerName: customerName(address, order.email),
        shipToAddress: street,
        shipToCity: address?.city ?? null,
        shipToState: state,
        shipToZip: address?.postal_code ?? null,
        invoiceDate: createdAt,
        invoiceNumber: orderNumber,
        product:
          item.product_title ??
          item.title ??
          [item.title, item.variant_title].filter(Boolean).join(" - ") ??
          null,
        brand: null,
        quantity: Number(item.quantity ?? 0),
        sku: item.variant_sku ?? item.variant?.sku ?? item.variant_barcode ?? item.variant?.barcode ?? null,
      });
    }
  }

  return { rows, skippedNoAddress, skippedNonUs, skippedCancelled };
}

/** Pages through /admin/orders. */
export async function* iterateOrders(
  baseUrl: string,
  secret: string,
  scheme: AuthScheme,
  opts: { pageSize?: number; maxPages?: number; createdAfter?: string } = {},
): AsyncGenerator<MedusaOrder[]> {
  const limit = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 500;
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      fields: "id,display_id,created_at,email,status,*items,*shipping_address",
      order: "created_at",
    });
    if (opts.createdAfter) params.set("created_at[$gte]", opts.createdAfter);

    const res = await fetch(`${baseUrl}/admin/orders?${params.toString()}`, {
      headers: { Authorization: authHeader(secret, scheme), Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `Medusa returned ${res.status} while listing orders. ${(await res.text()).slice(0, 200)}`,
      );
    }
    const body = (await res.json()) as { orders?: MedusaOrder[]; count?: number };
    const orders = body.orders ?? [];
    if (!orders.length) return;

    yield orders;
    offset += orders.length;
    if (typeof body.count === "number" && offset >= body.count) return;
    if (orders.length < limit) return;
  }
}
