import "server-only";
import { ConnectorError, json, request } from "../http";
import type { Credentials, NormalizedOrder, SyncWindow } from "../types";

/**
 * Squarespace Commerce API. The site owner makes an API key under
 * Settings → Advanced → Developer API Keys with Orders: read-only.
 * Squarespace rejects requests without a User-Agent.
 */

const BASE = "https://api.squarespace.com/1.0/commerce/orders";

function headers(c: Credentials) {
  return { Authorization: `Bearer ${c.apiKey}`, "User-Agent": "Quantum-Tax-Connector/1.0", Accept: "application/json" };
}

type SqOrder = {
  id: string;
  orderNumber: string;
  createdOn: string;
  customerEmail?: string;
  fulfillmentStatus?: string;
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    countryCode?: string;
    postalCode?: string;
  } | null;
  lineItems?: { id: string; sku?: string; productName?: string; quantity: number; lineItemType?: string; variantOptions?: { value: string }[] }[];
};

type SqPage = { result: SqOrder[]; pagination?: { hasNextPage?: boolean; nextPageCursor?: string } };

export async function test(c: Credentials) {
  if (!c.apiKey) throw new ConnectorError("Enter the Squarespace API key.");
  const res = await request("Squarespace", BASE, { headers: headers(c) });
  await json<SqPage>("Squarespace", res, "testing the connection");
  return {};
}

export async function* orders(c: Credentials, _config: Record<string, unknown>, window: SyncWindow): AsyncGenerator<NormalizedOrder[]> {
  // Squarespace only takes a date range as a PAIR, and only on the first page.
  let next: string | null = window.since
    ? `${BASE}?modifiedAfter=${encodeURIComponent(`${window.since}T00:00:00Z`)}&modifiedBefore=${encodeURIComponent(new Date().toISOString())}`
    : BASE;

  for (let page = 0; next && page < 5000; page++) {
    const res = await request("Squarespace", next, { headers: headers(c) });
    const body = await json<SqPage>("Squarespace", res, "reading orders");

    yield body.result.map((o) => ({
      id: o.id,
      number: `#${o.orderNumber}`,
      createdAt: o.createdOn,
      cancelled: o.fulfillmentStatus === "CANCELED",
      email: o.customerEmail,
      shipTo: o.shippingAddress
        ? {
            firstName: o.shippingAddress.firstName,
            lastName: o.shippingAddress.lastName,
            address1: o.shippingAddress.address1,
            address2: o.shippingAddress.address2,
            city: o.shippingAddress.city,
            state: o.shippingAddress.state,
            zip: o.shippingAddress.postalCode,
            country: o.shippingAddress.countryCode,
          }
        : null,
      lines: (o.lineItems ?? [])
        .filter((l) => !l.lineItemType || l.lineItemType === "PHYSICAL")
        .map((l) => ({
          id: l.id,
          name: [l.productName, ...(l.variantOptions ?? []).map((v) => v.value)].filter(Boolean).join(" - "),
          sku: l.sku,
          quantity: l.quantity,
        })),
    }));

    next = body.pagination?.hasNextPage && body.pagination.nextPageCursor
      ? `${BASE}?cursor=${encodeURIComponent(body.pagination.nextPageCursor)}`
      : null;
  }
}
