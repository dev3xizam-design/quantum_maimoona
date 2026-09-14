import "server-only";
import { eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations, medusaProducts, products } from "@/db/schema";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { detectAuthScheme, iterateProducts } from "./client";
import {
  bestNameMatch,
  buildNameIndex,
  candidatesFor,
  normalizeBaseUrl,
  normalizeCode,
  readVariantExtras,
  type AuthScheme,
  type NameCandidate,
} from "./match";

export { normalizeCode, readVariantExtras };

const PROVIDER = "medusa";

/* ------------------------------------------------------------------ */
/* Stored connection                                                   */
/* ------------------------------------------------------------------ */

export async function getIntegration() {
  const [row] = await db.select().from(integrations).where(eq(integrations.provider, PROVIDER)).limit(1);
  return row ?? null;
}

/** Never returns the secret - callers only ever need to know one is present. */
export async function getIntegrationView() {
  const row = await getIntegration();
  if (!row) return null;
  return {
    baseUrl: row.baseUrl,
    secretLast4: row.secretLast4,
    hasSecret: Boolean(row.secretCipher),
    authScheme: row.authScheme,
    status: row.status,
    lastError: row.lastError,
    lastTestedAt: row.lastTestedAt?.toISOString().slice(0, 16).replace("T", " ") ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString().slice(0, 16).replace("T", " ") ?? null,
    stats: row.stats ?? null,
    updatedBy: row.updatedBy,
  };
}

async function requireCredentials() {
  const row = await getIntegration();
  if (!row?.secretCipher) {
    throw new Error("No Medusa key saved yet. Add one in Config → Medusa.");
  }
  return {
    baseUrl: row.baseUrl,
    secret: decryptSecret(row.secretCipher),
    scheme: (row.authScheme as AuthScheme) ?? "basic-colon",
  };
}

/**
 * Save and verify in one step. A key that is not accepted is still stored, but
 * the connection is marked in error with the reason - silently keeping a dead
 * key would be worse than saying so.
 */
export async function saveAndTestIntegration(rawUrl: string, rawSecret: string, actor: string) {
  const baseUrl = normalizeBaseUrl(rawUrl);
  const existing = await getIntegration();

  const secret = rawSecret.trim() || (existing?.secretCipher ? decryptSecret(existing.secretCipher) : "");
  if (!secret) throw new Error("Enter your Medusa secret API key.");

  let scheme: AuthScheme | null = null;
  let error: string | null = null;
  try {
    scheme = (await detectAuthScheme(baseUrl, secret)).scheme;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const values = {
    provider: PROVIDER,
    baseUrl,
    secretCipher: encryptSecret(secret),
    secretLast4: last4(secret),
    authScheme: scheme,
    status: scheme ? "ok" : "error",
    lastError: error,
    lastTestedAt: new Date(),
    updatedBy: actor,
    updatedAt: new Date(),
  };

  await db
    .insert(integrations)
    .values(values)
    .onConflictDoUpdate({ target: integrations.provider, set: values });

  return { ok: Boolean(scheme), scheme, error };
}

export async function deleteIntegration() {
  await db.delete(integrations).where(eq(integrations.provider, PROVIDER));
}

/* ------------------------------------------------------------------ */
/* Catalog sync                                                        */
/* ------------------------------------------------------------------ */

export type SyncResult = {
  products: number;
  variants: number;
  withBarcode: number;
  withCost: number;
  withMl: number;
  matched: number;
  matchedByBarcode: number;
  matchedBySku: number;
  matchedByName: number;
  ambiguousNames: number;
  unmatchedVariants: number;
  unmatchedSoldSkus: string[];
};

const CHUNK = 200;

export async function syncMedusaCatalog(): Promise<SyncResult> {
  const { baseUrl, secret, scheme } = await requireCredentials();

  const rows: (typeof medusaProducts.$inferInsert)[] = [];
  let productCount = 0;

  for await (const page of iterateProducts(baseUrl, secret, scheme)) {
    productCount += page.length;
    for (const product of page) {
      for (const variant of product.variants ?? []) {
        const { cost, ml, systemType, meta } = readVariantExtras(variant, product.metadata);
        rows.push({
          variantId: variant.id,
          productId: product.id,
          productTitle: product.title ?? null,
          variantTitle: variant.title ?? null,
          sku: variant.sku ?? null,
          barcode: variant.barcode ?? null,
          ean: variant.ean ?? null,
          upc: variant.upc ?? null,
          wholesaleCost: cost === null ? null : String(cost),
          liquidMl: ml === null ? null : String(ml),
          systemType,
          metadata: meta as Record<string, unknown>,
          syncedAt: new Date(),
        });
      }
    }
  }

  /* Replace the mirror wholesale - a variant deleted in Medusa should vanish
     here - but carry rejected matches across, or a re-sync would undo them. */
  const rejected = new Set(
    (await db.select({ variantId: medusaProducts.variantId }).from(medusaProducts).where(dsql`${medusaProducts.matchRejected}`))
      .map((r) => r.variantId),
  );
  for (const row of rows) {
    if (rejected.has(row.variantId)) row.matchRejected = true;
  }
  await db.delete(medusaProducts);
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(medusaProducts).values(rows.slice(i, i + CHUNK)).onConflictDoNothing();
  }

  const match = await matchMedusaToProducts();

  const stats: SyncResult = {
    products: productCount,
    variants: rows.length,
    withBarcode: rows.filter((r) => r.barcode || r.upc || r.ean).length,
    withCost: rows.filter((r) => r.wholesaleCost).length,
    withMl: rows.filter((r) => r.liquidMl).length,
    ...match,
  };

  await db
    .update(integrations)
    .set({ lastSyncedAt: new Date(), stats: stats as unknown as Record<string, unknown>, status: "ok", lastError: null })
    .where(eq(integrations.provider, PROVIDER));

  return stats;
}

/**
 * Link Medusa variants to the catalog the tax engines read. `products.sku` is
 * whatever Avalara reports - usually a barcode - so barcode/UPC/EAN are tried
 * before the Medusa SKU.
 */
export async function matchMedusaToProducts() {
  const [variants, quantum] = await Promise.all([
    db.select().from(medusaProducts),
    db
      .select({ sku: products.sku, units: products.unitsSold, description: products.description })
      .from(products),
  ]);

  const bySku = new Map<string, string>(); // normalized code -> real products.sku
  for (const p of quantum) {
    const n = normalizeCode(p.sku);
    if (n) bySku.set(n, p.sku);
  }

  /* Name matching only ever runs against products that actually sold - those
     are the only ones a wholesale cost can change a return for, and it keeps
     the candidate pool small and meaningful. */
  const nameCandidates: NameCandidate[] = quantum
    .filter((p) => Number(p.units) !== 0 && p.description)
    .map((p) => ({ key: p.sku, name: p.description }));
  const byKey = new Map(nameCandidates.map((c) => [c.key, c]));
  const nameIndex = buildNameIndex(nameCandidates);

  let matched = 0;
  let matchedByBarcode = 0;
  let matchedBySku = 0;
  let matchedByName = 0;
  let ambiguousNames = 0;

  const updates: {
    id: number;
    matchedSku: string | null;
    matchMethod: string;
    matchScore: number | null;
  }[] = [];
  const matchedTargets = new Set<string>();

  for (const v of variants) {
    // A match a person rejected stays rejected.
    if (v.matchRejected) {
      updates.push({ id: v.id, matchedSku: null, matchMethod: "rejected", matchScore: null });
      continue;
    }

    const codes: [string, string | null][] = [
      ["barcode", v.barcode],
      ["upc", v.upc],
      ["ean", v.ean],
      ["sku", v.sku],
    ];

    let hit: { sku: string; method: string; score: number | null } | null = null;
    for (const [method, raw] of codes) {
      const n = normalizeCode(raw);
      if (!n) continue;
      const target = bySku.get(n);
      if (target) {
        hit = { sku: target, method, score: null };
        break;
      }
    }

    /* No code matched - fall back to the product name. */
    if (!hit) {
      const label = [v.productTitle, v.variantTitle].filter(Boolean).join(" ");
      const result = bestNameMatch(label, candidatesFor(label, nameIndex, byKey));
      if (result?.ambiguous) {
        ambiguousNames += 1;
        updates.push({
          id: v.id,
          matchedSku: null,
          matchMethod: "ambiguous",
          matchScore: Math.round(result.score * 10000) / 10000,
        });
        continue;
      }
      if (result?.key) {
        hit = { sku: result.key, method: "name", score: Math.round(result.score * 10000) / 10000 };
      }
    }

    if (hit) {
      matched += 1;
      matchedTargets.add(hit.sku);
      if (hit.method === "sku") matchedBySku += 1;
      else if (hit.method === "name") matchedByName += 1;
      else matchedByBarcode += 1;
    }

    updates.push({
      id: v.id,
      matchedSku: hit?.sku ?? null,
      matchMethod: hit?.method ?? "none",
      matchScore: hit?.score ?? null,
    });
  }

  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    await db.execute(dsql`
      UPDATE medusa_products AS m
      SET matched_sku = v.matched_sku,
          match_method = v.match_method,
          match_score = v.match_score
      FROM (VALUES ${dsql.join(
        slice.map(
          (u) =>
            dsql`(${u.id}::int, ${u.matchedSku}::text, ${u.matchMethod}::text, ${u.matchScore}::numeric)`,
        ),
        dsql`, `,
      )}) AS v(id, matched_sku, match_method, match_score)
      WHERE m.id = v.id
    `);
  }

  const soldSkus = quantum.filter((p) => Number(p.units) !== 0).map((p) => p.sku);
  return {
    matched,
    matchedByBarcode,
    matchedBySku,
    matchedByName,
    ambiguousNames,
    unmatchedVariants: variants.length - matched,
    unmatchedSoldSkus: soldSkus.filter((s) => !matchedTargets.has(s)).slice(0, 20),
  };
}

/** A person overriding the matcher, in either direction. */
export async function setMatchDecision(
  variantId: number,
  decision: "reject" | "accept",
  sku?: string,
) {
  if (decision === "reject") {
    await db
      .update(medusaProducts)
      .set({ matchRejected: true, matchedSku: null, matchMethod: "rejected", matchScore: null })
      .where(eq(medusaProducts.id, variantId));
    return;
  }
  await db
    .update(medusaProducts)
    .set({ matchRejected: false, matchedSku: sku ?? null, matchMethod: "manual", matchScore: null })
    .where(eq(medusaProducts.id, variantId));
}

/** Cost / mL / open-closed that Medusa supplies, keyed by products.sku. */
export async function medusaEnrichmentBySku() {
  const rows = await db
    .select()
    .from(medusaProducts)
    .where(dsql`${medusaProducts.matchedSku} IS NOT NULL`);

  const map = new Map<
    string,
    { cost: number | null; ml: number | null; systemType: string | null; viaName: boolean }
  >();
  for (const r of rows) {
    if (!r.matchedSku) continue;
    const existing = map.get(r.matchedSku);
    map.set(r.matchedSku, {
      cost: r.wholesaleCost ? Number(r.wholesaleCost) : (existing?.cost ?? null),
      ml: r.liquidMl ? Number(r.liquidMl) : (existing?.ml ?? null),
      systemType: r.systemType ?? existing?.systemType ?? null,
      viaName: r.matchMethod === "name" || (existing?.viaName ?? false),
    });
  }
  return map;
}
