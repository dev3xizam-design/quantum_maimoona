/**
 * Store connector tests. Each platform's order mapper is driven with a
 * realistic API response through a mocked fetch, then run through the shared
 * normalizer - so these lock in the rules that decide what reaches a PACT report:
 * cancelled orders out, non-US out, one row per shipped line, right state.
 *
 *   npm run test:connectors
 */
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createHmac } from "node:crypto";
import { normalizeOrders } from "../src/lib/connectors/normalize";
import { pushBatchSchema, pushToNormalized } from "../src/lib/connectors/push";
import type { NormalizedOrder, SyncWindow } from "../src/lib/connectors/types";
import * as shopify from "../src/lib/connectors/providers/shopify";
import * as woocommerce from "../src/lib/connectors/providers/woocommerce";
import * as wix from "../src/lib/connectors/providers/wix";
import * as bigcommerce from "../src/lib/connectors/providers/bigcommerce";
import * as squarespace from "../src/lib/connectors/providers/squarespace";
import * as ecwid from "../src/lib/connectors/providers/ecwid";
import * as magento from "../src/lib/connectors/providers/magento";
import { verifyShopifyQuery, verifyShopifyWebhook } from "../src/lib/connectors/oauth";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Route = (url: URL, init?: RequestInit) => unknown;
function mockFetch(route: Route, headers: Record<string, string> = {}) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    const body = route(url, init);
    if (body === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });
  }) as typeof fetch;
  return calls;
}

async function collect(gen: AsyncGenerator<NormalizedOrder[]>) {
  const out: NormalizedOrder[] = [];
  for await (const page of gen) out.push(...page);
  return out;
}

const w: SyncWindow = {};

/* ------------------------------------------------------------------ */

test("normalizer: cancelled, non-US, no address and US-CA handling", () => {
  const r = normalizeOrders(
    [
      { id: "1", number: "#1", createdAt: "2026-03-05T10:00:00Z", cancelled: false, shipTo: { firstName: "A", lastName: "B", state: "Kansas", country: "US", address1: "1 Main" }, lines: [{ id: "a", name: "X", quantity: 2 }, { id: "b", name: "Y", quantity: 0 }] },
      { id: "2", createdAt: "2026-03-06", cancelled: true, shipTo: { state: "KS" }, lines: [{ id: "a", quantity: 1 }] },
      { id: "3", createdAt: "2026-03-06", cancelled: false, shipTo: { state: "ON", country: "CA" }, lines: [{ id: "a", quantity: 1 }] },
      { id: "4", createdAt: "2026-03-06", cancelled: false, shipTo: null, lines: [{ id: "a", quantity: 1 }] },
      { id: "5", createdAt: "2026-04-01", cancelled: false, shipTo: { state: "US-CA", country: "US" }, lines: [{ id: "z", quantity: 3 }] },
    ],
    "woocommerce",
    "shop",
  );
  assert.equal(r.ordersRead, 5);
  assert.equal(r.skippedCancelled, 1);
  assert.deepEqual(r.cancelledOrderIds, ["2"]);
  assert.equal(r.skippedNonUs, 1);
  assert.equal(r.skippedNoAddress, 1);
  assert.equal(r.rows.length, 2, "zero-quantity line dropped");
  assert.equal(r.rows[0].state, "KS");
  assert.equal(r.rows[0].period, "2026-03");
  assert.equal(r.rows[0].customerName, "A B");
  assert.equal(r.rows[0].externalId, "woocommerce:shop:1:a");
  assert.equal(r.rows[1].state, "CA");
});

test("push API schema: snake_case in, cancelled statuses honoured, bad batches rejected", () => {
  const parsed = pushBatchSchema.parse({
    orders: [
      { id: 7, created_at: "2026-05-01T00:00:00Z", status: "refunded", lines: [] },
      { id: "8", created_at: "2026-05-02", ship_to: { state: "TX", city: "Austin" }, lines: [{ id: 1, quantity: "2" }] },
    ],
  });
  const [a, b] = parsed.orders.map(pushToNormalized);
  assert.equal(a.cancelled, true);
  assert.equal(b.cancelled, false);
  assert.equal(b.lines[0].quantity, 2);
  assert.equal(b.lines[0].id, "1");
  assert.equal(pushBatchSchema.safeParse({ orders: [{ id: "x" }] }).success, false);
  assert.equal(pushBatchSchema.safeParse({ orders: Array(251).fill({ id: "1", created_at: "2026-01-01" }) }).success, false);
});

test("shopify: domain normalisation", () => {
  assert.equal(shopify.normalizeShopDomain("https://Suorin-USA.myshopify.com/admin"), "suorin-usa.myshopify.com");
  assert.equal(shopify.normalizeShopDomain("sourin-usa"), "sourin-usa.myshopify.com");
  assert.throws(() => shopify.normalizeShopDomain("suorinusa.com"));
});

test("shopify: client-credentials token, GraphQL paging, cancelled + insurance lines", async () => {
  let page = 0;
  const calls = mockFetch((url, init) => {
    if (url.pathname === "/admin/oauth/access_token") {
      assert.equal(JSON.parse(String(init?.body)).grant_type, "client_credentials");
      return { access_token: "shpat_x", expires_in: 86399 };
    }
    page += 1;
    const vars = JSON.parse(String(init?.body)).variables;
    if (page === 1) assert.equal(vars.q, "created_at:>='2026-01-01'");
    return {
      data: {
        orders: {
          pageInfo: { hasNextPage: page === 1, endCursor: "c1" },
          nodes:
            page === 1
              ? [
                  {
                    id: "gid://shopify/Order/100", name: "#1001", createdAt: "2026-02-03T04:05:06Z", cancelledAt: null, email: "a@b.c", test: false,
                    shippingAddress: { firstName: "Jo", lastName: "Ray", company: null, address1: "1 A St", address2: null, city: "Tulsa", provinceCode: "OK", province: "Oklahoma", zip: "74103", countryCodeV2: "US" },
                    lineItems: { nodes: [
                      { id: "gid://shopify/LineItem/1", title: "Naked 100", variantTitle: "60mL", sku: "N1", quantity: 3, currentQuantity: 2, vendor: "Naked", requiresShipping: true },
                      { id: "gid://shopify/LineItem/2", title: "Route Protection", variantTitle: null, sku: null, quantity: 1, currentQuantity: 1, vendor: "Route", requiresShipping: false },
                    ] },
                  },
                ]
              : [
                  { id: "gid://shopify/Order/101", name: "#1002", createdAt: "2026-02-04T00:00:00Z", cancelledAt: "2026-02-05T00:00:00Z", email: null, test: false, shippingAddress: null, lineItems: { nodes: [] } },
                  { id: "gid://shopify/Order/102", name: "#1003", createdAt: "2026-02-04T00:00:00Z", cancelledAt: null, email: null, test: true, shippingAddress: null, lineItems: { nodes: [] } },
                ],
        },
      },
    };
  });
  const orders = await collect(shopify.orders({ clientId: "id", clientSecret: "s" }, { shop: "x.myshopify.com" }, { since: "2026-01-01" }));
  assert.equal(calls.filter((c) => c.includes("access_token")).length, 1, "token fetched once per sync");
  assert.equal(orders.length, 2, "test order dropped");
  const r = normalizeOrders(orders, "shopify", "s");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].quantity, 2, "currentQuantity, not original");
  assert.equal(r.rows[0].product, "Naked 100 - 60mL");
  assert.equal(r.rows[0].brand, "Naked");
  assert.equal(r.rows[0].externalId, "shopify:s:100:1");
  assert.equal(r.skippedCancelled, 1);
});

test("woocommerce: statuses, empty shipping, paging via X-WP-TotalPages", async () => {
  mockFetch(
    (url) => {
      const page = Number(url.searchParams.get("page"));
      if (page === 2) return [];
      return [
        { id: 5, number: "5", status: "completed", date_created: "2026-06-30T23:30:00", billing: { email: "x@y.z" }, shipping: { first_name: "Al", last_name: "Bo", address_1: "9 Elm", city: "Reno", state: "NV", postcode: "89501", country: "US" }, line_items: [{ id: 11, name: "Pod", sku: "P1", quantity: 4 }] },
        { id: 6, number: "6", status: "cancelled", date_created: "2026-06-30T00:00:00", shipping: { state: "NV", country: "US", address_1: "x" }, line_items: [{ id: 12, name: "Pod", quantity: 1 }] },
        { id: 7, number: "7", status: "processing", date_created: "2026-06-30T00:00:00", shipping: { first_name: "", address_1: "", state: "", country: "" }, line_items: [{ id: 13, name: "Gift card", quantity: 1 }] },
      ];
    },
    { "x-wp-totalpages": "1" },
  );
  const orders = await collect(woocommerce.orders({ consumerKey: "ck_a", consumerSecret: "cs_b" }, { site: "https://s.com", authMode: "query" }, w));
  const r = normalizeOrders(orders, "woocommerce", "s");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].period, "2026-06", "store-local date, not shifted to UTC");
  assert.equal(r.rows[0].orderNumber, "#5");
  assert.equal(r.skippedCancelled, 1);
  assert.equal(r.skippedNoAddress, 1);
});

test("woocommerce: falls back to query-string auth when Basic is stripped", async () => {
  let n = 0;
  globalThis.fetch = (async (input: string) => {
    n += 1;
    const hasQuery = new URL(input).searchParams.has("consumer_key");
    return new Response(hasQuery ? "[]" : '{"code":"woocommerce_rest_cannot_view"}', { status: hasQuery ? 200 : 401 });
  }) as typeof fetch;
  assert.equal(await woocommerce.detectMode("https://s.com", { consumerKey: "ck_a", consumerSecret: "cs_b" }), "query");
  assert.equal(n, 2);
});

test("wix: API-key headers, cursor paging, subdivision + unshippable lines", async () => {
  let page = 0;
  mockFetch((url, init) => {
    const h = init?.headers as Record<string, string>;
    assert.equal(h.Authorization, "IST.key");
    assert.equal(h["wix-site-id"], "site-1");
    page += 1;
    return {
      orders: page === 1
        ? [{ id: "o1", number: "10001", createdDate: "2026-07-01T12:00:00Z", status: "APPROVED", buyerInfo: { email: "e@e.e" },
             shippingInfo: { logistics: { shippingDestination: { address: { subdivision: "US-FL", city: "Miami", postalCode: "33101", country: "US", addressLine: "5 Bay Rd" }, contactDetails: { firstName: "Li", lastName: "Wu" } } } },
             lineItems: [{ id: "l1", quantity: 2, productName: { original: "Disposable" }, physicalProperties: { sku: "D1", shippable: true } }, { id: "l2", quantity: 1, productName: { original: "E-gift" }, physicalProperties: { shippable: false } }] }]
        : [{ id: "o2", createdDate: "2026-07-02T00:00:00Z", status: "CANCELED", lineItems: [] }],
      metadata: { hasNext: page === 1, cursors: { next: page === 1 ? "n" : undefined } },
    };
  });
  const orders = await collect(wix.orders({ apiKey: "IST.key" }, { siteId: "site-1" }, w));
  const r = normalizeOrders(orders, "wix", "w");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].state, "FL");
  assert.equal(r.rows[0].shipToAddress, "5 Bay Rd");
  assert.equal(r.skippedCancelled, 1);
});

test("bigcommerce: split per ship-to address, refunds netted, 204 ends paging", async () => {
  mockFetch((url) => {
    const p = url.pathname;
    if (p.endsWith("/v2/orders")) {
      if (url.searchParams.get("page") === "2") return 204;
      return [
        { id: 900, date_created: "Tue, 10 Mar 2026 15:00:00 +0000", status_id: 11, billing_address: { email: "b@c.d" } },
        { id: 901, date_created: "Tue, 10 Mar 2026 15:00:00 +0000", status_id: 5 },
      ];
    }
    if (p.endsWith("/900/products")) return [
      { id: 1, order_address_id: 71, name: "Tank", sku: "T", quantity: 3, quantity_refunded: 1, brand: "SMOK", type: "physical" },
      { id: 2, order_address_id: 72, name: "Coil", sku: "C", quantity: 5, type: "physical" },
    ];
    if (p.endsWith("/900/shipping_addresses")) return [
      { id: 71, first_name: "A", last_name: "One", street_1: "1 St", city: "Denver", state: "Colorado", zip: "80202", country_iso2: "US" },
      { id: 72, first_name: "B", last_name: "Two", street_1: "2 St", city: "Boise", state: "Idaho", zip: "83702", country_iso2: "US" },
    ];
    throw new Error(`unexpected ${p}`);
  });
  const orders = await collect(bigcommerce.orders({ accessToken: "t" }, { storeHash: "abc123" }, w));
  const r = normalizeOrders(orders, "bigcommerce", "b");
  assert.deepEqual(r.rows.map((x) => [x.state, x.quantity, x.orderNumber]), [["CO", 2, "#900"], ["ID", 5, "#900"]]);
  assert.equal(r.skippedCancelled, 1);
  assert.equal(bigcommerce.normalizeStoreHash("https://api.bigcommerce.com/stores/Abc123/v3/"), "abc123");
});

test("squarespace: cursor paging and cancelled fulfilment", async () => {
  let page = 0;
  mockFetch((url, init) => {
    assert.ok((init?.headers as Record<string, string>)["User-Agent"]);
    page += 1;
    if (page === 2) assert.equal(url.searchParams.get("cursor"), "cur");
    return {
      result: page === 1
        ? [{ id: "s1", orderNumber: "12", createdOn: "2026-08-01T00:00:00Z", fulfillmentStatus: "FULFILLED", shippingAddress: { firstName: "Z", lastName: "Y", address1: "3 Ln", city: "Salem", state: "OR", postalCode: "97301", countryCode: "US" }, lineItems: [{ id: "i1", sku: "S", productName: "Juice", quantity: 1, lineItemType: "PHYSICAL", variantOptions: [{ value: "30mL" }] }] }]
        : [{ id: "s2", orderNumber: "13", createdOn: "2026-08-02T00:00:00Z", fulfillmentStatus: "CANCELED", lineItems: [] }],
      pagination: { hasNextPage: page === 1, nextPageCursor: "cur" },
    };
  });
  const r = normalizeOrders(await collect(squarespace.orders({ apiKey: "k" }, {}, w)), "squarespace", "q");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].product, "Juice - 30mL");
  assert.equal(r.skippedCancelled, 1);
});

test("ecwid: offset paging and payment status", async () => {
  mockFetch((url) => {
    const offset = Number(url.searchParams.get("offset"));
    return offset === 0
      ? { total: 2, count: 2, items: [
          { id: "E1", orderNumber: 1, createDate: "2026-09-01 10:00:00 +0000", paymentStatus: "PAID", shippingPerson: { name: "Sam Lee", street: "4 Oak\nApt 2", city: "Provo", stateOrProvinceCode: "UT", postalCode: "84601", countryCode: "US" }, items: [{ id: 1, sku: "X", name: "Mod", quantity: 1 }] },
          { id: "E2", orderNumber: 2, createDate: "2026-09-01 10:00:00 +0000", paymentStatus: "CANCELLED", items: [] },
        ] }
      : { total: 2, count: 0, items: [] };
  });
  const r = normalizeOrders(await collect(ecwid.orders({ token: "secret_x" }, { storeId: "123" }, w)), "ecwid", "e");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].customerName, "Sam Lee");
  assert.equal(r.rows[0].shipToAddress, "4 Oak, Apt 2");
  assert.equal(r.rows[0].invoiceDate, "2026-09-01");
});

test("magento: configurable parent/child counted once, refunds netted, canceled state", async () => {
  mockFetch(() => ({
    total_count: 2,
    items: [
      { entity_id: 1, increment_id: "000000011", created_at: "2026-05-05 08:00:00", state: "complete", customer_email: "m@m.m",
        items: [{ item_id: 10, sku: "CFG-RED", name: "Kit", qty_ordered: 2, qty_refunded: 1 }, { item_id: 11, sku: "CFG-RED", name: "Kit Red", qty_ordered: 2, parent_item_id: 10 }],
        extension_attributes: { shipping_assignments: [{ shipping: { address: { firstname: "Q", lastname: "R", street: ["7 Pine", "Unit 4"], city: "Omaha", region_code: "NE", postcode: "68102", country_id: "US" } } }] } },
      { entity_id: 2, increment_id: "000000012", created_at: "2026-05-05 08:00:00", state: "canceled", items: [] },
    ],
  }));
  const r = normalizeOrders(await collect(magento.orders({ accessToken: "t" }, { site: "https://m.com" }, w)), "magento", "m");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].quantity, 1);
  assert.equal(r.rows[0].shipToAddress, "7 Pine, Unit 4");
  assert.equal(r.skippedCancelled, 1);
});

test("shopify HMAC: redirect query and webhook body", () => {
  const secret = "hush";
  const params = new URLSearchParams({ code: "abc", shop: "x.myshopify.com", state: "s", timestamp: "1" });
  const msg = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  params.set("hmac", createHmac("sha256", secret).update(msg).digest("hex"));
  assert.equal(verifyShopifyQuery(params, secret), true);
  params.set("shop", "evil.myshopify.com");
  assert.equal(verifyShopifyQuery(params, secret), false);

  const body = '{"shop_domain":"x.myshopify.com"}';
  const sig = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyShopifyWebhook(body, sig, secret), true);
  assert.equal(verifyShopifyWebhook(body + " ", sig, secret), false);
});
