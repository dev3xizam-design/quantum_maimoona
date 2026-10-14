/**
 * Reads what a product name actually says. Nothing here invents a number:
 * every field comes back with the evidence that produced it, or null.
 *
 * mL is only ever taken from an explicit volume in the name. Puff counts are
 * NOT converted to mL - that conversion varies by device and would be a guess
 * on a tax return.
 */

export type Classification = {
  liquidMl: number | null;
  mlEvidence: string | null;
  cartridgesPerUnit: number | null;
  packEvidence: string | null;
  systemType: "OPEN" | "CLOSED" | null;
  systemEvidence: string | null;
  containsNicotine: boolean;
  nicotineEvidence: string | null;
  isHardware: boolean;
  /** Shipping, fees, gift cards - present on invoices, not merchandise. */
  isNonProduct: boolean;
};

/** Words that mean a sealed, pre-filled device: a CLOSED system. */
const CLOSED_TERMS = [
  "disposable", "disposables", "pod", "pods", "cartridge", "cartridges", "cart",
  "prefilled", "pre-filled", "puff", "puffs", "closed system",
];

/** Words that mean refillable liquid the customer pours: an OPEN system. */
const OPEN_TERMS = [
  "e-liquid", "eliquid", "e liquid", "juice", "ejuice", "e-juice", "salt nic",
  "saltnic", "salt nicotine", "nic salt", "freebase", "free base", "shortfill",
  "bottle", "unicorn", "chubby gorilla", "open system", "refill",
];

/** Devices and accessories that are not consumable nicotine material. */
const HARDWARE_TERMS = [
  "battery", "batteries", "charger", "coil", "coils", "tank", "mod", "glass",
  "drip tip", "cotton", "wire", "case", "lanyard", "screwdriver", "adapter",
  "replacement glass", "hardware", "device only",
];

const NON_NICOTINE_TERMS = ["zero nicotine", "nicotine free", "nicotine-free", "cbd", "hemp"];
/**
 * A strength of exactly zero ("0mg", "0 mg", "0.0mg", "0%"), not the tail of
 * "50mg" or "20 mg" - a plain substring test called every 10/20/30/50mg
 * product nicotine-free.
 */
const ZERO_STRENGTH = /(?<![\d.])0(?:\.0+)?\s*(?:mg|%)(?![a-z])/i;

/**
 * Line items that are not merchandise at all. They still appear on every sale
 * line, so without this they sit in the catalog demanding a wholesale cost and
 * an mL volume that will never exist.
 */
const NON_PRODUCT_TERMS = [
  "shipping", "handling", "freight", "delivery charge", "package protection",
  "route protection", "shipping protection", "insurance", "adult signature",
  "signature required", "gift card", "gift certificate", "store credit",
  "discount", "coupon", "rounding", "surcharge", "processing fee",
  "convenience fee", "restocking", "donation", "tip",
];

function findTerm(haystack: string, terms: string[]): string | null {
  for (const t of terms) {
    if (haystack.includes(t)) return t;
  }
  return null;
}

export function classifyProduct(name: string | null | undefined, sku?: string | null): Classification {
  const raw = `${name ?? ""} ${sku ?? ""}`.trim();
  const s = raw.toLowerCase();

  const out: Classification = {
    liquidMl: null,
    mlEvidence: null,
    cartridgesPerUnit: null,
    packEvidence: null,
    systemType: null,
    systemEvidence: null,
    containsNicotine: true,
    nicotineEvidence: null,
    isHardware: false,
    isNonProduct: false,
  };

  if (!raw) return out;

  /* ---- Volume: only an explicit mL figure counts ---------------------- */
  const mlMatch = raw.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:ml|mls|milliliters?|millilitres?)\b/i);
  if (mlMatch) {
    const v = Number(mlMatch[1]);
    if (v > 0 && v <= 2000) {
      out.liquidMl = v;
      out.mlEvidence = mlMatch[0].trim();
    }
  }

  /* ---- Pack size ------------------------------------------------------ */
  const packMatch =
    raw.match(/(\d+)\s*(?:-|\s)?\s*(?:pack|pk|ct|count|pcs|pieces)\b/i) ??
    raw.match(/\bpack\s*of\s*(\d+)/i) ??
    raw.match(/\bx\s?(\d+)\b/i);
  if (packMatch) {
    const v = Number(packMatch[1]);
    if (v > 0 && v <= 200) {
      out.cartridgesPerUnit = v;
      out.packEvidence = packMatch[0].trim();
    }
  }

  /* ---- Not merchandise ------------------------------------------------ */
  const nonProduct = findTerm(s, NON_PRODUCT_TERMS);
  if (nonProduct) {
    out.isNonProduct = true;
    out.containsNicotine = false;
    out.nicotineEvidence = `"${nonProduct}" - a charge or fee, not merchandise`;
    return out;
  }

  /* ---- Hardware ------------------------------------------------------- */
  const hardware = findTerm(s, HARDWARE_TERMS);
  if (hardware && !findTerm(s, ["pod kit", "starter kit"])) {
    out.isHardware = true;
    out.containsNicotine = false;
    out.nicotineEvidence = `"${hardware}" - accessory/hardware, not consumable material`;
  }

  /* ---- Open vs closed ------------------------------------------------- */
  const closed = findTerm(s, CLOSED_TERMS);
  const open = findTerm(s, OPEN_TERMS);

  if (open && !closed) {
    out.systemType = "OPEN";
    out.systemEvidence = `name contains "${open}"`;
  } else if (closed && !open) {
    out.systemType = "CLOSED";
    out.systemEvidence = `name contains "${closed}"`;
  } else if (open && closed) {
    // e.g. "Refill Pods" - ambiguous, a human must decide.
    out.systemType = null;
    out.systemEvidence = `ambiguous - name contains both "${open}" and "${closed}"`;
  } else if (out.liquidMl !== null && out.liquidMl >= 15) {
    // A bottle-sized volume with no device words is refillable liquid.
    out.systemType = "OPEN";
    out.systemEvidence = `${out.liquidMl}mL volume with no device wording - bottled liquid`;
  }

  if (out.isHardware) {
    out.systemType = null;
    out.systemEvidence = "hardware - no open/closed classification applies";
  }

  /* ---- Nicotine ------------------------------------------------------- */
  const zero = ZERO_STRENGTH.exec(s)?.[0] ?? null;
  const nonNic = findTerm(s, NON_NICOTINE_TERMS) ?? zero;
  if (nonNic && !out.isHardware) {
    out.containsNicotine = false;
    out.nicotineEvidence = `name contains "${nonNic}"`;
  } else if (!out.isHardware) {
    const strength = raw.match(/(\d+(?:\.\d+)?)\s*(?:mg|%)\b/i);
    if (strength && Number(strength[1]) > 0) {
      out.nicotineEvidence = `nicotine strength "${strength[0].trim()}" in the name`;
    }
  }

  return out;
}

/** One-line explanation of how a product was classified, for the UI. */
export function classificationSummary(c: Classification): string {
  const bits: string[] = [];
  if (c.mlEvidence) bits.push(`${c.liquidMl}mL from "${c.mlEvidence}"`);
  if (c.packEvidence) bits.push(`${c.cartridgesPerUnit} per unit from "${c.packEvidence}"`);
  if (c.systemEvidence) bits.push(c.systemEvidence);
  if (c.nicotineEvidence) bits.push(c.nicotineEvidence);
  return bits.join("; ") || "nothing determinable from the name";
}
