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

/* ------------------------------------------------------------------ */
/* Name matching                                                       */
/* ------------------------------------------------------------------ */

/**
 * A fallback for when Medusa carries no barcode. It is deliberately cautious:
 * a wrong name match assigns a wrong wholesale cost, which produces a wrong
 * excise return - quietly. So it only accepts a match that is both strong AND
 * clearly better than the runner-up, and it records the score so every one can
 * be reviewed.
 */

/** Words that carry no distinguishing information. */
const NAME_STOPWORDS = new Set([
  "THE", "A", "AN", "AND", "OR", "FOR", "WITH", "OF", "BY", "IN", "ON", "TO",
  "NEW", "ORIGINAL", "AUTHENTIC", "GENUINE", "BRAND", "OEM", "PCS", "PC",
]);

export function nameTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .toUpperCase()
        .replace(/[^A-Z0-9.]+/g, " ")
        .split(" ")
        .map((t) => t.replace(/^\.+|\.+$/g, ""))
        .filter((t) => t.length > 0 && !NAME_STOPWORDS.has(t)),
    ),
  ];
}

/** A token distinctive enough that sharing it means something. */
function isStrong(token: string): boolean {
  return /\d/.test(token) || token.length >= 4;
}

/** Dice coefficient over token sets: 0 (nothing shared) to 1 (identical). */
export function scoreNames(a: string | null | undefined, b: string | null | undefined): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;

  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t));
  if (!shared.some(isStrong)) return 0; // only filler words in common

  return (2 * shared.length) / (ta.length + tb.length);
}

/** Accept only a strong match that clearly beats the runner-up. */
export const NAME_MATCH_THRESHOLD = 0.62;
export const NAME_MATCH_MARGIN = 0.08;

export type NameCandidate = { key: string; name: string | null };

export type NameMatch =
  | { key: string; score: number; ambiguous: false }
  | { key: null; score: number; ambiguous: true; rivals: string[] }
  | null;

export function bestNameMatch(name: string | null | undefined, candidates: NameCandidate[]): NameMatch {
  if (!name || !candidates.length) return null;

  const scored = candidates
    .map((c) => ({ key: c.key, score: scoreNames(name, c.name) }))
    .filter((c) => c.score >= NAME_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  const [best, runnerUp] = scored;
  if (runnerUp && best.score - runnerUp.score < NAME_MATCH_MARGIN) {
    // Two products this similar are usually colour or flavour variants of one
    // another. Picking either would be a coin flip, so pick neither.
    return {
      key: null,
      score: best.score,
      ambiguous: true,
      rivals: scored.slice(0, 3).map((s) => s.key),
    };
  }

  return { key: best.key, score: best.score, ambiguous: false };
}

/** Token -> candidate keys, so scoring only runs on plausible pairs. */
export function buildNameIndex(candidates: NameCandidate[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const c of candidates) {
    for (const token of nameTokens(c.name)) {
      if (!isStrong(token)) continue;
      const list = index.get(token) ?? [];
      list.push(c.key);
      index.set(token, list);
    }
  }
  return index;
}

export function candidatesFor(
  name: string | null | undefined,
  index: Map<string, string[]>,
  byKey: Map<string, NameCandidate>,
): NameCandidate[] {
  const keys = new Set<string>();
  for (const token of nameTokens(name)) {
    if (!isStrong(token)) continue;
    for (const key of index.get(token) ?? []) keys.add(key);
  }
  return [...keys].map((k) => byKey.get(k)!).filter(Boolean);
}
