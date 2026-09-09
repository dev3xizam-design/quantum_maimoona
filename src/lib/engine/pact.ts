/**
 * PACT ACT MODULE (doc 06)
 *
 * Not a tax - a per-shipment DISCLOSURE, due monthly (usually the 10th) to
 * every state you ship ENDS into, from the very first shipment (no thresholds,
 * and it applies in AK/DE/MT/NH/OR too).
 *
 * Cigarette sections (PA-1 "sticks") stay blank - only the ENDS / consumable
 * material section applies.
 *
 * These rows carry customer PII. Never log them; render only where required.
 */

import { round2 } from "../money";
import { periodLabel, dueDate, isoDate } from "../periods";
import { parseMlFromDescription } from "../ingest/avalara";
import type { PactResult, PactRow, TxRow } from "./types";

export type ShipmentRow = {
  customerName: string | null;
  shipToAddress: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  shipToZip: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  product: string | null;
  brand: string | null;
  quantity: number;
  mlTotal: number;
};

export function computePact(opts: {
  state: string;
  period: string;
  shipments: ShipmentRow[];
  rows: TxRow[];
  products: Map<string, { liquidMl: number | null }>;
  portal: string | null;
  formName: string | null;
  dueDay: number | null;
}): PactResult {
  const notes: string[] = [];
  const warnings: string[] = [];
  let rows: PactRow[] = [];
  let source: "shipments" | "transactions" = "shipments";

  if (opts.shipments.length) {
    rows = opts.shipments.map((s) => ({
      customerName: s.customerName,
      shipToAddress: s.shipToAddress,
      shipToCity: s.shipToCity,
      shipToState: s.shipToState ?? opts.state,
      shipToZip: s.shipToZip,
      invoiceDate: s.invoiceDate,
      invoiceNumber: s.invoiceNumber,
      product: s.product,
      brand: s.brand,
      quantity: s.quantity,
      ml: s.mlTotal,
    }));
  } else {
    source = "transactions";
    const seen = new Set<string>();
    for (const r of opts.rows) {
      if ((r.jurisdictionType ?? "").trim().toLowerCase() !== "state") continue;
      if (/return/i.test(r.docType ?? "")) continue;
      const key = `${r.documentId}|${r.lineNo}|${r.itemCode ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const mlPerUnit =
        opts.products.get((r.itemCode ?? "").trim().toUpperCase())?.liquidMl ??
        parseMlFromDescription(r.itemDescription) ??
        0;
      rows.push({
        customerName: null,
        shipToAddress: null,
        shipToCity: r.destCity,
        shipToState: r.state,
        shipToZip: r.destZip,
        invoiceDate: r.documentDate,
        invoiceNumber: r.documentId,
        product: r.itemDescription ?? r.itemCode,
        brand: null,
        quantity: r.quantity,
        ml: round2(mlPerUnit * r.quantity),
      });
    }
    if (rows.length) {
      warnings.push(
        "Built from the Avalara sales export, which does not carry customer names or street addresses. PACT requires both - upload the shipment feed from the order/shipping system (Upload > Shipments) before filing.",
      );
    }
  }

  const incomplete = rows.filter((r) => !r.customerName || !r.shipToAddress).length;
  if (source === "shipments" && incomplete) {
    warnings.push(`${incomplete} shipment row(s) are missing a customer name or street address.`);
  }

  notes.push("Cigarette / PA-1 'sticks' sections stay blank - ENDS section only.");
  notes.push("PACT attaches from the first interstate shipment; economic-nexus thresholds do not apply.");

  return {
    state: opts.state,
    taxType: "pact",
    period: opts.period,
    periodLabel: periodLabel(opts.period),
    dueDate: isoDate(dueDate(opts.period, opts.dueDay ?? 10)),
    frequency: "MONTHLY",
    portal: opts.portal,
    form: opts.formName,
    rows,
    shipmentCount: rows.length,
    totalQuantity: round2(rows.reduce((s, r) => s + r.quantity, 0)),
    totalMl: round2(rows.reduce((s, r) => s + r.ml, 0)),
    source,
    notes,
    warnings,
  };
}
