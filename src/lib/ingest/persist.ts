import "server-only";
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

export async function upsertProducts(rows: ProductInput[]) {
  let count = 0;
  for (const r of rows) {
    if (!r.sku) continue;
    const values = {
      sku: r.sku.trim().toUpperCase(),
      description: r.description ?? null,
      wholesaleCost: r.wholesaleCost === null || r.wholesaleCost === undefined ? null : n(r.wholesaleCost),
      retailPrice: r.retailPrice === null || r.retailPrice === undefined ? null : n(r.retailPrice),
      liquidMl: r.liquidMl === null || r.liquidMl === undefined ? null : n(r.liquidMl),
      cartridgesPerUnit:
        r.cartridgesPerUnit === null || r.cartridgesPerUnit === undefined ? null : n(r.cartridgesPerUnit),
      systemType: r.systemType ? r.systemType.trim().toUpperCase() : null,
      containsNicotine: r.containsNicotine ?? true,
      updatedAt: new Date(),
    };
    await db.insert(products).values(values).onConflictDoUpdate({ target: products.sku, set: values });
    count += 1;
  }
  return count;
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

export async function insertPurchases(uploadId: number, rows: PurchaseInput[]) {
  if (!rows.length) return 0;
  await db.insert(purchases).values(
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
    })),
  );
  return rows.length;
}

export type ShipmentInput = {
  period: string;
  state: string;
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

export async function insertShipments(uploadId: number, rows: ShipmentInput[]) {
  if (!rows.length) return 0;
  await db.insert(shipments).values(
    rows.map((r) => ({
      uploadId,
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
    })),
  );
  return rows.length;
}
