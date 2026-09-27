import "server-only";
import { ConnectorError, json, request } from "../http";
import type { Credentials, NormalizedOrder, SyncWindow } from "../types";

/**
 * Shopify, over the GraphQL Admin API (REST is legacy for new apps).
 *
 * Three ways in, all ending in an access token:
 *  - oauth:              Quantum's own Shopify app (SHOPIFY_CLIENT_ID/SECRET) - the one-button path.
 *  - client_credentials: the merchant's own Dev Dashboard app. Shopify issues NO permanent token
 *                        for these any more; Client ID + Secret buy a 24-hour one, fetched per sync.
 *  - token:              a legacy shpat_ custom-app token, still valid where it exists.
 *
 * Orders older than 60 days need the read_all_orders scope, which Shopify grants on request.
 */

export const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
export const SCOPES = "read_orders,read_all_orders,read_products";

export function normalizeShopDomain(raw: string): string {
  let s = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) throw new ConnectorError("Enter the store's .myshopify.com address.");
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) {
    throw new ConnectorError(
      `"${raw}" is not a .myshopify.com address. Use the store's permanent address (Settings → Domains shows it), not its custom domain.`,
    );
  }
  return s;
}

async function accessToken(shop: string, c: Credentials): Promise<string> {
  if (c.accessToken) return c.accessToken;
  if (!c.clientId || !c.clientSecret) throw new ConnectorError("No Shopify credentials saved for this store.");
  const res = await request("Shopify", `https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: "client_credentials" }),
  });
  const body = await json<{ access_token?: string }>("Shopify", res, "exchanging the Client ID and Secret");
  if (!body.access_token) throw new ConnectorError("Shopify did not return an access token.");
  return body.access_token;
}

type Gql<T> = { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };

async function gql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await request("Shopify", `https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });
    const body = await json<Gql<T>>("Shopify", res, "reading orders");
    const throttled = body.errors?.some((e) => e.extensions?.code === "THROTTLED");
    if (throttled) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (body.errors?.length) {
      const msg = body.errors.map((e) => e.message).join("; ");
      if (/access denied|protected customer data/i.test(msg)) {
        throw new ConnectorError(
          `Shopify withheld order data: ${msg}. The app needs the read_orders scope, and customer name/address needs "Protected customer data" access approved in the app's settings.`,
        );
      }
      throw new ConnectorError(`Shopify: ${msg}`);
    }
    return body.data as T;
  }
  throw new ConnectorError("Shopify kept throttling the sync. Try again in a minute.");
}

export async function test(c: Credentials, config: Record<string, unknown>) {
  const shop = String(config.shop);
  const token = await accessToken(shop, c);
  const data = await gql<{ shop: { name: string } }>(shop, token, `{ shop { name } }`, {});
  return { storeName: data.shop.name };
}

const ORDERS = `
query Orders($cursor: String, $q: String) {
  orders(first: 25, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt cancelledAt email test
      shippingAddress { firstName lastName company address1 address2 city provinceCode province zip countryCodeV2 }
      lineItems(first: 30) {
        nodes { id title variantTitle sku currentQuantity quantity vendor requiresShipping }
      }
    }
  }
}`;

type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  email: string | null;
  test: boolean;
  shippingAddress: {
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    provinceCode: string | null;
    province: string | null;
    zip: string | null;
    countryCodeV2: string | null;
  } | null;
  lineItems: {
    nodes: {
      id: string;
      title: string;
      variantTitle: string | null;
      sku: string | null;
      quantity: number;
      currentQuantity: number;
      vendor: string | null;
      requiresShipping: boolean;
    }[];
  };
};

const tail = (gid: string) => gid.split("/").pop() ?? gid;

export async function* orders(
  c: Credentials,
  config: Record<string, unknown>,
  window: SyncWindow,
): AsyncGenerator<NormalizedOrder[]> {
  const shop = String(config.shop);
  const token = await accessToken(shop, c);
  const q = window.since ? `created_at:>='${window.since}'` : null;
  let cursor: string | null = null;

  for (let page = 0; page < 4000; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ShopifyOrder[] } } =
      await gql(shop, token, ORDERS, { cursor, q });
    yield data.orders.nodes
      .filter((o) => !o.test)
      .map((o) => ({
        id: tail(o.id),
        number: o.name,
        createdAt: o.createdAt,
        cancelled: Boolean(o.cancelledAt),
        email: o.email,
        shipTo: o.shippingAddress && {
          firstName: o.shippingAddress.firstName,
          lastName: o.shippingAddress.lastName,
          company: o.shippingAddress.company,
          address1: o.shippingAddress.address1,
          address2: o.shippingAddress.address2,
          city: o.shippingAddress.city,
          state: o.shippingAddress.provinceCode ?? o.shippingAddress.province,
          zip: o.shippingAddress.zip,
          country: o.shippingAddress.countryCodeV2,
        },
        // Package protection / shipping insurance lines do not ship product.
        lines: o.lineItems.nodes
          .filter((l) => l.requiresShipping)
          .map((l) => ({
            id: tail(l.id),
            name: [l.title, l.variantTitle].filter(Boolean).join(" - "),
            sku: l.sku,
            brand: l.vendor,
            // currentQuantity excludes items removed/refunded after the order was placed.
            quantity: l.currentQuantity ?? l.quantity,
          })),
      }));
    if (!data.orders.pageInfo.hasNextPage) return;
    cursor = data.orders.pageInfo.endCursor;
  }
}
