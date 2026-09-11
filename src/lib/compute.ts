import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { filings, products, purchases, shipments, transactions } from "@/db/schema";
import { num } from "./money";
import { normalizeRate } from "./ingest/avalara";
import { monthsInPeriod } from "./periods";
import { computeSales } from "./engine/sales";
import { computeExcise } from "./engine/excise";
import { computePact } from "./engine/pact";
import type { AnyResult, TxRow } from "./engine/types";
import { resolveExciseConfig, resolveJurisdictionCodes, resolveStateConfig } from "./config";

export async function fetchTransactions(state: string, period: string): Promise<TxRow[]> {
  const months = monthsInPeriod(period);
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.state, state), inArray(transactions.period, months)));

  return rows.map((r) => ({
    documentId: r.documentId,
    lineNo: r.lineNo,
    ref1: r.ref1,
    itemCode: r.itemCode,
    itemDescription: r.itemDescription,
    docType: r.docType,
    documentDate: r.documentDate,
    period: r.period,
    state: r.state,
    destCounty: r.destCounty,
    destCity: r.destCity,
    destZip: r.destZip,
    jurisdictionType: r.jurisdictionType,
    jurisdictionDescription: r.jurisdictionDescription,
    rate: normalizeRate(num(r.rate), num(r.taxableAmount), num(r.taxAmount)),
    lineAmount: num(r.lineAmount),
    discountAmount: num(r.discountAmount),
    taxableAmount: num(r.taxableAmount),
    exemptAmount: num(r.exemptAmount),
    taxAmount: num(r.taxAmount),
    quantity: num(r.quantity),
  }));
}

async function fetchProducts() {
  const rows = await db.select().from(products);
  return rows.map((p) => ({
    sku: p.sku,
    description: p.description,
    wholesaleCost: p.wholesaleCost === null ? null : num(p.wholesaleCost),
    retailPrice: p.retailPrice === null ? null : num(p.retailPrice),
    liquidMl: p.liquidMl === null ? null : num(p.liquidMl),
    cartridgesPerUnit: p.cartridgesPerUnit === null ? null : num(p.cartridgesPerUnit),
    systemType: p.systemType,
    containsNicotine: p.containsNicotine,
  }));
}

export class ComputeError extends Error {}

/**
 * Compute one return. Pure inputs in, engine result out - then persisted to
 * `filings` so the calendar and the worksheet generator share one source of
 * truth for the period.
 */
export async function computeFiling(
  state: string,
  taxType: string,
  period: string,
): Promise<AnyResult> {
  if (taxType === "sales") {
    const config = await resolveStateConfig(state, "sales", period);
    if (!config) throw new ComputeError(`No sales-tax config for ${state} effective ${period}.`);
    const [rows, codes] = await Promise.all([
      fetchTransactions(state, period),
      resolveJurisdictionCodes(state, period),
    ]);
    return computeSales(rows, { config, codes, period });
  }

  if (taxType === "excise") {
    const config = await resolveExciseConfig(state, period);
    if (!config) throw new ComputeError(`No excise config for ${state} effective ${period}.`);
    const months = monthsInPeriod(period);
    const [rows, prods, purch] = await Promise.all([
      config.basis === "SALES" ? fetchTransactions(state, period) : Promise.resolve([]),
      fetchProducts(),
      db
        .select()
        .from(purchases)
        .where(and(inArray(purchases.period, months), eq(purchases.state, state))),
    ]);
    return computeExcise({
      config,
      period,
      rows,
      products: prods,
      purchases: purch.map((p) => ({
        sku: p.sku,
        description: p.description,
        quantity: num(p.quantity),
        mlTotal: num(p.mlTotal),
        unitsTotal: num(p.unitsTotal),
        wholesaleCost: num(p.wholesaleCost),
      })),
    });
  }

  if (taxType === "pact") {
    const config = await resolveStateConfig(state, "pact", period);
    const months = monthsInPeriod(period);
    const [rows, ship, prods] = await Promise.all([
      fetchTransactions(state, period),
      db
        .select()
        .from(shipments)
        .where(and(inArray(shipments.period, months), eq(shipments.state, state))),
      fetchProducts(),
    ]);
    return computePact({
      state,
      period,
      rows,
      shipments: ship.map((s) => ({
        customerName: s.customerName,
        shipToAddress: s.shipToAddress,
        shipToCity: s.shipToCity,
        shipToState: s.shipToState,
        shipToZip: s.shipToZip,
        invoiceDate: s.invoiceDate,
        invoiceNumber: s.invoiceNumber,
        product: s.product,
        brand: s.brand,
        quantity: num(s.quantity),
        mlTotal: num(s.mlTotal),
      })),
      products: new Map(prods.map((p) => [p.sku.trim().toUpperCase(), { liquidMl: p.liquidMl }])),
      portal: config?.portal ?? null,
      formName: config?.formName ?? "PACT ENDS report",
      dueDay: config?.dueDay ?? 10,
    });
  }

  throw new ComputeError(`Unknown tax type "${taxType}".`);
}

const s = (n: number) => n.toFixed(4);

/** Upsert the computed result onto the filing record (never clobbers "filed"). */
export async function persistFiling(
  state: string,
  taxType: string,
  period: string,
  result: AnyResult,
) {
  const isSales = result.taxType === "sales";
  const values = {
    state,
    taxType,
    period,
    dueDate: result.dueDate,
    gross: isSales ? s(result.gross) : null,
    exempt: isSales ? s(result.exempt) : null,
    taxable: isSales ? s(result.taxable) : null,
    taxComputed: result.taxType === "pact" ? null : s(result.taxComputed),
    taxCollected: isSales ? s(result.taxCollected) : null,
    delta: isSales ? s(result.delta) : null,
    result: result as unknown as Record<string, unknown>,
    computedAt: new Date(),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: filings.id, status: filings.status })
    .from(filings)
    .where(
      and(eq(filings.state, state), eq(filings.taxType, taxType), eq(filings.period, period)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(filings)
      .set({ ...values, status: existing.status === "filed" ? "filed" : "ready" })
      .where(eq(filings.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(filings)
    .values({ ...values, status: "ready" })
    .returning({ id: filings.id });
  return inserted.id;
}

export async function computeAndPersist(state: string, taxType: string, period: string) {
  const result = await computeFiling(state, taxType, period);
  await persistFiling(state, taxType, period, result);
  return result;
}
