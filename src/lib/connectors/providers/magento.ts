import "server-only";
import { ConnectorError, json, request } from "../http";
import type { Credentials, NormalizedOrder, SyncWindow } from "../types";

/**
 * Magento 2 / Adobe Commerce REST. An Integration (System → Extensions →
 * Integrations) with Sales → Operations → Orders: read gives an access token.
 * On 2.4.4+ the store must allow "OAuth Access Tokens to be used as standalone
 * Bearer tokens" (Stores → Configuration → Services → OAuth → Consumer Settings).
 */

type MageItem = {
  item_id: number;
  sku?: string;
  name?: string;
  qty_ordered?: number;
  qty_refunded?: number;
  parent_item_id?: number;
  is_virtual?: number;
};
type MageAddress = {
  firstname?: string;
  lastname?: string;
  company?: string;
  street?: string[];
  city?: string;
  region_code?: string;
  region?: string;
  postcode?: string;
  country_id?: string;
};
type MageOrder = {
  entity_id: number;
  increment_id: string;
  created_at: string;
  status?: string;
  state?: string;
  customer_email?: string;
  items?: MageItem[];
  extension_attributes?: { shipping_assignments?: { shipping?: { address?: MageAddress } }[] };
};

const headers = (c: Credentials) => ({ Authorization: `Bearer ${c.accessToken}`, Accept: "application/json" });

export async function test(c: Credentials, config: Record<string, unknown>) {
  const res = await request("Magento", `${config.site}/rest/V1/orders?searchCriteria[pageSize]=1`, { headers: headers(c) });
  if (res.status === 401) {
    throw new ConnectorError(
      "Magento refused the token. Check the Integration is activated, has Orders read access, and that OAuth tokens may be used as standalone Bearer tokens (Stores → Configuration → Services → OAuth).",
      401,
    );
  }
  await json("Magento", res, "testing the connection");
  return {};
}

export async function* orders(c: Credentials, config: Record<string, unknown>, window: SyncWindow): AsyncGenerator<NormalizedOrder[]> {
  for (let page = 1; page < 5000; page++) {
    const p = new URLSearchParams({
      "searchCriteria[pageSize]": "100",
      "searchCriteria[currentPage]": String(page),
      "searchCriteria[sortOrders][0][field]": "created_at",
      "searchCriteria[sortOrders][0][direction]": "ASC",
    });
    if (window.since) {
      p.set("searchCriteria[filterGroups][0][filters][0][field]", "created_at");
      p.set("searchCriteria[filterGroups][0][filters][0][value]", `${window.since} 00:00:00`);
      p.set("searchCriteria[filterGroups][0][filters][0][conditionType]", "gteq");
    }
    const res = await request("Magento", `${config.site}/rest/V1/orders?${p}`, { headers: headers(c) });
    const body = await json<{ items: MageOrder[]; total_count: number }>("Magento", res, "reading orders");

    yield body.items.map((o) => {
      const a = o.extension_attributes?.shipping_assignments?.[0]?.shipping?.address;
      return {
        id: String(o.entity_id),
        number: `#${o.increment_id}`,
        createdAt: o.created_at,
        cancelled: ["canceled", "closed"].includes(o.state ?? "") || o.status === "canceled",
        email: o.customer_email,
        shipTo: a
          ? {
              firstName: a.firstname,
              lastName: a.lastname,
              company: a.company,
              address1: a.street?.[0],
              address2: a.street?.slice(1).join(", "),
              city: a.city,
              state: a.region_code ?? a.region,
              zip: a.postcode,
              country: a.country_id,
            }
          : null,
        // Configurable products list a parent and a child; the child carries the real SKU,
        // the parent carries the quantity. Keep parents only, so nothing is counted twice.
        lines: (o.items ?? [])
          .filter((i) => !i.parent_item_id && !i.is_virtual)
          .map((i) => ({
            id: String(i.item_id),
            name: i.name,
            sku: i.sku,
            quantity: Number(i.qty_ordered ?? 0) - Number(i.qty_refunded ?? 0),
          })),
      };
    });

    if (page * 100 >= body.total_count || !body.items.length) return;
  }
}
