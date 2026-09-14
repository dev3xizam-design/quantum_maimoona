import "server-only";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { num, round2 } from "../money";
import { classifyProduct, classificationSummary } from "./classify";
import { medusaEnrichmentBySku } from "../medusa/sync";

/**
 * Builds the product master out of the Avalara transactions that are already
 * in the database. Every sale line carries an item code, a name, a quantity
 * and a line amount, so the SKU list, the descriptions, the real selling
 * prices and the volumes printed in the names all come from the data itself -
 * nobody types them in.
 *
 * Two things genuinely are NOT in a sales-tax export and are left null rather
 * than guessed: wholesale cost (it comes from the purchase import when that is
 * uploaded) and mL for pods and disposables whose names never state a volume.
 *
 * Anything a human edits is recorded in `lockedFields` and is never overwritten
 * by a later run, so corrections survive every future upload.
 */

type Aggregate = {
  sku: string;
  description: string | null;
  units: number;
  revenue: number;
  lineCount: number;
  states: string[];
  firstSeen: string | null;
  lastSeen: string | null;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const r = result as { rows?: Record<string, unknown>[] };
  return r?.rows ?? [];
}

/**
 * The export repeats every sale line once per jurisdiction, so the DISTINCT ON
 * is not an optimisation - without it, units and revenue are multiplied by the
 * number of tax jurisdictions that applied.
 */
async function aggregateFromTransactions(): Promise<Aggregate[]> {
  const result = await db.execute(dsql`
    WITH sale_lines AS (
      SELECT DISTINCT ON (document_id, line_no, item_code, ref1)
        upper(btrim(item_code))                                   AS sku,
        item_description,
        state,
        document_date,
        CASE WHEN doc_type ILIKE '%return%' THEN -abs(quantity)
             ELSE quantity END                                    AS signed_qty,
        CASE WHEN doc_type ILIKE '%return%' THEN -abs(line_amount - discount_amount)
             ELSE line_amount - discount_amount END               AS signed_amount
      FROM transactions
      WHERE lower(btrim(jurisdiction_type)) = 'state'
        AND item_code IS NOT NULL
        AND btrim(item_code) <> ''
      ORDER BY document_id, line_no, item_code, ref1, id
    )
    SELECT
      sku,
      mode() WITHIN GROUP (ORDER BY item_description) AS description,
      sum(signed_qty)::numeric                        AS units,
      sum(signed_amount)::numeric                     AS revenue,
      count(*)::int                                   AS line_count,
      array_agg(DISTINCT state)                       AS states,
      min(document_date)::text                        AS first_seen,
      max(document_date)::text                        AS last_seen
    FROM sale_lines
    GROUP BY sku
    ORDER BY sum(signed_amount) DESC
  `);

  return rowsOf(result).map((r) => ({
    sku: String(r.sku),
    description: (r.description as string | null) ?? null,
    units: num(r.units as string),
    revenue: num(r.revenue as string),
    lineCount: Number(r.line_count ?? 0),
    states: ((r.states as string[] | null) ?? []).filter(Boolean),
    firstSeen: (r.first_seen as string | null) ?? null,
    lastSeen: (r.last_seen as string | null) ?? null,
  }));
}

/** Weighted average unit cost per SKU, from the purchase import when present. */
async function unitCostsFromPurchases(): Promise<Map<string, number>> {
  const result = await db.execute(dsql`
    SELECT upper(btrim(sku)) AS sku,
           sum(wholesale_cost)::numeric AS cost,
           sum(quantity)::numeric       AS qty
    FROM purchases
    WHERE sku IS NOT NULL AND btrim(sku) <> ''
    GROUP BY upper(btrim(sku))
    HAVING sum(quantity) > 0 AND sum(wholesale_cost) > 0
  `);

  const map = new Map<string, number>();
  for (const r of rowsOf(result)) {
    const qty = num(r.qty as string);
    const cost = num(r.cost as string);
    if (qty > 0) map.set(String(r.sku), round2(cost / qty));
  }
  return map;
}

export type CatalogRefreshResult = {
  skusSeen: number;
  created: number;
  updated: number;
  lockedSkipped: number;
  withPrice: number;
  withCost: number;
  withMl: number;
  classifiedOpen: number;
  classifiedClosed: number;
  unclassified: number;
  needsReview: number;
  topMissing: { sku: string; description: string | null; revenue: number; missing: string[] }[];
};

const CHUNK = 200;

export async function refreshProductCatalog(): Promise<CatalogRefreshResult> {
  const [aggregates, costs, medusa, existingRows] = await Promise.all([
    aggregateFromTransactions(),
    unitCostsFromPurchases(),
    medusaEnrichmentBySku().catch(() => new Map()),
    db.select().from(products),
  ]);

  const existing = new Map(existingRows.map((p) => [p.sku.trim().toUpperCase(), p]));
  const result: CatalogRefreshResult = {
    skusSeen: aggregates.length,
    created: 0,
    updated: 0,
    lockedSkipped: 0,
    withPrice: 0,
    withCost: 0,
    withMl: 0,
    classifiedOpen: 0,
    classifiedClosed: 0,
    unclassified: 0,
    needsReview: 0,
    topMissing: [],
  };

  const values: (typeof products.$inferInsert)[] = [];

  for (const agg of aggregates) {
    const prior = existing.get(agg.sku);
    const locked = new Set(prior?.lockedFields ?? []);
    if (locked.size) result.lockedSkipped += 1;
    prior ? (result.updated += 1) : (result.created += 1);

    const description = locked.has("description")
      ? (prior?.description ?? agg.description)
      : (agg.description ?? prior?.description ?? null);

    const c = classifyProduct(description, agg.sku);

    /* Selling price, measured from the lines themselves. */
    const observedUnitPrice = agg.units !== 0 ? round2(agg.revenue / agg.units) : null;
    const retailPrice = locked.has("retailPrice") ? num(prior?.retailPrice) : observedUnitPrice;
    const priceSource = locked.has("retailPrice") ? "manual" : observedUnitPrice !== null ? "observed" : "unknown";

    /*
     * Cost, in order of authority: what a person typed, then what was actually
     * paid on a purchase order, then what Medusa holds. Never a guess.
     */
    const observedUnitCost = costs.get(agg.sku) ?? null;
    const fromMedusa = medusa.get(agg.sku) ?? null;
    let wholesaleCost: number | null;
    let costSource: string;
    if (locked.has("wholesaleCost")) {
      wholesaleCost = prior?.wholesaleCost ? num(prior.wholesaleCost) : null;
      costSource = "manual";
    } else if (observedUnitCost !== null) {
      wholesaleCost = observedUnitCost;
      costSource = "purchases";
    } else if (fromMedusa?.cost != null) {
      wholesaleCost = fromMedusa.cost;
      // A name match is a judgement, not an identity - say which it was.
      costSource = fromMedusa.viaName ? "medusa_name" : "medusa";
    } else {
      wholesaleCost = null;
      costSource = "unknown";
    }

    /* Volume: what a person set, then Medusa, then what the name states. */
    let liquidMl: number | null;
    let mlSource: string;
    if (locked.has("liquidMl")) {
      liquidMl = prior?.liquidMl ? num(prior.liquidMl) : null;
      mlSource = "manual";
    } else if (fromMedusa?.ml != null) {
      liquidMl = fromMedusa.ml;
      mlSource = fromMedusa.viaName ? "medusa_name" : "medusa";
    } else if (c.liquidMl !== null) {
      liquidMl = c.liquidMl;
      mlSource = "parsed";
    } else {
      liquidMl = null;
      mlSource = "unknown";
    }

    const cartridgesPerUnit = locked.has("cartridgesPerUnit")
      ? (prior?.cartridgesPerUnit ? num(prior.cartridgesPerUnit) : null)
      : (c.cartridgesPerUnit ?? 1);

    let systemType: string | null;
    let systemTypeSource: string;
    if (locked.has("systemType")) {
      systemType = prior?.systemType ?? null;
      systemTypeSource = "manual";
    } else if (fromMedusa?.systemType) {
      systemType = fromMedusa.systemType;
      systemTypeSource = fromMedusa.viaName ? "medusa_name" : "medusa";
    } else {
      systemType = c.systemType;
      systemTypeSource = c.systemType ? "inferred" : "unknown";
    }

    const containsNicotine = locked.has("containsNicotine")
      ? (prior?.containsNicotine ?? true)
      : c.containsNicotine;

    const missing: string[] = [];
    if (containsNicotine && !c.isNonProduct) {
      if (wholesaleCost === null) missing.push("wholesale cost");
      if (systemType === null) missing.push("open/closed");
      if (liquidMl === null) missing.push("mL");
    }
    const needsReview = missing.length > 0;

    if (retailPrice !== null) result.withPrice += 1;
    if (wholesaleCost !== null) result.withCost += 1;
    if (liquidMl !== null) result.withMl += 1;
    if (systemType === "OPEN") result.classifiedOpen += 1;
    else if (systemType === "CLOSED") result.classifiedClosed += 1;
    else if (containsNicotine) result.unclassified += 1;
    if (needsReview) {
      result.needsReview += 1;
      result.topMissing.push({ sku: agg.sku, description, revenue: agg.revenue, missing });
    }

    const s = (n: number | null) => (n === null ? null : String(n));
    values.push({
      sku: agg.sku,
      description,
      wholesaleCost: s(wholesaleCost),
      retailPrice: s(retailPrice),
      liquidMl: s(liquidMl),
      cartridgesPerUnit: s(cartridgesPerUnit),
      systemType,
      containsNicotine,
      observedUnitPrice: s(observedUnitPrice),
      observedUnitCost: s(observedUnitCost),
      unitsSold: String(round2(agg.units)),
      revenue: String(round2(agg.revenue)),
      lineCount: agg.lineCount,
      statesSold: agg.states,
      firstSeen: agg.firstSeen,
      lastSeen: agg.lastSeen,
      priceSource,
      costSource,
      mlSource,
      systemTypeSource,
      classificationNote: classificationSummary(c),
      lockedFields: prior?.lockedFields ?? [],
      source: prior?.source ?? "avalara",
      storeName: prior?.storeName ?? null,
      medusaVariantId: prior?.medusaVariantId ?? null,
      needsReview,
      // A rebuild refreshes the facts; it never un-reviews what a person read.
      reviewedAt: prior?.reviewedAt ?? null,
      reviewedBy: prior?.reviewedBy ?? null,
      updatedAt: new Date(),
    });
  }

  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    await db
      .insert(products)
      .values(chunk)
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          description: dsql`excluded.description`,
          wholesaleCost: dsql`excluded.wholesale_cost`,
          retailPrice: dsql`excluded.retail_price`,
          liquidMl: dsql`excluded.liquid_ml`,
          cartridgesPerUnit: dsql`excluded.cartridges_per_unit`,
          systemType: dsql`excluded.system_type`,
          containsNicotine: dsql`excluded.contains_nicotine`,
          observedUnitPrice: dsql`excluded.observed_unit_price`,
          observedUnitCost: dsql`excluded.observed_unit_cost`,
          unitsSold: dsql`excluded.units_sold`,
          revenue: dsql`excluded.revenue`,
          lineCount: dsql`excluded.line_count`,
          statesSold: dsql`excluded.states_sold`,
          firstSeen: dsql`excluded.first_seen`,
          lastSeen: dsql`excluded.last_seen`,
          priceSource: dsql`excluded.price_source`,
          costSource: dsql`excluded.cost_source`,
          mlSource: dsql`excluded.ml_source`,
          systemTypeSource: dsql`excluded.system_type_source`,
          classificationNote: dsql`excluded.classification_note`,
          needsReview: dsql`excluded.needs_review`,
          source: dsql`excluded.source`,
          storeName: dsql`excluded.store_name`,
          medusaVariantId: dsql`excluded.medusa_variant_id`,
          reviewedAt: dsql`excluded.reviewed_at`,
          reviewedBy: dsql`excluded.reviewed_by`,
          updatedAt: dsql`excluded.updated_at`,
        },
      });
  }

  result.topMissing.sort((a, b) => b.revenue - a.revenue);
  result.topMissing = result.topMissing.slice(0, 20);
  return result;
}
