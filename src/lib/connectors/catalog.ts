import type { ProviderId } from "./types";

/**
 * Every platform Quantum can connect, as the UI describes it. No secrets and no
 * server imports - the Stores page and the Marketplace both render from this.
 *
 * `oneClick` is how the button behaves:
 *   - "always": works with nothing but the store address (WooCommerce's own authorize screen).
 *   - "oauth":  works once Quantum's app for that platform is registered and its keys are in env;
 *               until then the key form is shown instead.
 *   - "never":  the platform has no public OAuth for this data; the owner pastes a key.
 */

export type Field = {
  name: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  help?: string;
  optional?: boolean;
};

export type Platform = {
  id: ProviderId;
  name: string;
  /** Brand-ish colour for the tile monogram. */
  color: string;
  monogram: string;
  tagline: string;
  oneClick: "always" | "oauth" | "never";
  /** Env vars that turn the one-button OAuth on. */
  oauthEnv?: string[];
  /** What the one-button flow asks for first. */
  addressField?: Field;
  /** The key-paste fallback (or the only way, for "never"). */
  manualFields: Field[];
  manualHelp: string;
  /** Marketplace plugin that pushes orders in real time, if one exists. */
  pluginSlug?: string;
};

export const PLATFORMS: Platform[] = [
  {
    id: "shopify",
    name: "Shopify",
    color: "#5e8e3e",
    monogram: "S",
    tagline: "Orders, ship-to and line items over the Admin API.",
    oneClick: "oauth",
    oauthEnv: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
    addressField: { name: "shop", label: "Store address", placeholder: "your-store.myshopify.com" },
    manualFields: [
      { name: "shop", label: "Store address", placeholder: "your-store.myshopify.com" },
      { name: "clientId", label: "Client ID", placeholder: "from the app's Settings", optional: true },
      { name: "clientSecret", label: "Client secret", secret: true, optional: true },
      { name: "accessToken", label: "…or an Admin API access token", placeholder: "shpat_…", secret: true, optional: true },
    ],
    manualHelp:
      "Shopify admin → Settings → Apps → Develop apps (or dev.shopify.com) → create an app with read_orders and read_all_orders, install it on the store, and paste its Client ID + Secret. Quantum trades them for a fresh 24-hour token on every sync. An older shpat_ token works too.",
    pluginSlug: "shopify-app",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    color: "#7f54b3",
    monogram: "W",
    tagline: "One click — WooCommerce's own approve screen issues read-only keys.",
    oneClick: "always",
    addressField: { name: "site", label: "WordPress site address", placeholder: "https://yourstore.com" },
    manualFields: [
      { name: "site", label: "WordPress site address", placeholder: "https://yourstore.com" },
      { name: "consumerKey", label: "Consumer key", placeholder: "ck_…" },
      { name: "consumerSecret", label: "Consumer secret", placeholder: "cs_…", secret: true },
    ],
    manualHelp:
      "WooCommerce → Settings → Advanced → REST API → Add key, permission Read. Or skip this and install the Quantum Connect plugin for real-time orders.",
    pluginSlug: "woocommerce",
  },
  {
    id: "wix",
    name: "Wix",
    color: "#0c6efc",
    monogram: "Wx",
    tagline: "Wix eCommerce orders — via the Quantum Wix app or a site API key.",
    oneClick: "oauth",
    oauthEnv: ["WIX_APP_ID", "WIX_APP_SECRET"],
    manualFields: [
      { name: "siteId", label: "Site ID", placeholder: "from the dashboard URL", help: "manage.wix.com/dashboard/<site id>/…" },
      { name: "apiKey", label: "API key", secret: true },
    ],
    manualHelp:
      "Wix account → Account settings → API Keys → Generate API Key with the eCommerce “Read Orders” permission, for this site. The site ID is the long id in the dashboard URL.",
    pluginSlug: "wix-app",
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    color: "#121118",
    monogram: "B",
    tagline: "Orders v2, split per ship-to address.",
    oneClick: "oauth",
    oauthEnv: ["BIGCOMMERCE_CLIENT_ID", "BIGCOMMERCE_CLIENT_SECRET"],
    manualFields: [
      { name: "storeHash", label: "Store hash", placeholder: "abc123xyz", help: "the id in api.bigcommerce.com/stores/<hash>" },
      { name: "accessToken", label: "Access token", secret: true },
    ],
    manualHelp:
      "BigCommerce control panel → Settings → API → Store-level API accounts → Create, with Orders: read-only. Copy the access token and the store hash from the API path.",
    pluginSlug: "bigcommerce-app",
  },
  {
    id: "squarespace",
    name: "Squarespace",
    color: "#111111",
    monogram: "Sq",
    tagline: "Commerce orders with a read-only API key.",
    oneClick: "never",
    manualFields: [
      { name: "site", label: "Store address", placeholder: "https://yourstore.com" },
      { name: "apiKey", label: "API key", secret: true },
    ],
    manualHelp:
      "Squarespace → Settings → Advanced → Developer API Keys → Generate Key, with Orders: Read only. (Squarespace's OAuth is limited to approved partners.)",
  },
  {
    id: "ecwid",
    name: "Ecwid / Lightspeed",
    color: "#0a8fd6",
    monogram: "E",
    tagline: "Store id + a read_orders token.",
    oneClick: "never",
    manualFields: [
      { name: "storeId", label: "Store ID", placeholder: "12345678" },
      { name: "token", label: "Secret token", placeholder: "secret_…", secret: true },
    ],
    manualHelp: "Ecwid admin → Apps → My apps → your custom app → Details: copy the Store ID and the secret_ token (scope read_orders).",
  },
  {
    id: "magento",
    name: "Magento / Adobe Commerce",
    color: "#ee672f",
    monogram: "M",
    tagline: "REST orders through an Integration token.",
    oneClick: "never",
    manualFields: [
      { name: "site", label: "Store address", placeholder: "https://shop.example.com" },
      { name: "accessToken", label: "Integration access token", secret: true },
    ],
    manualHelp:
      "System → Extensions → Integrations → Add New, Resource Access: Sales → Orders. Activate it and copy the Access Token. On 2.4.4+ also enable Stores → Configuration → Services → OAuth → “Allow OAuth Access Tokens to be used as standalone Bearer tokens”.",
  },
  {
    id: "medusa",
    name: "Medusa",
    color: "#1a1a1a",
    monogram: "Me",
    tagline: "Orders and catalog (cost, mL) from a Medusa v2 backend.",
    oneClick: "never",
    manualFields: [],
    manualHelp: "Uses the Medusa form below — backend URL + secret API key.",
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    color: "#df0067",
    monogram: "P",
    tagline: "Planned. Connect PrestaShop via the Connect API or upcoming module.",
    oneClick: "never",
    manualFields: [],
    manualHelp: "Use the Connect API key below to send orders from PrestaShop.",
    pluginSlug: "prestashop-module",
  },
  {
    id: "push",
    name: "Any other platform",
    color: "#0f766e",
    monogram: "API",
    tagline: "Custom sites, POS, marketplaces — push orders to Quantum's Connect API.",
    oneClick: "always",
    manualFields: [],
    manualHelp: "Quantum issues a connection key; your site, plugin or middleware posts orders to it.",
    pluginSlug: "connect-api",
  },
];

export const platform = (id: string) => PLATFORMS.find((p) => p.id === id);

export const providerLabel = (id: string) =>
  platform(id)?.name ?? (id === "shopify_csv" ? "Shopify (CSV)" : id === "upload" ? "Upload" : id);
