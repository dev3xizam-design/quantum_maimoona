import "server-only";
import { ConnectorError, json, request } from "../http";
import type { Credentials, NormalizedOrder, SyncWindow } from "../types";

/**
 * WooCommerce REST API v3.
 *
 * Keys arrive through WooCommerce's own one-click authorize screen
 * (/wc-auth/v1/authorize), so no app has to be registered anywhere - the store
 * owner just approves read access. Many hosts strip the Authorization header, so
 * when Basic auth is refused the keys are retried as query parameters and the
 * working mode is remembered in config.authMode.
 */

type WooOrder = {
  id: number;
  number: string;
  status: string;
  date_created: string | null;
  billing?: { email?: string; first_name?: string; last_name?: string } | null;
  shipping?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  } | null;
  line_items?: { id: number; name: string; sku?: string; quantity: number }[];
};

/** Statuses that mean nothing was shipped. */
const NOT_SHIPPED = new Set(["cancelled", "refunded", "failed", "pending", "checkout-draft", "trash"]);

function url(site: string, path: string, c: Credentials, mode: string, params: Record<string, string> = {}) {
  const u = new URL(`${site}/wp-json/wc/v3${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (mode === "query") {
    u.searchParams.set("consumer_key", c.consumerKey);
    u.searchParams.set("consumer_secret", c.consumerSecret);
  }
  return u.toString();
}

function headers(c: Credentials, mode: string): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (mode !== "query") h.Authorization = `Basic ${Buffer.from(`${c.consumerKey}:${c.consumerSecret}`).toString("base64")}`;
  return h;
}

/** Returns the auth mode that works on this host. */
export async function detectMode(site: string, c: Credentials): Promise<"basic" | "query"> {
  for (const mode of ["basic", "query"] as const) {
    const res = await request("WooCommerce", url(site, "/orders", c, mode, { per_page: "1" }), {
      headers: headers(c, mode),
    });
    if (res.ok) return mode;
    if (res.status === 404) {
      throw new ConnectorError(
        `${site} has no WooCommerce REST API (404). Check it is the WordPress address and that permalinks are not "Plain".`,
        404,
      );
    }
    if (res.status !== 401 && res.status !== 403) await json("WooCommerce", res, "testing the connection");
  }
  throw new ConnectorError("WooCommerce refused these keys. Reconnect the store and approve read access.", 401);
}

export async function test(c: Credentials, config: Record<string, unknown>) {
  const mode = await detectMode(String(config.site), c);
  return { authMode: mode };
}

export async function* orders(
  c: Credentials,
  config: Record<string, unknown>,
  window: SyncWindow,
): AsyncGenerator<NormalizedOrder[]> {
  const site = String(config.site);
  const mode = String(config.authMode ?? "basic");
  const params: Record<string, string> = { per_page: "100", orderby: "date", order: "asc" };
  if (window.since) params.after = `${window.since}T00:00:00`;

  for (let page = 1; page < 5000; page++) {
    const res = await request("WooCommerce", url(site, "/orders", c, mode, { ...params, page: String(page) }), {
      headers: headers(c, mode),
    });
    const batch = await json<WooOrder[]>("WooCommerce", res, "reading orders");
    if (!batch.length) return;

    yield batch.map((o) => ({
      id: String(o.id),
      number: o.number ? `#${o.number}` : String(o.id),
      // Store-local time: the month the merchant sees the order in.
      createdAt: o.date_created,
      cancelled: NOT_SHIPPED.has(o.status),
      email: o.billing?.email ?? null,
      // A virtual-only order has an empty shipping block; fall back to nothing rather than billing,
      // since the billing address is not where anything was shipped.
      shipTo: o.shipping && (o.shipping.address_1 || o.shipping.state)
        ? {
            firstName: o.shipping.first_name,
            lastName: o.shipping.last_name,
            company: o.shipping.company,
            address1: o.shipping.address_1,
            address2: o.shipping.address_2,
            city: o.shipping.city,
            state: o.shipping.state,
            zip: o.shipping.postcode,
            country: o.shipping.country,
          }
        : null,
      lines: (o.line_items ?? []).map((l) => ({ id: String(l.id), name: l.name, sku: l.sku, quantity: l.quantity })),
    }));

    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? 0);
    if ((totalPages && page >= totalPages) || batch.length < 100) return;
  }
}
