/**
 * The shape every store platform is reduced to before it touches the PACT feed.
 *
 * Each platform's API disagrees on almost everything - where the ship-to lives,
 * whether a state is "CA" or "California", what "cancelled" is called - so each
 * connector translates into this once, and one normalizer (normalize.ts) turns it
 * into shipment rows. That keeps the skip rules identical across every store:
 * an order Shopify drops must be dropped the same way on WooCommerce.
 *
 * No server-only imports here: the plugin push endpoint and the unit tests use it.
 */

export type ProviderId =
  | "medusa"
  | "shopify"
  | "woocommerce"
  | "wix"
  | "bigcommerce"
  | "squarespace"
  | "ecwid"
  | "magento"
  | "push";

export type NormalizedAddress = {
  firstName?: string | null;
  lastName?: string | null;
  /** Used when the platform only gives one name field. */
  name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  /** Code or full name - normalizeState handles both. */
  state?: string | null;
  zip?: string | null;
  /** ISO-2. Missing is treated as US, as the Medusa sync always has. */
  country?: string | null;
};

export type NormalizedLine = {
  id: string;
  name?: string | null;
  sku?: string | null;
  brand?: string | null;
  quantity: number;
};

export type NormalizedOrder = {
  id: string;
  /** What the merchant calls it (#1001). Falls back to id. */
  number?: string | null;
  /** ISO timestamp or "YYYY-MM-DD ..." - only the date part is used. */
  createdAt: string | null;
  /** Cancelled / refunded / failed / never paid - it never shipped. */
  cancelled: boolean;
  email?: string | null;
  shipTo: NormalizedAddress | null;
  lines: NormalizedLine[];
};

/** Where a sync picks up from. Absent = full history. */
export type SyncWindow = { since?: string };

/** Credentials are opaque to everything but their own connector. */
export type Credentials = Record<string, string>;
