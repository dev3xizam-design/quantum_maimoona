/**
 * Excise for ONE checkout line - the per-line twin of engine/excise.ts.
 *
 * The filing engine taxes a month's basket; checkout has to charge each line
 * the same way, so the formulas here mirror `basisFor` / `component` there
 * exactly (structures A-E, rate units pct_wholesale / pct_retail / per_ml /
 * per_unit). If the two ever disagree, what was collected stops matching what
 * is owed - keep them in step.
 *
 * Pure: no server-only import, so it is directly testable.
 */

import type { ExciseConfigRow } from "../engine/excise";

export type LineFacts = {
  quantity: number;
  /** Price actually charged per unit, after discounts. */
  unitPrice: number;
  /** mL in ONE sold unit (a 5-pack of 2mL pods = 10). Null = unknown. */
  mlPerUnit: number | null;
  /** Wholesale cost of ONE sold unit. Null = unknown. */
  costPerUnit: number | null;
  costIsEstimate: boolean;
  mlIsParsed: boolean;
  /** Cartridges / devices in ONE sold unit (a 5-pack = 5). */
  cartridgesPerUnit: number | null;
  systemType: "OPEN" | "CLOSED" | null;
  /** Batteries, coils, tanks - no consumable nicotine material. */
  isHardware: boolean;
  /** Shipping protection, gift cards, fees. */
  isNonProduct: boolean;
};

export type ExciseLine = {
  amount: number;
  /** Effective % of the line's price, for platforms that only take rates. */
  effectiveRate: number;
  label: string;
  basis: string;
  basisAmount: number;
  rate: number;
  rateUnit: string;
  /** Something the rate needs was estimated or missing - see notes. */
  estimated: boolean;
  notes: string[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Part = { amount: number; basis: string; basisAmount: number; rate: number; unit: string; notes: string[]; estimated: boolean };

function partFor(f: LineFacts, rate: number, unit: string): Part {
  const notes: string[] = [];
  let estimated = false;
  const q = f.quantity;
  switch (unit) {
    case "pct_retail": {
      const base = f.unitPrice * q;
      return { amount: base * rate, basis: "Retail price", basisAmount: base, rate, unit, notes, estimated };
    }
    case "per_ml": {
      if (f.mlPerUnit === null) {
        notes.push("mL unknown - no per-mL excise charged; enter mL for this product in Quantum");
        estimated = true;
        return { amount: 0, basis: "Millilitres", basisAmount: 0, rate, unit, notes, estimated };
      }
      if (f.mlIsParsed) notes.push("mL read from the product name/description");
      const base = f.mlPerUnit * q;
      return { amount: base * rate, basis: "Millilitres", basisAmount: base, rate, unit, notes, estimated };
    }
    case "per_unit": {
      const base = (f.cartridgesPerUnit ?? 1) * q;
      return { amount: base * rate, basis: "Cartridges / units", basisAmount: base, rate, unit, notes, estimated };
    }
    case "pct_wholesale":
    default: {
      if (f.costPerUnit === null) {
        notes.push("wholesale cost unknown - no excise charged; enter cost in Quantum");
        estimated = true;
        return { amount: 0, basis: "Wholesale cost", basisAmount: 0, rate, unit, notes, estimated };
      }
      if (f.costIsEstimate) {
        notes.push("wholesale cost ESTIMATED from the selling price");
        estimated = true;
      }
      const base = f.costPerUnit * q;
      return { amount: base * rate, basis: "Wholesale cost", basisAmount: base, rate, unit, notes, estimated };
    }
  }
}

export function exciseForLine(config: ExciseConfigRow | null, f: LineFacts): ExciseLine | null {
  if (!config) return null;
  if (f.isNonProduct || f.quantity <= 0) return null;
  if (f.isHardware) return null;
  // RECEIPTS-basis states (KS) tax inventory purchased, not the sale - the
  // retailer pays on receipt, so there is nothing to charge at checkout.
  if (config.basis === "RECEIPTS") return null;

  const structure = config.structure.toUpperCase();
  let part: Part;
  const notes: string[] = [];

  if (structure === "E") {
    const open = partFor(f, config.openRate ?? 0, config.openRateUnit ?? "pct_wholesale");
    const closed = partFor(f, config.closedRate ?? 0, config.closedRateUnit ?? "per_unit");
    if (f.systemType === "OPEN") part = open;
    else if (f.systemType === "CLOSED") part = closed;
    else {
      // The filing engine excludes an unclassified SKU from both buckets and
      // warns. At checkout, charging nothing would under-collect for certain;
      // take the larger of the two and flag the SKU for classification.
      part = open.amount >= closed.amount ? open : closed;
      part = { ...part, estimated: true };
      notes.push("open/closed not set - charged the higher of the two rates; classify this product in Quantum");
    }
  } else {
    part = partFor(f, config.rate, config.rateUnit);
  }

  const amount = r2(part.amount);
  const lineTotal = f.unitPrice * f.quantity;
  return {
    amount,
    effectiveRate: lineTotal > 0 ? (part.amount / lineTotal) * 100 : 0,
    label: `${config.state} excise tax`,
    basis: part.basis,
    basisAmount: r2(part.basisAmount),
    rate: part.rate,
    rateUnit: part.unit,
    estimated: part.estimated,
    notes: [...notes, ...part.notes],
  };
}
