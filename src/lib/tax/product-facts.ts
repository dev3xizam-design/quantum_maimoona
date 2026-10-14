/**
 * What excise needs to know about one sold unit, from three layers:
 *
 *   1. Quantum's product record (cost / mL / open-closed entered by a person,
 *      from a purchase import, or from Medusa metadata) - always wins.
 *   2. Parsed from the store's own text: mL from the title, then from the
 *      description ("E-Liquid Capacity: 15mL"), times the pack count.
 *   3. Cost estimated as a share of the list price when nothing better exists.
 *
 * Every value carries where it came from, so checkout can say "estimated" and
 * the Products page can list what still needs a real number.
 *
 * Pure: no server-only import.
 */

import { classifyProduct } from "../products/classify";
import type { LineFacts } from "./excise-line";

export type StoreLine = {
  id: string;
  variantId?: string | null;
  productId?: string | null;
  sku?: string | null;
  barcode?: string | null;
  title?: string | null;
  variantTitle?: string | null;
  productType?: string | null;
  description?: string | null;
  quantity: number;
  /** List price per unit, before discounts. */
  unitPrice: number;
  /** Total discount on the line (not per unit). */
  discount?: number;
};

export type KnownProduct = {
  sku: string;
  description: string | null;
  wholesaleCost: number | null;
  costSource: string | null;
  liquidMl: number | null;
  mlSource: string | null;
  cartridgesPerUnit: number | null;
  systemType: string | null;
  containsNicotine: boolean;
};

export type ResolvedFacts = LineFacts & {
  /** Quantum product SKU this line maps to, if any - the transactions item code. */
  sku: string | null;
  description: string;
  sources: { ml: string; cost: string; system: string };
  containsNicotine: boolean;
};

/**
 * Volume stated in a description: prefer a figure next to liquid/capacity
 * wording ("E-Liquid Capacity: 15mL", "pre-filled with 2mL"); a bare "30ml"
 * anywhere is accepted only when it is the only volume mentioned, because
 * descriptions often list several sizes ("available in 30ml and 60ml").
 */
export function mlFromDescription(text: string | null | undefined): { ml: number; evidence: string } | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ");
  const near =
    t.match(/(?:e-?\s?liquid|e-?\s?juice|liquid|juice|pod)\s*(?:capacity|volume|content)?\s*[:\-]?\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*-?\s*ml\b/i) ??
    t.match(/(?:capacity|volume|pre-?\s?filled(?:\s+with)?|prefilled(?:\s+with)?)\s*[:\-]?\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*-?\s*ml\b/i) ??
    t.match(/(\d+(?:\.\d+)?)\s*-?\s*ml\s*(?:of\s*)?(?:e-?\s?liquid|e-?\s?juice|liquid|juice|capacity|pre-?\s?filled|prefilled)/i);
  if (near) {
    const v = Number(near[1]);
    if (v > 0 && v <= 2000) return { ml: v, evidence: near[0].trim() };
  }
  const all = [...t.matchAll(/(\d+(?:\.\d+)?)\s*-?\s*ml\b/gi)].map((m) => Number(m[1]));
  const distinct = [...new Set(all.filter((v) => v > 0 && v <= 2000))];
  if (distinct.length === 1) return { ml: distinct[0], evidence: `${distinct[0]}mL (only volume in description)` };
  return null;
}

/** "5 Pack", "Pack of 10", "10ct", "3 x" in the VARIANT title - units per sold unit. */
export function packCount(variantTitle: string | null | undefined): number {
  if (!variantTitle) return 1;
  const m =
    variantTitle.match(/(\d+)\s*(?:-|\s)?\s*(?:pack|pk|ct|count|pcs|pieces)\b/i) ??
    variantTitle.match(/\bpack\s*of\s*(\d+)/i) ??
    variantTitle.match(/\b(\d+)\s*x\b/i);
  const n = m ? Number(m[1]) : 1;
  return n > 0 && n <= 200 ? n : 1;
}

/** Medusa product types that settle open vs closed where the name does not. */
function systemFromType(type: string | null | undefined): "OPEN" | "CLOSED" | null {
  const t = (type ?? "").toLowerCase();
  if (/disposable|pod|cartridge/.test(t)) return "CLOSED";
  if (/e-?juice|e-?liquid|salt/.test(t)) return "OPEN";
  return null;
}

export function resolveFacts(
  line: StoreLine,
  known: KnownProduct | null,
  opts: { costEstimateRatio: number | null },
): ResolvedFacts {
  const name = [line.title, line.variantTitle].filter(Boolean).join(" - ");
  const c = classifyProduct(name, line.sku);
  const pack = packCount(line.variantTitle);
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const discountPerUnit = quantity > 0 ? (Number(line.discount) || 0) / quantity : 0;

  /* ---- mL per sold unit ---- */
  let mlPerUnit: number | null = null;
  let mlSource = "unknown";
  let mlIsParsed = false;
  if (known?.liquidMl != null && known.mlSource !== "unknown") {
    mlPerUnit = known.liquidMl;
    mlSource = known.mlSource ?? "quantum";
  } else {
    // A volume in the VARIANT title ("3 x 60ml") already describes the sold
    // unit; one in the product title or description is per device/bottle.
    const fromVariant = classifyProduct(line.variantTitle ?? "", null).liquidMl;
    const fromTitle = classifyProduct(line.title ?? "", null).liquidMl;
    const fromDesc = mlFromDescription(line.description);
    if (fromVariant !== null) {
      mlPerUnit = fromVariant * (/\bx\b|pack|pk/i.test(line.variantTitle ?? "") ? pack : 1);
      mlSource = "parsed:variant-title";
    } else if (fromTitle !== null) {
      mlPerUnit = fromTitle * pack;
      mlSource = "parsed:title";
    } else if (fromDesc) {
      mlPerUnit = fromDesc.ml * pack;
      mlSource = `parsed:description (${fromDesc.evidence})`;
    }
    mlIsParsed = mlPerUnit !== null;
  }

  /* ---- wholesale cost per sold unit ---- */
  let costPerUnit: number | null = null;
  let costSource = "unknown";
  let costIsEstimate = false;
  if (known?.wholesaleCost != null && known.costSource !== "estimated") {
    costPerUnit = known.wholesaleCost;
    costSource = known.costSource ?? "quantum";
  } else if (opts.costEstimateRatio && unitPrice > 0) {
    costPerUnit = Math.round(unitPrice * opts.costEstimateRatio * 10000) / 10000;
    costSource = `estimated (${Math.round(opts.costEstimateRatio * 100)}% of list price)`;
    costIsEstimate = true;
  }

  /* ---- open / closed ---- */
  let systemType: "OPEN" | "CLOSED" | null = null;
  let systemSource = "unknown";
  const knownSys = (known?.systemType ?? "").toUpperCase();
  if (knownSys === "OPEN" || knownSys === "CLOSED") {
    systemType = knownSys;
    systemSource = "quantum";
  } else if (c.systemType) {
    systemType = c.systemType;
    systemSource = `parsed: ${c.systemEvidence}`;
  } else {
    systemType = systemFromType(line.productType);
    if (systemType) systemSource = `product type "${line.productType}"`;
  }

  return {
    sku: known?.sku ?? null,
    description: known?.description ?? name,
    quantity,
    unitPrice: Math.max(0, unitPrice - discountPerUnit),
    mlPerUnit,
    costPerUnit,
    costIsEstimate,
    mlIsParsed,
    cartridgesPerUnit: known?.cartridgesPerUnit ?? pack,
    systemType,
    isHardware: c.isHardware,
    isNonProduct: c.isNonProduct,
    containsNicotine: known ? known.containsNicotine : c.containsNicotine,
    sources: { ml: mlSource, cost: costSource, system: systemSource },
  };
}
