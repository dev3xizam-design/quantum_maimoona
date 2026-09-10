import "server-only";
import { eq } from "drizzle-orm";
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
 */
export async function upsertProducts(rows: ProductInput[]) {
  let count = 0;
  for (const r of rows) {
    if (!r.sku) continue;
    const sku = r.sku.trim().toUpperCase();
    const [prior] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    const locked = new Set(prior?.lockedFields ?? []);

    const set: Record<string, unknown> = { sku, updatedAt: new Date() };
    const put = (field: string, value: number | string | boolean | null | undefined, source?: string) => {
      if (value === null || value === undefined || value === "") return;
      set[field] = typeof value === "number" ? String(value) : value;
      locked.add(field);
      if (source) set[source] = "manual";
    };

    put("description", r.description ?? undefined);
    put("wholesaleCost", r.wholesaleCost ?? undefined, "costSource");
    put("retailPrice", r.retailPrice ?? undefined, "priceSource");
    put("liquidMl", r.liquidMl ?? undefined, "mlSource");
    put("cartridgesPerUnit", r.cartridgesPerUnit ?? undefined);
    if (r.systemType) {
      set.systemType = r.systemType.trim().toUpperCase();
      set.systemTypeSource = "manual";
      locked.add("systemType");
    }
    if (r.containsNicotine !== undefined) {
      set.containsNicotine = r.containsNicotine;
      locked.add("containsNicotine");
    }
    set.lockedFields = [...locked];

    const nicotine = (set.containsNicotine ?? prior?.containsNicotine ?? true) as boolean;
    set.needsReview =
      nicotine &&
      ((set.wholesaleCost ?? prior?.wholesaleCost ?? null) === null ||
        (set.systemType ?? prior?.systemType ?? null) === null ||
        (set.liquidMl ?? prior?.liquidMl ?? null) === null);

    if (prior) {
      await db.update(products).set(set).where(eq(products.id, prior.id));
    } else {
      await db.insert(products).values(set as typeof products.$inferInsert);
    }
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
