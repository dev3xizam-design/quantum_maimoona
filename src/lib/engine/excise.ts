/**
 * VAPOR / NICOTINE EXCISE ENGINE
 *
 * Five structures (doc 02):
 *   A  % of wholesale cost      EXCISE = wholesale_cost x rate
 *   B  % of retail price        EXCISE = retail_price x rate
 *   C  per millilitre           EXCISE = total_mL x rate_per_mL
 *   D  per cartridge / unit     EXCISE = units x rate_per_unit
 *   E  bifurcated open/closed   EXCISE = open_base x open_rate + closed_qty x closed_rate
 *
 * ...and two BASES, which is the Kansas lesson: a RECEIPTS-basis return taxes
 * what you PURCHASED into inventory that month (EC-2 Line 1a), not what you
 * sold. Receipts-basis states read the purchase import, never the sales export.
 */

import { round2 } from "../money";
import { periodLabel, dueDate, isoDate } from "../periods";
import { parseMlFromDescription } from "../ingest/avalara";
import type { ExciseComponent, ExciseResult, TxRow } from "./types";

export type ExciseConfigRow = {
  state: string;
  structure: string;
  basis: "SALES" | "RECEIPTS";
  rate: number;
  rateUnit: string;
  openRate: number | null;
  openRateUnit: string | null;
  closedRate: number | null;
  closedRateUnit: string | null;
  frequency: string;
  portal: string | null;
  formName: string | null;
  dueDay: number | null;
  notes: string | null;
};

export type ProductRow = {
  sku: string;
  description: string | null;
  wholesaleCost: number | null;
  retailPrice: number | null;
  liquidMl: number | null;
  cartridgesPerUnit: number | null;
  systemType: string | null;
  containsNicotine: boolean;
};

export type PurchaseRow = {
  sku: string | null;
  description: string | null;
  quantity: number;
  mlTotal: number;
  unitsTotal: number;
  wholesaleCost: number;
};

type Basket = {
  ml: number;
  units: number;
  cartridges: number;
  wholesale: number;
  retail: number;
};

const zeroBasket = (): Basket => ({ ml: 0, units: 0, cartridges: 0, wholesale: 0, retail: 0 });

const isReturn = (r: TxRow) => /return/i.test(r.docType ?? "");
const signedValue = (v: number, ret: boolean) => (ret ? -Math.abs(v) : v);

/** Deduped sale lines (the sales export repeats each line per jurisdiction). */
function dedupeSaleLines(rows: TxRow[]): TxRow[] {
  const seen = new Set<string>();
  const out: TxRow[] = [];
  for (const r of rows) {
    if ((r.jurisdictionType ?? "").trim().toLowerCase() !== "state") continue;
    const key = `${r.documentId}|${r.lineNo}|${r.itemCode ?? ""}|${r.ref1 ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function computeExcise(opts: {
  config: ExciseConfigRow;
  period: string;
  rows: TxRow[];
  purchases: PurchaseRow[];
  products: ProductRow[];
}): ExciseResult {
  const { config, period } = opts;
  const notes: string[] = [];
  const warnings: string[] = [];
  const productBySku = new Map(opts.products.map((p) => [p.sku.trim().toUpperCase(), p]));

  const open = zeroBasket();
  const closed = zeroBasket();
  const unknown = zeroBasket();
  const missingSkus = new Set<string>();
  /** SKUs actually used this period that are missing something the rate needs. */
  const gaps = {
    cost: new Map<string, { units: number; retail: number; description: string | null }>(),
    ml: new Map<string, { units: number; retail: number; description: string | null }>(),
    system: new Map<string, { units: number; retail: number; description: string | null }>(),
  };
  const noteGap = (
    which: keyof typeof gaps,
    sku: string,
    description: string | null,
    units: number,
    retail: number,
  ) => {
    if (!sku) return;
    const e = gaps[which].get(sku) ?? { units: 0, retail: 0, description };
    e.units += units;
    e.retail += retail;
    gaps[which].set(sku, e);
  };
  let skuTotal = 0;
  let skuMatched = 0;

  const bucketFor = (systemType: string | null | undefined) => {
    const t = (systemType ?? "").trim().toUpperCase();
    if (t === "OPEN") return open;
    if (t === "CLOSED") return closed;
    return unknown;
  };

  if (config.basis === "RECEIPTS") {
    notes.push(
      "RECEIPTS basis: this return taxes product PURCHASED into inventory this period, not product sold. Figures come from the purchase import.",
    );
    for (const p of opts.purchases) {
      const product = p.sku ? productBySku.get(p.sku.trim().toUpperCase()) : undefined;
      skuTotal += 1;
      if (product) skuMatched += 1;
      else if (p.sku) missingSkus.add(p.sku);

      const b = bucketFor(product?.systemType);
      const mlPerUnit = product?.liquidMl ?? parseMlFromDescription(p.description) ?? null;
      const ml = p.mlTotal || (mlPerUnit ?? 0) * p.quantity;
      const units = p.unitsTotal || p.quantity;
      const cost = p.wholesaleCost || (product?.wholesaleCost ?? 0) * p.quantity;
      const retail = (product?.retailPrice ?? 0) * p.quantity;

      b.ml += ml;
      b.units += units;
      b.cartridges += (product?.cartridgesPerUnit ?? 1) * p.quantity;
      b.wholesale += cost;
      b.retail += retail;

      const key = (p.sku ?? "").trim().toUpperCase();
      if (cost === 0) noteGap("cost", key, p.description ?? null, units, retail);
      if (!p.mlTotal && mlPerUnit === null) noteGap("ml", key, p.description ?? null, units, retail);
      if (!product?.systemType) noteGap("system", key, p.description ?? null, units, retail);
    }
    if (!opts.purchases.length) {
      warnings.push(
        `No purchase rows loaded for ${period}. Upload the month's purchase file (Upload > Purchases) - this return cannot be computed from sales data.`,
      );
    }
  } else {
    const lines = dedupeSaleLines(opts.rows);
    for (const r of lines) {
      const ret = isReturn(r);
      const qty = signedValue(r.quantity, ret);
      const lineRetail = signedValue(r.lineAmount - r.discountAmount, ret);
      const sku = (r.itemCode ?? "").trim().toUpperCase();
      const product = sku ? productBySku.get(sku) : undefined;
      skuTotal += 1;
      if (product) skuMatched += 1;
      else if (sku) missingSkus.add(sku);

      const b = bucketFor(product?.systemType);
      const mlPerUnit = product?.liquidMl ?? parseMlFromDescription(r.itemDescription) ?? null;
      const cost = (product?.wholesaleCost ?? 0) * qty;
      // The line amount IS the retail price actually charged - use it over any
      // list price on the product record.
      const retail = lineRetail || (product?.retailPrice ?? 0) * qty;

      b.ml += (mlPerUnit ?? 0) * qty;
      b.units += qty;
      b.cartridges += (product?.cartridgesPerUnit ?? 1) * qty;
      b.wholesale += cost;
      b.retail += retail;

      const desc = product?.description ?? r.itemDescription ?? null;
      if (cost === 0) noteGap("cost", sku, desc, qty, retail);
      if (mlPerUnit === null) noteGap("ml", sku, desc, qty, retail);
      if (!product?.systemType) noteGap("system", sku, desc, qty, retail);
    }
  }

  const all: Basket = {
    ml: round2(open.ml + closed.ml + unknown.ml),
    units: round2(open.units + closed.units + unknown.units),
    cartridges: round2(open.cartridges + closed.cartridges + unknown.cartridges),
    wholesale: round2(open.wholesale + closed.wholesale + unknown.wholesale),
    retail: round2(open.retail + closed.retail + unknown.retail),
  };

  const components: ExciseComponent[] = [];
  const structure = config.structure.toUpperCase();

  if (structure === "E") {
    if (unknown.units !== 0) {
      warnings.push(
        `${round2(unknown.units)} unit(s) have no OPEN/CLOSED flag in the product master. A bifurcated state needs every SKU classified - they are excluded from both rate buckets below.`,
      );
    }
    components.push(
      component("Open system", open, config.openRate ?? 0, config.openRateUnit ?? "pct_wholesale"),
    );
    components.push(
      component("Closed system", closed, config.closedRate ?? 0, config.closedRateUnit ?? "per_unit"),
    );
  } else {
    components.push(component("All product", all, config.rate, config.rateUnit));
  }

  const taxComputed = round2(components.reduce((s, c) => s + c.tax, 0));

  /* ---- Data-gap reporting -------------------------------------------
   * A missing wholesale cost or mL is NOT a rounding issue - it silently
   * understates the tax. Name the SKUs, ranked by the revenue they carry, so
   * the biggest gaps get filled first.
   */
  const usesCost =
    config.rateUnit === "pct_wholesale" ||
    config.openRateUnit === "pct_wholesale" ||
    config.closedRateUnit === "pct_wholesale";
  const usesMl =
    config.rateUnit === "per_ml" ||
    config.openRateUnit === "per_ml" ||
    config.closedRateUnit === "per_ml";

  const rank = (m: Map<string, { units: number; retail: number; description: string | null }>) =>
    [...m.entries()]
      .map(([sku, v]) => ({ sku, ...v, retail: round2(v.retail), units: round2(v.units) }))
      .sort((a, b) => b.retail - a.retail);

  const costGaps = rank(gaps.cost);
  const mlGaps = rank(gaps.ml);
  const systemGaps = rank(gaps.system);

  const listSkus = (rows: { sku: string; retail: number }[]) =>
    rows
      .slice(0, 5)
      .map((r) => `${r.sku} (${r.retail.toFixed(2)})`)
      .join(", ") + (rows.length > 5 ? `, +${rows.length - 5} more` : "");

  if (usesCost && costGaps.length) {
    const affected = round2(costGaps.reduce((s, r) => s + r.retail, 0));
    warnings.push(
      `WHOLESALE COST MISSING for ${costGaps.length} SKU(s) covering ${affected.toFixed(2)} of retail this period, so the tax below is understated. A sales-tax export does not carry cost - upload the purchase import, or enter the cost on the Products page. Biggest first: ${listSkus(costGaps)}.`,
    );
  }
  if (usesMl && mlGaps.length) {
    const affected = round2(mlGaps.reduce((s, r) => s + r.retail, 0));
    warnings.push(
      `mL MISSING for ${mlGaps.length} SKU(s) covering ${affected.toFixed(2)} of retail this period. Pods and disposables rarely state a volume in the name, so it has to be entered once per SKU on the Products page. Biggest first: ${listSkus(mlGaps)}.`,
    );
  }
  if (structure === "E" && systemGaps.length) {
    warnings.push(
      `OPEN/CLOSED NOT SET for ${systemGaps.length} SKU(s) in a bifurcated state - they are excluded from both rate buckets. Set them on the Products page (bulk-select works). Biggest first: ${listSkus(systemGaps)}.`,
    );
  }
  if (missingSkus.size) {
    notes.push(
      `${missingSkus.size} SKU(s) sold this period are not yet in the product master. Upload again or press Rebuild catalog on the Products page.`,
    );
  }
  if (config.notes) notes.push(config.notes);

  return {
    state: config.state,
    taxType: "excise",
    period,
    periodLabel: periodLabel(period),
    structure,
    basis: config.basis,
    frequency: config.frequency,
    form: config.formName,
    portal: config.portal,
    dueDate: isoDate(dueDate(period, config.dueDay)),
    totalMl: all.ml,
    totalUnits: all.units,
    totalCartridges: all.cartridges,
    wholesaleCost: all.wholesale,
    retailPrice: all.retail,
    components,
    taxComputed,
    skuCoverage: { total: skuTotal, matched: skuMatched, missing: [...missingSkus] },
    dataGaps: { cost: costGaps, ml: mlGaps, systemType: systemGaps },
    notes,
    warnings,
  };
}

function component(label: string, b: Basket, rate: number, unit: string): ExciseComponent {
  const [basisAmount, basisLabel] = basisFor(b, unit);
  return {
    label,
    basisLabel,
    basisAmount: round2(basisAmount),
    rate,
    rateUnit: unit,
    tax: round2(basisAmount * rate),
  };
}

function basisFor(b: Basket, unit: string): [number, string] {
  switch (unit) {
    case "pct_retail":
      return [b.retail, "Retail price"];
    case "per_ml":
      return [b.ml, "Millilitres"];
    case "per_unit":
      return [b.cartridges, "Cartridges / units"];
    case "pct_wholesale":
    default:
      return [b.wholesale, "Wholesale cost"];
  }
}

export function rateUnitLabel(unit: string): string {
  return (
    {
      pct_wholesale: "% of wholesale cost",
      pct_retail: "% of retail price",
      per_ml: "$ per mL",
      per_unit: "$ per cartridge/unit",
    } as Record<string, string>
  )[unit] ?? unit;
}
