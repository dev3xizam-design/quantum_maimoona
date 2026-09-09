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
      const ml =
        p.mlTotal ||
        (product?.liquidMl ?? parseMlFromDescription(p.description) ?? 0) * p.quantity;
      const units = p.unitsTotal || p.quantity;
      b.ml += ml;
      b.units += units;
      b.cartridges += (product?.cartridgesPerUnit ?? 1) * p.quantity;
      b.wholesale += p.wholesaleCost || (product?.wholesaleCost ?? 0) * p.quantity;
      b.retail += (product?.retailPrice ?? 0) * p.quantity;
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
      const mlPerUnit = product?.liquidMl ?? parseMlFromDescription(r.itemDescription) ?? 0;
      b.ml += mlPerUnit * qty;
      b.units += qty;
      b.cartridges += (product?.cartridgesPerUnit ?? 1) * qty;
      b.wholesale += (product?.wholesaleCost ?? 0) * qty;
      b.retail += lineRetail || (product?.retailPrice ?? 0) * qty;
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

  if (structure !== "E" && config.rateUnit === "pct_wholesale" && all.wholesale === 0) {
    warnings.push(
      "Wholesale cost basis is zero - the product master has no wholesale_cost for these SKUs. Load it before filing.",
    );
  }
  if (structure !== "E" && config.rateUnit === "per_ml" && all.ml === 0) {
    warnings.push(
      "mL basis is zero - pods/disposables rarely state mL in the item name, so liquid_ml must come from the product master.",
    );
  }
  if (missingSkus.size) {
    warnings.push(
      `${missingSkus.size} SKU(s) are not in the product master: ${[...missingSkus].slice(0, 10).join(", ")}${missingSkus.size > 10 ? "..." : ""}`,
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
