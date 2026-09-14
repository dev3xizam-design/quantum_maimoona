import "server-only";
import { eq, inArray, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { products, purchases, shipments, transactions } from "@/db/schema";
import type { NormalizedRow } from "./avalara";

const n = (v: number) => String(v ?? 0);

/**
 * Re-uploading the same period is safe: the unique index on
 * (documentId, lineNo, jurisdictionType, jurisdictionDescription, itemCode)
 * makes duplicate rows a no-op rather than doubling the period.
 */
export async function insertTransactions(uploadId: number, rows: NormalizedRow[]) {
  if (!rows.length) return 0;
  const values = rows.map((r) => ({
    uploadId,
    sourceFile: r.sourceFile,
    documentId: r.documentId,
    lineNo: r.lineNo,
    ref1: r.ref1,
    documentStatus: r.documentStatus,
    docType: r.docType,
    sign: r.sign,
    documentDate: r.documentDate,
    period: r.period,
    reportingDate: r.reportingDate,
    taxCalcDate: r.taxCalcDate,
    state: r.state,
    destCounty: r.destCounty,
    destCity: r.destCity,
    destZip: r.destZip,
    jurisdictionType: r.jurisdictionType,
    jurisdictionDescription: r.jurisdictionDescription,
    taxTypeDescription: r.taxTypeDescription,
    rate: n(r.rate),
    lineAmount: n(r.lineAmount),
    discountAmount: n(r.discountAmount),
    taxableAmount: n(r.taxableAmount),
    exemptAmount: n(r.exemptAmount),
    taxAmount: n(r.taxAmount),
    quantity: n(r.quantity),
    itemCode: r.itemCode,
    itemDescription: r.itemDescription,
  }));

  const inserted = await db
    .insert(transactions)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: transactions.id });
  return inserted.length;
}

export type ProductInput = {
  sku: string;
  description?: string | null;
  wholesaleCost?: number | null;
  retailPrice?: number | null;
  liquidMl?: number | null;
  cartridgesPerUnit?: number | null;
  systemType?: string | null;
  containsNicotine?: boolean;
};

/**
 * A product-master CSV is a deliberate human statement, so every value it
 * carries is locked the same way an on-screen edit is - a later catalog
 * rebuild refreshes the observed figures around it but never overwrites it.
 *
 * Written as ONE read plus batched upserts. A select-then-write per row is two
 * round trips per SKU, which on a few thousand SKUs runs for minutes and dies
 * on the serverless time limit.
 */
export async function upsertProducts(rows: ProductInput[]) {
  const wanted = rows.filter((r) => r.sku && r.sku.trim());
  if (!wanted.length) return 0;

  const skus = [...new Set(wanted.map((r) => r.sku!.trim().toUpperCase()))];
  const existingRows = skus.length
    ? await db.select().from(products).where(inArray(products.sku, skus))
    : [];
  const existing = new Map(existingRows.map((p) => [p.sku, p]));

  const now = new Date();
  const values: (typeof products.$inferInsert)[] = [];
  const seen = new Set<string>();

  for (const r of wanted) {
    const sku = r.sku!.trim().toUpperCase();
    if (seen.has(sku)) continue; // a batch cannot touch the same row twice
    seen.add(sku);

    const prior = existing.get(sku);
    const locked = new Set(prior?.lockedFields ?? []);
    const row: Record<string, unknown> = {
      sku,
      description: prior?.description ?? null,
      wholesaleCost: prior?.wholesaleCost ?? null,
      retailPrice: prior?.retailPrice ?? null,
      liquidMl: prior?.liquidMl ?? null,
      cartridgesPerUnit: prior?.cartridgesPerUnit ?? null,
      systemType: prior?.systemType ?? null,
      containsNicotine: prior?.containsNicotine ?? true,
      costSource: prior?.costSource ?? "unknown",
      priceSource: prior?.priceSource ?? "unknown",
      mlSource: prior?.mlSource ?? "unknown",
      systemTypeSource: prior?.systemTypeSource ?? "unknown",
      updatedAt: now,
    };

    const put = (
      field: string,
      value: number | string | boolean | null | undefined,
      sourceField?: string,
    ) => {
      if (value === null || value === undefined || value === "") return;
      row[field] = typeof value === "number" ? String(value) : value;
      locked.add(field);
      if (sourceField) row[sourceField] = "manual";
    };

    put("description", r.description ?? undefined);
    put("wholesaleCost", r.wholesaleCost ?? undefined, "costSource");
    put("retailPrice", r.retailPrice ?? undefined, "priceSource");
    put("liquidMl", r.liquidMl ?? undefined, "mlSource");
    put("cartridgesPerUnit", r.cartridgesPerUnit ?? undefined);
    if (r.systemType) {
      row.systemType = r.systemType.trim().toUpperCase();
      row.systemTypeSource = "manual";
      locked.add("systemType");
    }
    if (r.containsNicotine !== undefined) {
      row.containsNicotine = r.containsNicotine;
      locked.add("containsNicotine");
    }

    row.lockedFields = [...locked];
    row.needsReview =
      Boolean(row.containsNicotine) &&
      (row.wholesaleCost === null || row.systemType === null || row.liquidMl === null);

    values.push(row as typeof products.$inferInsert);
  }

  const CHUNK = 250;
  for (let i = 0; i < values.length; i += CHUNK) {
    await db
      .insert(products)
      .values(values.slice(i, i + CHUNK))
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
          costSource: dsql`excluded.cost_source`,
          priceSource: dsql`excluded.price_source`,
          mlSource: dsql`excluded.ml_source`,
          systemTypeSource: dsql`excluded.system_type_source`,
          lockedFields: dsql`excluded.locked_fields`,
          needsReview: dsql`excluded.needs_review`,
          updatedAt: dsql`excluded.updated_at`,
        },
      });
  }

  return values.length;
}

export type PurchaseInput = {
  period: string;
  state?: string | null;
  sku?: string | null;
  description?: string | null;
  quantity?: number;
  mlTotal?: number;
  unitsTotal?: number;
  wholesaleCost?: number;
};

const INSERT_CHUNK = 500;

export async function insertPurchases(uploadId: number, rows: PurchaseInput[]) {
  if (!rows.length) return 0;
  const values =
    rows.map((r) => ({
      uploadId,
      period: r.period,
      state: r.state ?? null,
      sku: r.sku ?? null,
      description: r.description ?? null,
      quantity: n(r.quantity ?? 0),
      mlTotal: n(r.mlTotal ?? 0),
      unitsTotal: n(r.unitsTotal ?? 0),
      wholesaleCost: n(r.wholesaleCost ?? 0),
    }));
  for (let i = 0; i < values.length; i += INSERT_CHUNK) {
    await db.insert(purchases).values(values.slice(i, i + INSERT_CHUNK));
  }
  return rows.length;
}

export type ShipmentInput = {
  period: string;
  state: string;
  externalId?: string | null;
  orderNumber?: string | null;
  sourceSystem?: string;
  sourceLabel?: string | null;
  customerName?: string | null;
  shipToAddress?: string | null;
  shipToCity?: string | null;
  shipToState?: string | null;
  shipToZip?: string | null;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;
  product?: string | null;
  brand?: string | null;
  quantity?: number;
  mlTotal?: number;
};

/**
 * Upserted on externalId so re-importing the same orders corrects rows instead
 * of duplicating them - a doubled PACT filing would misreport every shipment.
 */
export async function insertShipments(uploadId: number, rows: ShipmentInput[]) {
  if (!rows.length) return 0;
  const values = rows.map((r) => ({
    uploadId,
    sourceSystem: r.sourceSystem ?? "upload",
    sourceLabel: r.sourceLabel ?? null,
    externalId: r.externalId ?? null,
    orderNumber: r.orderNumber ?? null,
    period: r.period,
    state: r.state.toUpperCase(),
    customerName: r.customerName ?? null,
    shipToAddress: r.shipToAddress ?? null,
    shipToCity: r.shipToCity ?? null,
    shipToState: r.shipToState ?? null,
    shipToZip: r.shipToZip ?? null,
    invoiceDate: r.invoiceDate ?? null,
    invoiceNumber: r.invoiceNumber ?? null,
    product: r.product ?? null,
    brand: r.brand ?? null,
    quantity: n(r.quantity ?? 0),
    mlTotal: n(r.mlTotal ?? 0),
  }));

  const withId = values.filter((v) => v.externalId);
  const withoutId = values.filter((v) => !v.externalId);

  for (let i = 0; i < withId.length; i += INSERT_CHUNK) {
    await db
      .insert(shipments)
      .values(withId.slice(i, i + INSERT_CHUNK))
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
  for (let i = 0; i < withoutId.length; i += INSERT_CHUNK) {
    await db.insert(shipments).values(withoutId.slice(i, i + INSERT_CHUNK));
  }
  return rows.length;
}
