import "server-only";
import { and, eq, inArray, like, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { filings, products, shipments, taxDocuments, transactions } from "@/db/schema";
import { normalizeState } from "../states";
import { calculate } from "./calculate";
import type { Quote, QuoteLine } from "./quote";

/**
 * Commit and void - the Avalara document lifecycle, done by Quantum.
 *
 *   commit  when the store reports an order SHIPPED. Writes the order's
 *           jurisdiction rows into `transactions` in the same exploded shape an
 *           Avalara export has (one row per line per jurisdiction, State row
 *           carries the sale figures), so the filing engines read it unchanged.
 *   void    when the order is cancelled or refunded in full. Rows are removed;
 *           if that month's return is already FILED they are left alone and a
 *           Return Invoice is written into the current month instead - the same
 *           way a credit memo would reach the next return.
 *
 * Tax amounts on the rows are what the store actually COLLECTED (spread across
 * jurisdictions by rate), so the engine's collected-vs-computed delta still
 * catches a checkout that charged the wrong rate.
 */

const num = z.union([z.number(), z.string()]).transform(Number);
const optStr = z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v == null ? null : String(v)));

const taxLine = z.object({ code: optStr, rate: num.optional(), amount: num.optional() });

export const commitSchema = z.object({
  order_id: z.string().min(1),
  order_number: optStr,
  /** When the order was placed - rates are taken as of this day. */
  ordered_at: z.string().min(10),
  /** When it shipped - this decides the reporting month. */
  shipped_at: z.string().min(10),
  email: optStr,
  address: z.object({
    first_name: optStr,
    last_name: optStr,
    company: optStr,
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
        tax_lines: z.array(taxLine).default([]),
      }),
    )
    .min(1),
  shipping: z
    .array(z.object({ id: z.string(), amount: num, tax_lines: z.array(taxLine).default([]) }))
    .default([]),
});

export type CommitInput = z.infer<typeof commitSchema>;

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isExciseCode = (code: string | null) => /excise/i.test(code ?? "");

/** Sales tax the store actually charged on one line, from its tax lines. */
function collectedSales(lineTotal: number, taxLines: CommitInput["lines"][number]["tax_lines"]) {
  let sales = 0;
  let excise = 0;
  for (const t of taxLines) {
    const amount = t.amount ?? ((t.rate ?? 0) / 100) * lineTotal;
    if (isExciseCode(t.code)) excise += amount;
    else sales += amount;
  }
  return { sales, excise };
}

/** A month counts as filed if the month, its quarter or its year is filed. */
async function isFiled(state: string, taxType: string, month: string) {
  const [y, m] = month.split("-");
  const periods = [month, `${y}-Q${Math.ceil(Number(m) / 3)}`, y];
  const rows = await db
    .select({ status: filings.status })
    .from(filings)
    .where(and(eq(filings.state, state), eq(filings.taxType, taxType), inArray(filings.period, periods)));
  return rows.some((r) => r.status === "filed");
}

type TxInsert = typeof transactions.$inferInsert;

function rowsForLine(opts: {
  code: string;
  lineNo: string;
  ref1: string;
  quote: Quote;
  line: Pick<QuoteLine, "itemCode" | "description" | "quantity" | "amount" | "sales">;
  gross: number;
  discount: number;
  collected: number;
  period: string;
  date: string;
  docType: string;
}): TxInsert[] {
  const { quote, line } = opts;
  const pieces = line.sales.jurisdictions;
  const combined = pieces.reduce((s, p) => s + p.rate, 0);
  const net = line.amount;
  const taxable = combined > 0 ? net : 0;
  const base = {
    documentId: opts.code,
    lineNo: opts.lineNo,
    ref1: opts.ref1,
    documentStatus: "Committed",
    docType: opts.docType,
    sign: opts.docType === "Return Invoice" ? -1 : 1,
    documentDate: opts.date,
    period: opts.period,
    reportingDate: opts.date,
    taxCalcDate: opts.date,
    state: quote.address.state,
    destCounty: quote.address.county,
    destCity: quote.address.city,
    destZip: quote.address.zip,
    taxTypeDescription: "Sales",
    lineAmount: String(r4(opts.gross)),
    discountAmount: String(r4(opts.discount)),
    quantity: String(line.quantity),
    itemCode: line.itemCode,
    itemDescription: line.description,
    sourceFile: "quantum",
  };

  // Always a State row: it carries gross / exempt for the return, even at 0%.
  const statePiece = pieces.find((p) => p.type === "State");
  const list = statePiece ? pieces : [{ type: "State" as const, name: quote.address.state, code: null, rate: 0, amount: 0 }, ...pieces];

  // Spread what was collected across jurisdictions by rate; with no rate,
  // anything collected sits on the State row so it is never lost.
  let allocated = 0;
  return list.map((p, i) => {
    const isState = p.type === "State";
    const share = combined > 0 ? p.rate / combined : isState ? 1 : 0;
    const tax = i === list.length - 1 ? opts.collected - allocated : r4(opts.collected * share);
    allocated += tax;
    return {
      ...base,
      jurisdictionType: p.type === "Special" ? "Special Tax Jurisdiction" : p.type,
      jurisdictionDescription: isState ? quote.address.state : p.name,
      rate: String(p.rate),
      taxableAmount: String(r4(taxable)),
      exemptAmount: String(r4(isState ? net - taxable : 0)),
      taxAmount: String(r4(tax)),
    };
  });
}

export type CommitResult = {
  documentCode: string;
  status: "committed" | "unchanged_filed";
  period: string;
  state: string;
  salesTax: number;
  exciseTax: number;
  collectedTax: number;
  warnings: string[];
};

export async function commitOrder(conn: { id: number; slug: string; name: string }, input: CommitInput): Promise<CommitResult> {
  const code = `quantum:${conn.slug}:${input.order_id}`;
  const state = normalizeState(input.address.state);
  if (!state) throw new Error(`Unknown US state "${input.address.state}".`);
  const shippedOn = input.shipped_at.slice(0, 10);
  const period = shippedOn.slice(0, 7);

  const [existing] = await db.select().from(taxDocuments).where(eq(taxDocuments.documentCode, code)).limit(1);
  if (existing?.status === "committed" && (await isFiled(existing.state, "sales", existing.period))) {
    return {
      documentCode: code,
      status: "unchanged_filed",
      period: existing.period,
      state: existing.state,
      salesTax: Number(existing.salesTax),
      exciseTax: Number(existing.exciseTax),
      collectedTax: Number(existing.collectedTax ?? 0),
      warnings: [`${existing.period} ${existing.state} sales is already filed - the committed document was left as filed.`],
    };
  }

  const quote = await calculate(
    conn.slug,
    {
      address: { line1: input.address.line1, line2: input.address.line2, city: input.address.city, state, zip: input.address.zip, country: input.address.country },
      lines: input.lines.map((l) => ({
        id: l.id,
        variantId: l.variant_id,
        productId: l.product_id,
        sku: l.sku,
        barcode: l.barcode,
        title: l.title,
        variantTitle: l.variant_title,
        productType: l.product_type,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        discount: l.discount,
      })),
      shipping: input.shipping.map((s) => ({ id: s.id, amount: s.amount })),
    },
    input.ordered_at.slice(0, 10),
    { fresh: true },
  );

  const rows: TxInsert[] = [];
  let collectedSalesTotal = 0;
  let collectedExciseTotal = 0;
  input.lines.forEach((l, i) => {
    const q = quote.lines[i];
    const gross = l.unit_price * l.quantity;
    const discount = l.discount ?? 0;
    const c = collectedSales(gross - discount, l.tax_lines);
    collectedSalesTotal += c.sales;
    collectedExciseTotal += c.excise;
    rows.push(
      ...rowsForLine({ code, lineNo: String(i + 1), ref1: l.id, quote, line: q, gross, discount, collected: c.sales, period, date: shippedOn, docType: "Sales Invoice" }),
    );
  });
  input.shipping.forEach((s, i) => {
    const q = quote.shipping[i];
    const c = collectedSales(s.amount, s.tax_lines);
    collectedSalesTotal += c.sales;
    rows.push(
      ...rowsForLine({
        code,
        lineNo: `S${i + 1}`,
        ref1: s.id,
        quote,
        line: { itemCode: "SHIPPING", description: "Shipping", quantity: 1, amount: s.amount, sales: { rate: q.rate, amount: q.tax, jurisdictions: q.jurisdictions } },
        gross: s.amount,
        discount: 0,
        collected: c.sales,
        period,
        date: shippedOn,
        docType: "Sales Invoice",
      }),
    );
  });

  const warnings = [...quote.warnings];
  const delta = r2(collectedSalesTotal) - quote.totals.salesTax;
  if (Math.abs(delta) >= 0.02) {
    warnings.push(
      `Sales tax collected (${r2(collectedSalesTotal).toFixed(2)}) differs from Quantum's rate (${quote.totals.salesTax.toFixed(2)}) by ${delta.toFixed(2)}.`,
    );
  }

  const doc = {
    integrationId: conn.id,
    documentCode: code,
    orderId: input.order_id,
    orderNumber: input.order_number,
    status: "committed",
    documentDate: shippedOn,
    period,
    state,
    address: { ...input.address, county: quote.address.county, rate_source: quote.address.rateSource } as Record<string, unknown>,
    subtotal: String(r4(input.lines.reduce((s, l) => s + l.unit_price * l.quantity - (l.discount ?? 0), 0))),
    salesTax: String(quote.totals.salesTax),
    exciseTax: String(quote.totals.exciseTax),
    collectedTax: String(r4(collectedSalesTotal + collectedExciseTotal)),
    lines: quote.lines.map((l) => ({ ...l, collected: undefined })) as unknown as Record<string, unknown>[],
    committedAt: new Date(),
    voidedAt: null,
    voidReason: null,
  };

  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.documentId, code));
    if (existing) await tx.update(taxDocuments).set(doc).where(eq(taxDocuments.id, existing.id));
    else await tx.insert(taxDocuments).values(doc);
    for (let i = 0; i < rows.length; i += 200) await tx.insert(transactions).values(rows.slice(i, i + 200));

    // The filing engine prices excise from the product record. A product
    // Quantum has never seen gets one now, carrying what checkout used (parsed
    // mL, estimated cost) so the return matches what was charged. Values a
    // person entered are never touched: only unknown fields are filled.
    for (const [i, l] of input.lines.entries()) {
      const q = quote.lines[i];
      const f = q.facts;
      await tx
        .insert(products)
        .values({
          sku: q.itemCode,
          description: q.description,
          source: "medusa",
          storeName: conn.name,
          medusaVariantId: l.variant_id ? `${conn.slug}:${l.variant_id}` : null,
          liquidMl: f.mlPerUnit === null ? null : String(f.mlPerUnit),
          mlSource: f.mlPerUnit === null ? "unknown" : "parsed",
          wholesaleCost: f.costPerUnit === null ? null : String(f.costPerUnit),
          costSource: f.costPerUnit === null ? "unknown" : f.costIsEstimate ? "estimated" : "medusa",
          cartridgesPerUnit: f.cartridgesPerUnit === null ? null : String(f.cartridgesPerUnit),
          systemType: f.systemType,
          systemTypeSource: f.systemType ? "inferred" : "unknown",
          containsNicotine: f.containsNicotine,
          classificationNote: `From ${conn.name} checkout: ${Object.entries(f.sources).map(([k, v]) => `${k} ${v}`).join("; ")}`,
          needsReview: f.costIsEstimate || f.mlPerUnit === null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: products.sku,
          set: {
            liquidMl: dsql`CASE WHEN ${products.mlSource} IN ('unknown') OR ${products.liquidMl} IS NULL THEN excluded.liquid_ml ELSE ${products.liquidMl} END`,
            mlSource: dsql`CASE WHEN ${products.mlSource} IN ('unknown') OR ${products.liquidMl} IS NULL THEN excluded.ml_source ELSE ${products.mlSource} END`,
            wholesaleCost: dsql`CASE WHEN ${products.costSource} IN ('unknown') OR ${products.wholesaleCost} IS NULL THEN excluded.wholesale_cost ELSE ${products.wholesaleCost} END`,
            costSource: dsql`CASE WHEN ${products.costSource} IN ('unknown') OR ${products.wholesaleCost} IS NULL THEN excluded.cost_source ELSE ${products.costSource} END`,
            systemType: dsql`COALESCE(${products.systemType}, excluded.system_type)`,
            updatedAt: new Date(),
          },
        });
    }

    // PACT: one shipment row per line, keyed exactly like the pull sync so the
    // two paths update the same rows rather than doubling a PACT report.
    const street = [input.address.line1, input.address.line2].filter(Boolean).join(", ") || null;
    const customer =
      [input.address.first_name, input.address.last_name].filter(Boolean).join(" ").trim() || input.address.company || input.email;
    for (const [i, l] of input.lines.entries()) {
      const q = quote.lines[i];
      const values = {
        integrationId: conn.id,
        sourceSystem: "medusa",
        sourceLabel: conn.name,
        externalId: `medusa:${conn.slug}:${input.order_id}:${l.id}`,
        orderNumber: input.order_number ?? input.order_id,
        period,
        state,
        customerName: customer ?? null,
        shipToAddress: street,
        shipToCity: input.address.city,
        shipToState: state,
        shipToZip: input.address.zip,
        invoiceDate: shippedOn,
        invoiceNumber: input.order_number ?? input.order_id,
        product: [l.title, l.variant_title].filter(Boolean).join(" - ") || null,
        brand: null,
        quantity: String(l.quantity),
        mlTotal: String((q.facts.mlPerUnit ?? 0) * l.quantity),
      };
      await tx
        .insert(shipments)
        .values(values)
        .onConflictDoUpdate({ target: shipments.externalId, set: { ...values, integrationId: undefined, externalId: undefined } });
    }
  });

  return {
    documentCode: code,
    status: "committed",
    period,
    state,
    salesTax: quote.totals.salesTax,
    exciseTax: quote.totals.exciseTax,
    collectedTax: r2(collectedSalesTotal + collectedExciseTotal),
    warnings,
  };
}

export type VoidResult = { documentCode: string; status: "voided" | "returned" | "not_found" | "already_voided"; period?: string; note?: string };

export async function voidOrder(conn: { slug: string }, orderId: string, reason: string): Promise<VoidResult> {
  const code = `quantum:${conn.slug}:${orderId}`;
  const [doc] = await db.select().from(taxDocuments).where(eq(taxDocuments.documentCode, code)).limit(1);
  if (!doc) {
    // Never committed (cancelled before shipping) - just make sure no PACT row lingers.
    await db.delete(shipments).where(like(shipments.externalId, `medusa:${conn.slug}:${orderId}:%`));
    return { documentCode: code, status: "not_found" };
  }
  if (doc.status === "voided") return { documentCode: code, status: "already_voided", period: doc.period };

  const filed = await isFiled(doc.state, "sales", doc.period);
  const pactFiled = await isFiled(doc.state, "pact", doc.period);
  const nowMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    if (filed) {
      const original = await tx.select().from(transactions).where(eq(transactions.documentId, code));
      const returnCode = `${code}:return`;
      await tx.delete(transactions).where(eq(transactions.documentId, returnCode));
      if (original.length) {
        await tx.insert(transactions).values(
          original.map((r) => ({
            ...r,
            id: undefined,
            createdAt: undefined,
            documentId: returnCode,
            docType: "Return Invoice",
            sign: -1,
            period: nowMonth,
            documentDate: today,
            reportingDate: today,
          })),
        );
      }
    } else {
      await tx.delete(transactions).where(eq(transactions.documentId, code));
    }
    if (!pactFiled) await tx.delete(shipments).where(like(shipments.externalId, `medusa:${conn.slug}:${orderId}:%`));
    await tx.update(taxDocuments).set({ status: "voided", voidedAt: new Date(), voidReason: reason }).where(eq(taxDocuments.id, doc.id));
  });

  return {
    documentCode: code,
    status: filed ? "returned" : "voided",
    period: doc.period,
    note: filed
      ? `${doc.period} was already filed - a Return Invoice was written into ${nowMonth}.`
      : pactFiled
        ? `${doc.period} PACT is already filed - its shipment rows were kept.`
        : undefined,
  };
}
