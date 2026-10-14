import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectionForPushKey, hashKey } from "../connectors/store";
import { memo, MINUTE } from "./memo";
import { QuoteError } from "./calculate";
import type { Quote } from "./quote";

/**
 * Real-time tax API - what a store's checkout calls instead of Avalara.
 * Auth is the store connection's Quantum key (Bearer qk_live_...), the same
 * key the Connect API uses. snake_case on the wire; versioned in the URL.
 */

export async function storeFor(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  // Cached for a minute: a revoked key stops working within that minute.
  return key ? memo(`key:${hashKey(key)}`, MINUTE, () => connectionForPushKey(key)) : null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Unknown or revoked Quantum key." }, { status: 401 });

export function errorResponse(e: unknown) {
  if (e instanceof QuoteError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[tax-api]", e);
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: NextResponse.json({ error: "Body must be JSON." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: "Invalid request.", issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`) },
        { status: 422 },
      ),
    };
  }
  return { data: parsed.data };
}

const num = z.union([z.number(), z.string()]).transform(Number);
const optStr = z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v == null ? null : String(v)));

export const calculateSchema = z.object({
  address: z.object({
    line1: optStr,
    line2: optStr,
    city: optStr,
    state: z.string().min(2),
    zip: z.string().min(5),
    country: optStr,
  }),
  lines: z
    .array(
      z.object({
        id: z.string(),
        variant_id: optStr,
        product_id: optStr,
        sku: optStr,
        barcode: optStr,
        title: optStr,
        variant_title: optStr,
        product_type: optStr,
        description: optStr,
        quantity: num,
        unit_price: num,
        discount: num.optional(),
      }),
    )
    .max(500),
  shipping: z.array(z.object({ id: z.string(), amount: num })).default([]),
  /** YYYY-MM-DD; rates in force on this day. Defaults to today. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** The quote as the store sees it: snake_case, money rounded, sources kept. */
export function quoteToWire(q: Quote) {
  return {
    address: {
      state: q.address.state,
      zip: q.address.zip,
      county: q.address.county,
      city: q.address.city,
      rate_source: q.address.rateSource,
      matched_by: q.address.matchedBy,
    },
    lines: q.lines.map((l) => ({
      id: l.id,
      item_code: l.itemCode,
      amount: l.amount,
      sales_tax: {
        rate: l.sales.rate,
        amount: l.sales.amount,
        jurisdictions: l.sales.jurisdictions.map((j) => ({ type: j.type, name: j.name, code: j.code, rate: j.rate, amount: Math.round(j.amount * 100) / 100 })),
      },
      excise_tax: l.excise
        ? {
            label: l.excise.label,
            amount: l.excise.amount,
            effective_rate: l.excise.effectiveRate,
            basis: l.excise.basis,
            basis_amount: l.excise.basisAmount,
            rate: l.excise.rate,
            rate_unit: l.excise.rateUnit,
            estimated: l.excise.estimated,
            notes: l.excise.notes,
          }
        : null,
      retail_excise_tax: l.retailExcise
        ? { code: l.retailExcise.code, label: l.retailExcise.label, rate: l.retailExcise.rate, amount: l.retailExcise.amount }
        : null,
      facts: { ml_per_unit: l.facts.mlPerUnit, cost_per_unit: l.facts.costPerUnit, system_type: l.facts.systemType, sources: l.facts.sources },
    })),
    shipping: q.shipping.map((s) => ({
      id: s.id,
      amount: s.amount,
      taxable: s.taxable,
      rate: s.rate,
      tax: s.tax,
      jurisdictions: s.jurisdictions.map((j) => ({ type: j.type, name: j.name, code: j.code, rate: j.rate })),
    })),
    totals: { sales_tax: q.totals.salesTax, excise_tax: q.totals.exciseTax, total_tax: q.totals.totalTax },
    warnings: q.warnings,
  };
}
