import "server-only";
import { ConnectorError, json, request } from "../http";
import type { Credentials, NormalizedOrder, SyncWindow } from "../types";

/**
 * Ecwid (Lightspeed E-Series). Store id + a secret_ token from a custom app
 * (Ecwid admin → Apps → My apps) with the read_orders scope.
 */

type EcwidOrder = {
  id: string;
  orderNumber?: number;
  createDate?: string;
  email?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  shippingPerson?: {
    name?: string;
    companyName?: string;
    street?: string;
    city?: string;
    stateOrProvinceCode?: string;
    stateOrProvinceName?: string;
    postalCode?: string;
    countryCode?: string;
  };
  items?: { id: number; sku?: string; name?: string; quantity: number; isShippingRequired?: boolean }[];
};

const base = (storeId: string) => `https://app.ecwid.com/api/v3/${encodeURIComponent(storeId)}`;

export async function test(c: Credentials, config: Record<string, unknown>) {
  if (!config.storeId) throw new ConnectorError("Enter the Ecwid store id.");
  const res = await request("Ecwid", `${base(String(config.storeId))}/profile`, {
    headers: { Authorization: `Bearer ${c.token}` },
  });
  const p = await json<{ settings?: { storeName?: string } }>("Ecwid", res, "testing the connection");
  return { storeName: p.settings?.storeName };
}

export async function* orders(c: Credentials, config: Record<string, unknown>, window: SyncWindow): AsyncGenerator<NormalizedOrder[]> {
  const url = `${base(String(config.storeId))}/orders`;
  for (let offset = 0; offset < 1_000_000; offset += 100) {
    const params = new URLSearchParams({ offset: String(offset), limit: "100", sortBy: "DATE_CREATED_ASC" });
    if (window.since) params.set("createdFrom", String(Math.floor(new Date(`${window.since}T00:00:00Z`).getTime() / 1000)));
    const res = await request("Ecwid", `${url}?${params}`, { headers: { Authorization: `Bearer ${c.token}` } });
    const body = await json<{ total: number; count: number; items: EcwidOrder[] }>("Ecwid", res, "reading orders");

    yield body.items.map((o) => ({
      id: String(o.id),
      number: o.orderNumber != null ? `#${o.orderNumber}` : String(o.id),
      // "2026-01-31 18:02:11 +0000" - date part is what counts.
      createdAt: o.createDate ?? null,
      cancelled:
        ["CANCELLED", "REFUNDED", "INCOMPLETE", "AWAITING_PAYMENT"].includes(o.paymentStatus ?? "") ||
        ["WILL_NOT_DELIVER", "RETURNED"].includes(o.fulfillmentStatus ?? ""),
      email: o.email,
      shipTo: o.shippingPerson
        ? {
            name: o.shippingPerson.name,
            company: o.shippingPerson.companyName,
            address1: o.shippingPerson.street?.replace(/\n/g, ", "),
            city: o.shippingPerson.city,
            state: o.shippingPerson.stateOrProvinceCode ?? o.shippingPerson.stateOrProvinceName,
            zip: o.shippingPerson.postalCode,
            country: o.shippingPerson.countryCode,
          }
        : null,
      lines: (o.items ?? [])
        .filter((i) => i.isShippingRequired !== false)
        .map((i) => ({ id: String(i.id), name: i.name, sku: i.sku, quantity: i.quantity })),
    }));

    if (offset + body.count >= body.total || body.count === 0) return;
  }
}
