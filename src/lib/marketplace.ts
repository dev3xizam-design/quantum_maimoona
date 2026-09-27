/**
 * What the Marketplace lists. Honest about status: "available" means it works
 * today from this Quantum; a public store listing (WordPress.org, Shopify App
 * Store, ...) is tracked separately in `listing` because it is a review process
 * we do not control.
 */

export type Listing = { store: string; status: "planned" | "submitted" | "live"; url?: string };

export type MarketplaceItem = {
  slug: string;
  name: string;
  platform: string;
  /** Matches connectors/catalog.ts, for the colour + monogram. */
  platformId: string;
  kind: "plugin" | "app" | "api" | "connector";
  summary: string;
  version?: string;
  /** A downloadable plugin directory under /plugins. */
  download?: { dir: string; file: string };
  /** For apps: they install via one-button OAuth rather than a download. */
  oauthProvider?: string;
  listing?: Listing;
  status: "available" | "coming-soon";
  features: string[];
  install: string[];
  sends: string;
};

export const MARKETPLACE: MarketplaceItem[] = [
  {
    slug: "woocommerce",
    name: "Quantum Connect for WooCommerce",
    platform: "WordPress / WooCommerce",
    platformId: "woocommerce",
    kind: "plugin",
    summary: "Real-time order push from any WooCommerce store, with one-button pairing and backfill.",
    version: "1.0.0",
    download: { dir: "quantum-connect-woocommerce", file: "quantum-connect-woocommerce.zip" },
    listing: { store: "WordPress.org plugin directory", status: "planned" },
    status: "available",
    features: [
      "One-button “Connect to Quantum” — no keys to copy",
      "Sends each order the moment it is placed or changes status",
      "Cancelled and refunded orders are removed from PACT automatically",
      "Backfill past orders from any date, in batches",
      "Hourly retry if Quantum is unreachable; HPOS compatible",
    ],
    install: [
      "Download the zip below (it is pre-set to this Quantum’s address).",
      "WordPress admin → Plugins → Add New → Upload Plugin → choose the zip → Activate.",
      "WooCommerce → Quantum Connect → Connect to Quantum, then approve the store here.",
      "Optionally press “Send orders” to backfill history.",
    ],
    sends:
      "Order id and number, date, status, billing email, shipping name/company/address, and each shipped line’s name, SKU, brand and quantity. Never payment details.",
  },
  {
    slug: "shopify-app",
    name: "Quantum for Shopify",
    platform: "Shopify",
    platformId: "shopify",
    kind: "app",
    summary: "Install on any Shopify store with one click; orders sync over the Admin API.",
    oauthProvider: "shopify",
    listing: { store: "Shopify App Store", status: "planned" },
    status: "available",
    features: [
      "One-click install through Shopify’s own approve screen",
      "Full order history (read_all_orders) plus incremental syncs",
      "Replaces Matrixify/CSV-imported rows for the same orders — never double-counts",
      "Mandatory Shopify compliance webhooks already implemented",
    ],
    install: [
      "Stores → Connect a store → Shopify → enter the .myshopify.com address → Connect Shopify.",
      "Approve read access on Shopify. You land back in Quantum with orders syncing.",
      "Until the Quantum Shopify app is registered, connect with the store’s own app Client ID + Secret instead — same data.",
    ],
    sends: "Quantum reads orders (read_orders, read_all_orders) and products; it writes nothing to Shopify.",
  },
  {
    slug: "wix-app",
    name: "Quantum for Wix",
    platform: "Wix",
    platformId: "wix",
    kind: "app",
    summary: "Wix eCommerce orders via the Quantum Wix app, or a site API key today.",
    oauthProvider: "wix",
    listing: { store: "Wix App Market", status: "planned" },
    status: "available",
    features: ["One-click install once the Wix app is registered", "Works today with a Wix API key + site ID"],
    install: [
      "Stores → Connect a store → Wix.",
      "With the app registered: press Connect Wix and approve. Without it: paste an API key with Read Orders and the site ID.",
    ],
    sends: "Quantum reads eCommerce orders; nothing is written to Wix.",
  },
  {
    slug: "bigcommerce-app",
    name: "Quantum for BigCommerce",
    platform: "BigCommerce",
    platformId: "bigcommerce",
    kind: "app",
    summary: "Orders v2 split per ship-to address — via the Quantum app or a store API account.",
    oauthProvider: "bigcommerce",
    listing: { store: "BigCommerce App Marketplace", status: "planned" },
    status: "available",
    features: [
      "Multi-address orders land each line in the state it shipped to",
      "Installs from BigCommerce wait for approval in Quantum before feeding any report",
    ],
    install: [
      "Stores → Connect a store → BigCommerce.",
      "Paste a store-level API account token (Orders: read-only) and the store hash, or install the Quantum app once registered.",
    ],
    sends: "Quantum reads orders, order products and shipping addresses.",
  },
  {
    slug: "connect-api",
    name: "Quantum Connect API",
    platform: "Any platform",
    platformId: "push",
    kind: "api",
    summary: "Push orders from anything — custom sites, POS, marketplaces, middleware, Zapier/Make.",
    version: "v1",
    status: "available",
    features: [
      "One JSON endpoint, idempotent — resend freely",
      "Send status “cancelled” to remove an order from PACT",
      "Up to 250 orders per request",
    ],
    install: [
      "Stores → Connect a store → Any other platform → Create connection key.",
      "POST orders to /api/plugin/v1/orders with the key as a Bearer token (example below).",
    ],
    sends: "Whatever you send, in the documented format.",
  },
  {
    slug: "medusa",
    name: "Medusa connector",
    platform: "Medusa v2",
    platformId: "medusa",
    kind: "connector",
    summary: "Orders plus catalog (wholesale cost, mL, open/closed) from a Medusa backend.",
    status: "available",
    features: ["Order sync for PACT", "Catalog sync with barcode and name matching"],
    install: ["Stores → Medusa stores → Add a Medusa store → backend URL + secret API key."],
    sends: "Quantum reads orders and products with a secret API key.",
  },
  {
    slug: "magento-module",
    name: "Quantum for Magento / Adobe Commerce",
    platform: "Magento 2",
    platformId: "magento",
    kind: "plugin",
    summary: "Real-time push module. Until it ships, the built-in REST connector syncs the same orders.",
    listing: { store: "Adobe Commerce Marketplace", status: "planned" },
    status: "coming-soon",
    features: ["Use Stores → Connect a store → Magento today (Integration token)"],
    install: [],
    sends: "",
  },
  {
    slug: "prestashop-module",
    name: "Quantum for PrestaShop",
    platform: "PrestaShop",
    platformId: "push",
    kind: "plugin",
    summary: "Planned. Today, PrestaShop stores can post orders to the Connect API.",
    listing: { store: "PrestaShop Addons", status: "planned" },
    status: "coming-soon",
    features: [],
    install: [],
    sends: "",
  },
];

export const marketplaceItem = (slug: string) => MARKETPLACE.find((m) => m.slug === slug);
