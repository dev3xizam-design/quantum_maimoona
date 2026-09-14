import "server-only";
import { and, eq, inArray, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations, medusaProducts, products, shipments } from "@/db/schema";
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
import { iterateOrders, mapOrdersToShipments, type ShipmentRowInput } from "./orders";

export { normalizeCode, readVariantExtras };

const CHUNK = 200;

export function slugify(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "store"
  );
}

/* ------------------------------------------------------------------ */
/* Connections                                                         */
/* ------------------------------------------------------------------ */

export type ConnectionView = {
  id: number;
  slug: string;
  name: string;
  baseUrl: string;
  secretLast4: string | null;
  hasSecret: boolean;
  authScheme: string | null;
  status: string;
  active: boolean;
  syncOrders: boolean;
  syncCatalog: boolean;
  lastError: string | null;
  lastTestedAt: string | null;
  lastSyncedAt: string | null;
  ordersSyncedAt: string | null;
  stats: Record<string, unknown> | null;
  orderStats: Record<string, unknown> | null;
};

const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : null);

/** Never returns a secret - only whether one is present and its last four. */
export async function listConnections(): Promise<ConnectionView[]> {
  const rows = await db.select().from(integrations).orderBy(integrations.name);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    baseUrl: r.baseUrl,
    secretLast4: r.secretLast4,
    hasSecret: Boolean(r.secretCipher),
    authScheme: r.authScheme,
    status: r.status,
    active: r.active,
    syncOrders: r.syncOrders,
    syncCatalog: r.syncCatalog,
    lastError: r.lastError,
    lastTestedAt: fmt(r.lastTestedAt),
    lastSyncedAt: fmt(r.lastSyncedAt),
    ordersSyncedAt: fmt(r.ordersSyncedAt),
    stats: r.stats ?? null,
    orderStats: r.orderStats ?? null,
  }));
}

async function credentialsFor(id: number) {
  const [row] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
  if (!row) throw new Error("That connection no longer exists.");
  if (!row.secretCipher) throw new Error(`No API key saved for ${row.name}.`);
  return {
    row,
    baseUrl: row.baseUrl,
    secret: decryptSecret(row.secretCipher),
    scheme: (row.authScheme as AuthScheme) ?? "basic-colon",
  };
}

export async function saveConnection(input: {
  id?: number;
  name: string;
  baseUrl: string;
  secret: string;
  syncOrders: boolean;
  syncCatalog: boolean;
  actor: string;
}) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const name = input.name.trim() || baseUrl.replace(/^https?:\/\//, "");

  let existing = null;
  if (input.id) {
    [existing] = await db.select().from(integrations).where(eq(integrations.id, input.id)).limit(1);
  }

  const secret =
    input.secret.trim() || (existing?.secretCipher ? decryptSecret(existing.secretCipher) : "");
  if (!secret) throw new Error("Enter the store's secret API key.");

  let scheme: AuthScheme | null = null;
  let error: string | null = null;
  try {
    scheme = (await detectAuthScheme(baseUrl, secret)).scheme;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const base = {
    name,
    baseUrl,
    provider: "medusa",
    secretCipher: encryptSecret(secret),
    secretLast4: last4(secret),
    authScheme: scheme,
    status: scheme ? "ok" : "error",
    lastError: error,
    lastTestedAt: new Date(),
    syncOrders: input.syncOrders,
    syncCatalog: input.syncCatalog,
    updatedBy: input.actor,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(integrations).set(base).where(eq(integrations.id, existing.id));
    return { ok: Boolean(scheme), id: existing.id, scheme, error };
  }

  // A slug collision means a second store on the same host; keep them distinct.
  let slug = slugify(name);
  const taken = new Set((await db.select({ slug: integrations.slug }).from(integrations)).map((r) => r.slug));
  if (taken.has(slug)) {
    let n = 2;
    while (taken.has(`${slug}-${n}`)) n += 1;
    slug = `${slug}-${n}`;
  }

  const [created] = await db
    .insert(integrations)
    .values({ ...base, slug })
    .returning({ id: integrations.id });
  return { ok: Boolean(scheme), id: created.id, scheme, error };
}

export async function deleteConnection(id: number) {
  await db.delete(integrations).where(eq(integrations.id, id));
}

/* ------------------------------------------------------------------ */
/* Catalog sync                                                        */
/* ------------------------------------------------------------------ */

export type SyncResult = {
  store: string;
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

export async function syncCatalog(integrationId: number): Promise<SyncResult> {
  const { row, baseUrl, secret, scheme } = await credentialsFor(integrationId);

  const rows: (typeof medusaProducts.$inferInsert)[] = [];
  let productCount = 0;

  for await (const page of iterateProducts(baseUrl, secret, scheme)) {
    productCount += page.length;
    for (const product of page) {
      for (const variant of product.variants ?? []) {
        const { cost, ml, systemType, meta } = readVariantExtras(variant, product.metadata);
        rows.push({
          integrationId,
          variantId: `${row.slug}:${variant.id}`,
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

  /* Replace this store's mirror only, carrying rejected matches across. */
  const rejected = new Set(
    (
      await db
        .select({ variantId: medusaProducts.variantId })
        .from(medusaProducts)
        .where(and(eq(medusaProducts.integrationId, integrationId), dsql`${medusaProducts.matchRejected}`))
    ).map((r) => r.variantId),
  );
  for (const r of rows) if (rejected.has(r.variantId!)) r.matchRejected = true;

  await db.delete(medusaProducts).where(eq(medusaProducts.integrationId, integrationId));
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(medusaProducts).values(rows.slice(i, i + CHUNK)).onConflictDoNothing();
  }

  const match = await matchMedusaToProducts();

  const stats: SyncResult = {
    store: row.name,
    products: productCount,
    variants: rows.length,
    withBarcode: rows.filter((r) => r.barcode || r.upc || r.ean).length,
    withCost: rows.filter((r) => r.wholesaleCost).length,
    withMl: rows.filter((r) => r.liquidMl).length,
    ...match,
  };

  await db
    .update(integrations)
    .set({
      lastSyncedAt: new Date(),
      stats: stats as unknown as Record<string, unknown>,
      status: "ok",
      lastError: null,
    })
    .where(eq(integrations.id, integrationId));

  return stats;
}

/* ------------------------------------------------------------------ */
/* Order sync - the PACT feed                                          */
/* ------------------------------------------------------------------ */

export type OrderSyncResult = {
  store: string;
  ordersRead: number;
  shipmentRows: number;
  periods: string[];
  states: number;
  skippedNoAddress: number;
  skippedNonUs: number;
  skippedCancelled: number;
  withCustomerName: number;
};

/**
 * Reads orders and writes one shipment row per line, keyed on
 * `medusa:<store>:<order>:<line>` so re-running is idempotent - re-syncing a
 * period updates rows rather than duplicating a PACT filing.
 */
export async function syncOrders(
  integrationId: number,
  opts: { createdAfter?: string } = {},
): Promise<OrderSyncResult> {
  const { row, baseUrl, secret, scheme } = await credentialsFor(integrationId);

  const all: ShipmentRowInput[] = [];
  let ordersRead = 0;
  let skippedNoAddress = 0;
  let skippedNonUs = 0;
  let skippedCancelled = 0;

  for await (const page of iterateOrders(baseUrl, secret, scheme, { createdAfter: opts.createdAfter })) {
    ordersRead += page.length;
    const mapped = mapOrdersToShipments(page, row.slug);
    all.push(...mapped.rows);
    skippedNoAddress += mapped.skippedNoAddress;
    skippedNonUs += mapped.skippedNonUs;
    skippedCancelled += mapped.skippedCancelled;
  }

  const mlBySku = await millilitresBySku();

  const values = all.map((r) => ({
    integrationId,
    sourceSystem: "medusa",
    sourceLabel: row.name,
    externalId: r.externalId,
    orderNumber: r.orderNumber,
    period: r.period,
    state: r.state,
    customerName: r.customerName,
    shipToAddress: r.shipToAddress,
    shipToCity: r.shipToCity,
    shipToState: r.shipToState,
    shipToZip: r.shipToZip,
    invoiceDate: r.invoiceDate,
    invoiceNumber: r.invoiceNumber,
    product: r.product,
    brand: r.brand,
    quantity: String(r.quantity),
    mlTotal: String((mlBySku.get(normalizeCode(r.sku) ?? "") ?? 0) * r.quantity),
  }));

  for (let i = 0; i < values.length; i += CHUNK) {
    await db
      .insert(shipments)
      .values(values.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: shipments.externalId,
        set: {
          period: dsql`excluded.period`,
          state: dsql`excluded.state`,
          customerName: dsql`excluded.customer_name`,
          shipToAddress: dsql`excluded.ship_to_address`,
          shipToCity: dsql`excluded.ship_to_city`,
          shipToState: dsql`excluded.ship_to_state`,
          shipToZip: dsql`excluded.ship_to_zip`,
          invoiceDate: dsql`excluded.invoice_date`,
          invoiceNumber: dsql`excluded.invoice_number`,
          product: dsql`excluded.product`,
          quantity: dsql`excluded.quantity`,
          mlTotal: dsql`excluded.ml_total`,
        },
      });
  }

  const stats: OrderSyncResult = {
    store: row.name,
    ordersRead,
    shipmentRows: values.length,
    periods: [...new Set(all.map((r) => r.period))].sort(),
    states: new Set(all.map((r) => r.state)).size,
    skippedNoAddress,
    skippedNonUs,
    skippedCancelled,
    withCustomerName: all.filter((r) => r.customerName).length,
  };

  await db
    .update(integrations)
    .set({ ordersSyncedAt: new Date(), orderStats: stats as unknown as Record<string, unknown> })
    .where(eq(integrations.id, integrationId));

  return stats;
}

async function millilitresBySku(): Promise<Map<string, number>> {
  const rows = await db
    .select({ sku: products.sku, ml: products.liquidMl })
    .from(products)
    .where(dsql`${products.liquidMl} IS NOT NULL`);
  const map = new Map<string, number>();
  for (const r of rows) {
    const n = normalizeCode(r.sku);
    if (n) map.set(n, Number(r.ml));
  }
  return map;
}

/** Every active store that is set to contribute orders. */
export async function syncAllOrders(): Promise<OrderSyncResult[]> {
  const rows = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.active, true), eq(integrations.syncOrders, true)));
  const out: OrderSyncResult[] = [];
  for (const r of rows) out.push(await syncOrders(r.id));
  return out;
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export async function matchMedusaToProducts() {
  const [variants, quantum] = await Promise.all([
    db.select().from(medusaProducts),
    db
      .select({ sku: products.sku, units: products.unitsSold, description: products.description })
      .from(products),
  ]);

  const bySku = new Map<string, string>();
  for (const p of quantum) {
    const n = normalizeCode(p.sku);
    if (n) bySku.set(n, p.sku);
  }

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

  const updates: { id: number; matchedSku: string | null; matchMethod: string; matchScore: number | null }[] = [];
  const matchedTargets = new Set<string>();

  for (const v of variants) {
    if (v.matchRejected) {
      updates.push({ id: v.id, matchedSku: null, matchMethod: "rejected", matchScore: null });
      continue;
    }

    let hit: { sku: string; method: string; score: number | null } | null = null;
    for (const [method, raw] of [
      ["barcode", v.barcode],
      ["upc", v.upc],
      ["ean", v.ean],
      ["sku", v.sku],
    ] as [string, string | null][]) {
      const n = normalizeCode(raw);
      if (!n) continue;
      const target = bySku.get(n);
      if (target) {
        hit = { sku: target, method, score: null };
        break;
      }
    }

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
      SET matched_sku = v.matched_sku, match_method = v.match_method, match_score = v.match_score
      FROM (VALUES ${dsql.join(
        slice.map(
          (u) => dsql`(${u.id}::int, ${u.matchedSku}::text, ${u.matchMethod}::text, ${u.matchScore}::numeric)`,
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

export async function setMatchDecision(rowId: number, decision: "reject" | "accept", sku?: string) {
  if (decision === "reject") {
    await db
      .update(medusaProducts)
      .set({ matchRejected: true, matchedSku: null, matchMethod: "rejected", matchScore: null })
      .where(eq(medusaProducts.id, rowId));
    return;
  }
  await db
    .update(medusaProducts)
    .set({ matchRejected: false, matchedSku: sku ?? null, matchMethod: "manual", matchScore: null })
    .where(eq(medusaProducts.id, rowId));
}

export async function medusaEnrichmentBySku() {
  const rows = await db.select().from(medusaProducts).where(dsql`${medusaProducts.matchedSku} IS NOT NULL`);
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

export async function deleteShipmentsForSource(sourceSystem: string, integrationId?: number) {
  await db
    .delete(shipments)
    .where(
      integrationId
        ? and(eq(shipments.sourceSystem, sourceSystem), eq(shipments.integrationId, integrationId))
        : eq(shipments.sourceSystem, sourceSystem),
    );
}

export { inArray };
