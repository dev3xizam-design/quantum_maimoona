/**
 * Pure helpers shared by the Medusa client and the matcher. No server-only
 * import here so they stay directly testable and reusable.
 */

export type AuthScheme = "basic-colon" | "basic-raw" | "bearer";

/** Medusa v2 secret API keys authenticate with HTTP Basic, not Bearer. */
export function authHeader(secret: string, scheme: AuthScheme): string {
  switch (scheme) {
    case "basic-colon":
      return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
    case "basic-raw":
      return `Basic ${Buffer.from(secret).toString("base64")}`;
    case "bearer":
      return `Bearer ${secret}`;
  }
}

export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim();
  if (!url) throw new Error("Enter your Medusa backend URL.");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  // People paste the admin dashboard URL; the API lives at the root.
  url = url.replace(/\/app(\/.*)?$/i, "");
  return url;
}

/** Barcodes get typed with spaces and dashes; compare them without. */
export function normalizeCode(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim().toUpperCase().replace(/[\s-]/g, "");
  return s === "" ? null : s;
}

export type MedusaVariant = {
  id: string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  ean?: string | null;
  upc?: string | null;
  metadata?: Record<string, unknown> | null;
  product_id?: string | null;
};

export type MedusaProduct = {
  id: string;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  variants?: MedusaVariant[] | null;
};

const numberFrom = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

function pick(meta: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!meta) return undefined;
  const lower = new Map(
    Object.entries(meta).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), v]),
  );
  for (const k of keys) {
    const hit = lower.get(k);
    if (hit !== undefined && hit !== null && hit !== "") return hit;
  }
  return undefined;
}

/**
 * Medusa has no cost field of its own, so cost, volume and open/closed live in
 * metadata by convention. Naming varies, so matching is loose - but nothing is
 * invented: a key that is not there yields null.
 */
export function readVariantExtras(
  variant: MedusaVariant,
  productMeta: Record<string, unknown> | null | undefined,
) {
  const meta = { ...(productMeta ?? {}), ...(variant.metadata ?? {}) };
  const cost = numberFrom(
    pick(meta, ["wholesalecost", "cost", "costprice", "unitcost", "buyprice", "supplierprice"]),
  );
  const ml = numberFrom(
    pick(meta, ["liquidml", "ml", "volumeml", "volume", "eliquidml", "juiceml"]),
  );
  const rawSystem = pick(meta, ["systemtype", "system", "openclosed", "devicetype"]);
  const systemType =
    typeof rawSystem === "string"
      ? rawSystem.toUpperCase().includes("CLOS")
        ? "CLOSED"
        : rawSystem.toUpperCase().includes("OPEN")
          ? "OPEN"
          : null
      : null;
  return { cost, ml, systemType, meta };
}
