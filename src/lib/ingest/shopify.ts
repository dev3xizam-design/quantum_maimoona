/**
 * Shopify "Orders" CSV -> PACT shipment rows.
 *
 * The export repeats an order once per line item, but the header fields - order
 * name, date, and the whole shipping address - appear ONLY on the first row of
 * each order. Every following row leaves them blank. Reading it row by row
 * would file a PACT report with one address and a pile of blanks, so the
 * header is carried down until the next order begins.
 *
 * Two layouts are read. Shopify's own CSV names each line ("Lineitem name",
 * "Lineitem sku"). A Matrixify export ("Line: Quantity", "Line: Vendor",
 * "Line: Product Tags") carries no line name at all, so the brand comes from
 * the vendor, the product from the tags, and a bottle's mL from its size tag.
 *
 * Isomorphic: parsed in the browser like every other upload.
 */

import { normalizeState } from "@/lib/states";

const canon = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Shopify's own column names, plus the variations exports come back with. */
const FIELDS: Record<string, string[]> = {
  orderName: ["name", "ordername", "ordernumber", "order"],
  email: ["email", "contactemail"],
  createdAt: ["createdat", "paidat", "processedat", "date"],
  financialStatus: ["financialstatus"],
  quantity: ["lineitemquantity", "linequantity", "quantity", "qty"],
  productName: ["lineitemname", "productname", "lineitemtitle"],
  sku: ["lineitemsku", "linesku", "sku"],
  vendor: ["lineitemvendor", "linevendor", "vendor"],
  tags: ["lineproducttags", "lineitemproducttags"],
  shippingName: ["shippingname", "shiptoname"],
  customerFirstName: ["customerfirstname", "shippingfirstname"],
  customerLastName: ["customerlastname", "shippinglastname"],
  shippingAddress1: ["shippingaddress1", "shippingstreet", "shiptoaddress1", "address1"],
  shippingAddress2: ["shippingaddress2", "shiptoaddress2", "address2"],
  shippingCity: ["shippingcity", "shiptocity", "city"],
  shippingZip: ["shippingzip", "shiptozip", "zip", "postalcode"],
  shippingProvince: ["shippingprovince", "shippingprovincename", "shiptoprovince", "province", "state"],
  shippingCountry: ["shippingcountry", "shippingcountrycode", "country"],
  billingName: ["billingname"],
};

/** Fields that appear only on an order's first row and must be carried down. */
const ORDER_LEVEL = [
  "orderName", "email", "createdAt", "financialStatus", "shippingName",
  "shippingAddress1", "shippingAddress2", "shippingCity", "shippingZip",
  "shippingProvince", "shippingCountry", "billingName",
  "customerFirstName", "customerLastName",
] as const;

/**
 * Lines that ride along on an order but are not a tobacco product: Shopify's
 * package-protection add-on (vendor "MV DYNAMIC", tagged self-insurance) and
 * Route shipping insurance. PACT reports products shipped, not fees.
 */
const NON_PRODUCT_VENDORS = new Set(["MV DYNAMIC", "ROUTE"]);
const NON_PRODUCT_TAGS = /\bself-insurance\b/i;

/**
 * Bottled e-liquid brands whose leading numeric tag is the bottle size in mL
 * ("30, San Francisco Ban" on "... - 30mL"). Checked against the catalog. Not
 * RedHawk: its "10" and "5" tags sit on disposables and pod packs, not bottles.
 */
const BOTTLE_ML_VENDORS = new Set(["DRIPFIRE", "NAKED 100", "7 DAZE"]);

/** Tags that describe the store, not the product. */
const NOISE_TAGS = /^(san francisco ban|state-restricted|coming-soon|bfcm\w*|\d+(\.\d+)?)$/i;

function describeFromTags(vendor: string, tags: string): { product: string | null; mlPerUnit: number } {
  const list = tags.split(",").map((t) => t.trim()).filter(Boolean);
  const size = list.find((t) => /^\d+(\.\d+)?$/.test(t));
  const mlPerUnit = size && BOTTLE_ML_VENDORS.has(vendor.toUpperCase()) ? Number(size) : 0;
  // "Suorin" + "Suorin Air" reads as "Suorin Air"; "Suorin" + "Drop2" as "Suorin Drop2".
  const line = list.filter((t) => !NOISE_TAGS.test(t)).join(" ");
  let product = line.toUpperCase().startsWith(vendor.toUpperCase()) ? line : `${vendor} ${line}`;
  if (mlPerUnit) product += ` ${mlPerUnit} mL e-liquid`;
  product = product.replace(/\s+/g, " ").trim();
  return { product: product || null, mlPerUnit };
}

export type ShopifyShipment = {
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
  mlTotal: number;
  sku: string | null;
};

export type ShopifyParseResult = {
  rows: ShopifyShipment[];
  orders: number;
  skippedNoState: number;
  skippedNonUs: number;
  skippedRefunded: number;
  skippedNonProduct: number;
  missingColumns: string[];
  periods: string[];
};

function buildMap(headers: string[]): Record<string, string> {
  const byCanon = new Map(headers.map((h) => [canon(h), h]));
  const map: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(FIELDS)) {
    for (const a of aliases) {
      const hit = byCanon.get(a);
      if (hit) {
        map[field] = hit;
        break;
      }
    }
  }
  return map;
}

function toDate(v: string | undefined): string | null {
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseShopifyOrders(
  records: Record<string, string>[],
  headers: string[],
  storeLabel: string,
): ShopifyParseResult {
  const map = buildMap(headers);
  const required = ["orderName", "quantity", "shippingProvince"];
  const missingColumns = required.filter((f) => !map[f]);
  if (missingColumns.length) {
    return {
      rows: [], orders: 0, skippedNoState: 0, skippedNonUs: 0, skippedRefunded: 0,
      skippedNonProduct: 0, missingColumns, periods: [],
    };
  }

  const get = (row: Record<string, string>, field: string) =>
    map[field] ? (row[map[field]] ?? "").trim() : "";

  const carried: Record<string, string> = {};
  const rows: ShopifyShipment[] = [];
  const seenOrders = new Set<string>();
  const lineCounter = new Map<string, number>();
  let skippedNoState = 0;
  let skippedNonUs = 0;
  let skippedRefunded = 0;
  let skippedNonProduct = 0;

  for (const record of records) {
    // A non-empty order name starts a new order and resets the carried header.
    const thisOrder = get(record, "orderName");
    if (thisOrder) {
      for (const field of ORDER_LEVEL) carried[field] = get(record, field);
    }

    const orderName = carried.orderName;
    if (!orderName) continue;

    const quantity = Number((get(record, "quantity") || "0").replace(/[^0-9.-]/g, ""));
    if (!quantity) continue;

    const vendor = get(record, "vendor");
    const tags = get(record, "tags");
    if (NON_PRODUCT_VENDORS.has(vendor.toUpperCase()) || NON_PRODUCT_TAGS.test(tags)) {
      skippedNonProduct += 1;
      continue;
    }

    const financial = (carried.financialStatus ?? "").toLowerCase();
    if (financial.includes("refund") || financial.includes("void")) {
      skippedRefunded += 1;
      continue;
    }

    const country = (carried.shippingCountry ?? "").trim().toUpperCase();
    if (country && !["US", "USA", "UNITED STATES"].includes(country)) {
      skippedNonUs += 1;
      continue;
    }

    const state = normalizeState(carried.shippingProvince);
    if (!state) {
      skippedNoState += 1;
      continue;
    }

    const date = toDate(carried.createdAt);
    if (!date) {
      skippedNoState += 1;
      continue;
    }

    seenOrders.add(orderName);
    const index = (lineCounter.get(orderName) ?? 0) + 1;
    lineCounter.set(orderName, index);

    const named = get(record, "productName");
    const fromTags = describeFromTags(vendor, tags);
    const customer =
      carried.shippingName ||
      [carried.customerFirstName, carried.customerLastName].filter(Boolean).join(" ") ||
      carried.billingName ||
      carried.email;

    rows.push({
      externalId: `shopify:${storeLabel}:${orderName}:${index}`,
      orderNumber: orderName,
      period: date.slice(0, 7),
      state,
      customerName: customer || null,
      shipToAddress:
        [carried.shippingAddress1, carried.shippingAddress2].filter(Boolean).join(", ") || null,
      shipToCity: carried.shippingCity || null,
      shipToState: state,
      shipToZip: carried.shippingZip || null,
      invoiceDate: date,
      invoiceNumber: orderName,
      product: named || fromTags.product,
      brand: vendor || null,
      quantity,
      mlTotal: named ? 0 : fromTags.mlPerUnit * quantity,
      sku: get(record, "sku") || null,
    });
  }

  return {
    rows,
    orders: seenOrders.size,
    skippedNoState,
    skippedNonUs,
    skippedRefunded,
    skippedNonProduct,
    missingColumns: [],
    periods: [...new Set(rows.map((r) => r.period))].sort(),
  };
}
