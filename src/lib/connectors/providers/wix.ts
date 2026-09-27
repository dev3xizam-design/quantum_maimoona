import "server-only";
import { ConnectorError, json, request } from "../http";
import type { Credentials, NormalizedOrder, SyncWindow } from "../types";

/**
 * Wix eCommerce orders (POST /ecom/v1/orders/search).
 *
 *  - oauth:   Quantum's Wix app (WIX_APP_ID / WIX_APP_SECRET). Installing it hands back an
 *             instanceId; app id + secret + instanceId buy a 4-hour token per sync.
 *  - api_key: the site owner's own API key (Account settings → API Keys) plus the site id.
 *             No app registration needed.
 */

async function authHeaders(c: Credentials, config: Record<string, unknown>): Promise<Record<string, string>> {
  if (c.apiKey) {
    if (!config.siteId) throw new ConnectorError("A Wix API key also needs the site id.");
    return { Authorization: c.apiKey, "wix-site-id": String(config.siteId) };
  }
  const appId = process.env.WIX_APP_ID;
  const appSecret = process.env.WIX_APP_SECRET;
  if (!appId || !appSecret) throw new ConnectorError("WIX_APP_ID / WIX_APP_SECRET are not set on this Quantum.");
  const res = await request("Wix", "https://www.wixapis.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: appId,
      client_secret: appSecret,
      instance_id: String(config.instanceId),
    }),
  });
  const body = await json<{ access_token?: string }>("Wix", res, "getting an access token");
  if (!body.access_token) throw new ConnectorError("Wix did not return an access token.");
  return { Authorization: body.access_token };
}

type WixAddress = {
  subdivision?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  addressLine?: string;
  addressLine2?: string;
  streetAddress?: { number?: string; name?: string };
};

type WixOrder = {
  id: string;
  number?: string | number;
  createdDate?: string;
  status?: string;
  buyerInfo?: { email?: string };
  shippingInfo?: {
    logistics?: {
      shippingDestination?: {
        address?: WixAddress;
        contactDetails?: { firstName?: string; lastName?: string; company?: string };
      };
    };
  };
  lineItems?: {
    id: string;
    quantity?: number;
    productName?: { original?: string; translated?: string };
    physicalProperties?: { sku?: string; shippable?: boolean };
  }[];
};

async function search(headers: Record<string, string>, body: unknown) {
  const res = await request("Wix", "https://www.wixapis.com/ecom/v1/orders/search", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return json<{ orders?: WixOrder[]; metadata?: { cursors?: { next?: string }; hasNext?: boolean } }>(
    "Wix",
    res,
    "reading orders",
  );
}

export async function test(c: Credentials, config: Record<string, unknown>) {
  await search(await authHeaders(c, config), { search: { cursorPaging: { limit: 1 } } });
  return {};
}

export async function* orders(
  c: Credentials,
  config: Record<string, unknown>,
  window: SyncWindow,
): AsyncGenerator<NormalizedOrder[]> {
  const headers = await authHeaders(c, config);
  let cursor: string | undefined;

  for (let page = 0; page < 5000; page++) {
    const body = await search(headers, {
      search: {
        cursorPaging: cursor ? { limit: 100, cursor } : { limit: 100 },
        ...(cursor
          ? {}
          : {
              sort: [{ fieldName: "createdDate", order: "ASC" }],
              ...(window.since ? { filter: { createdDate: { $gte: `${window.since}T00:00:00.000Z` } } } : {}),
            }),
      },
    });

    yield (body.orders ?? []).map((o) => {
      const dest = o.shippingInfo?.logistics?.shippingDestination;
      const a = dest?.address;
      const street =
        a?.addressLine ?? [a?.streetAddress?.number, a?.streetAddress?.name].filter(Boolean).join(" ");
      return {
        id: o.id,
        number: o.number != null ? `#${o.number}` : null,
        createdAt: o.createdDate ?? null,
        cancelled: o.status === "CANCELED" || o.status === "REJECTED",
        email: o.buyerInfo?.email ?? null,
        shipTo: a
          ? {
              firstName: dest?.contactDetails?.firstName,
              lastName: dest?.contactDetails?.lastName,
              company: dest?.contactDetails?.company,
              address1: street || null,
              address2: a.addressLine2,
              city: a.city,
              state: a.subdivision,
              zip: a.postalCode,
              country: a.country,
            }
          : null,
        lines: (o.lineItems ?? [])
          .filter((l) => l.physicalProperties?.shippable !== false)
          .map((l) => ({
            id: l.id,
            name: l.productName?.original ?? l.productName?.translated ?? null,
            sku: l.physicalProperties?.sku ?? null,
            quantity: Number(l.quantity ?? 0),
          })),
      };
    });

    cursor = body.metadata?.cursors?.next;
    if (!body.metadata?.hasNext || !cursor) return;
  }
}
