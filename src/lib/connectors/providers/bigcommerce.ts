import "server-only";
import { ConnectorError, json, request } from "../http";
import type { Credentials, NormalizedOrder, SyncWindow } from "../types";

/**
 * BigCommerce Orders v2. Either Quantum's BigCommerce app (OAuth, permanent token)
 * or a store-level API account (Settings → API → Store-level API accounts) with
 * Orders: read-only. Both give a store hash + access token.
 *
 * v2 returns an order's products and shipping addresses as sub-resources, so a
 * sync is 1 + 2 requests per order. Incremental syncs keep that small.
 */

const api = (hash: string, path: string) => `https://api.bigcommerce.com/stores/${hash}${path}`;

async function get<T>(hash: string, token: string, path: string, what: string): Promise<T | null> {
  const res = await request("BigCommerce", api(hash, path), {
    headers: { "X-Auth-Token": token, Accept: "application/json" },
  });
  if (res.status === 204) return null;
  return json<T>("BigCommerce", res, what);
}

export function normalizeStoreHash(raw: string) {
  // Accept the hash itself, or an API path / control-panel URL that contains it.
  const m = raw.trim().match(/stores\/([a-z0-9]+)/i) ?? raw.trim().match(/store-([a-z0-9]+)\./i);
  const hash = (m ? m[1] : raw.trim()).toLowerCase();
  if (!/^[a-z0-9]{5,}$/.test(hash)) throw new ConnectorError("That does not look like a BigCommerce store hash.");
  return hash;
}

export async function test(c: Credentials, config: Record<string, unknown>) {
  const store = await get<{ name?: string }>(String(config.storeHash), c.accessToken, "/v2/store", "testing the connection");
  return { storeName: store?.name };
}

type BcOrder = {
  id: number;
  date_created: string;
  status_id: number;
  billing_address?: { email?: string };
};
type BcProduct = {
  id: number;
  order_address_id: number;
  name: string;
  sku?: string;
  quantity: number;
  quantity_refunded?: number;
  brand?: string;
  type?: string;
};
type BcAddress = {
  id: number;
  first_name?: string;
  last_name?: string;
  company?: string;
  street_1?: string;
  street_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country_iso2?: string;
};

/** Incomplete (0), Cancelled (5), Declined (6), Refunded (4), Awaiting Payment (7). */
const NOT_SHIPPED = new Set([0, 4, 5, 6, 7]);

export async function* orders(
  c: Credentials,
  config: Record<string, unknown>,
  window: SyncWindow,
): AsyncGenerator<NormalizedOrder[]> {
  const hash = String(config.storeHash);
  const token = c.accessToken;
  const params = new URLSearchParams({ limit: "250", sort: "date_created:asc" });
  if (window.since) params.set("min_date_created", `${window.since}T00:00:00+00:00`);

  for (let page = 1; page < 5000; page++) {
    params.set("page", String(page));
    const batch = await get<BcOrder[]>(hash, token, `/v2/orders?${params}`, "reading orders");
    if (!batch?.length) return;

    const out: NormalizedOrder[] = [];
    for (const o of batch) {
      const cancelled = NOT_SHIPPED.has(o.status_id);
      const [products, addresses] = cancelled
        ? [[], []]
        : await Promise.all([
            get<BcProduct[]>(hash, token, `/v2/orders/${o.id}/products?limit=250`, "reading order lines"),
            get<BcAddress[]>(hash, token, `/v2/orders/${o.id}/shipping_addresses`, "reading ship-to addresses"),
          ]);

      // An order can ship to several addresses; each becomes its own pseudo-order so every
      // line lands in the state it actually went to.
      const addrs = addresses ?? [];
      if (cancelled || !addrs.length) {
        out.push({ id: String(o.id), number: `#${o.id}`, createdAt: toIso(o.date_created), cancelled, email: o.billing_address?.email, shipTo: null, lines: [] });
        continue;
      }
      for (const a of addrs) {
        out.push({
          id: addrs.length > 1 ? `${o.id}-${a.id}` : String(o.id),
          number: `#${o.id}`,
          createdAt: toIso(o.date_created),
          cancelled: false,
          email: o.billing_address?.email,
          shipTo: {
            firstName: a.first_name,
            lastName: a.last_name,
            company: a.company,
            address1: a.street_1,
            address2: a.street_2,
            city: a.city,
            state: a.state,
            zip: a.zip,
            country: a.country_iso2,
          },
          lines: (products ?? [])
            .filter((p) => p.order_address_id === a.id && p.type !== "digital")
            .map((p) => ({
              id: String(p.id),
              name: p.name,
              sku: p.sku,
              brand: p.brand,
              quantity: p.quantity - (p.quantity_refunded ?? 0),
            })),
        });
      }
    }
    yield out;
    if (batch.length < 250) return;
  }
}

/** v2 dates are RFC 2822 ("Tue, 20 Nov 2012 00:00:00 +0000"). */
function toIso(raw: string) {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
