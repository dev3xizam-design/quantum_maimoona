import type { products } from "@/db/schema";

/**
 * Turns a human's edit into a database update. Pure, so the rule that matters -
 * "a value you typed is yours forever, a value you clear goes back to being
 * derived" - is directly testable.
 */

export type ProductEditInput = {
  description?: string;
  wholesaleCost?: string;
  retailPrice?: string;
  liquidMl?: string;
  cartridgesPerUnit?: string;
  systemType?: string;
  containsNicotine?: boolean;
};

type Product = typeof products.$inferSelect;

const NUMERIC_FIELDS = [
  { field: "wholesaleCost", sourceField: "costSource" },
  { field: "retailPrice", sourceField: "priceSource" },
  { field: "liquidMl", sourceField: "mlSource" },
  { field: "cartridgesPerUnit", sourceField: null },
] as const;

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function buildProductUpdate(prior: Product, input: ProductEditInput) {
  const locked = new Set(prior.lockedFields ?? []);
  const set: Record<string, unknown> = { updatedAt: new Date() };

  const description = (input.description ?? "").trim();
  if (description && description !== prior.description) {
    set.description = description;
    locked.add("description");
  }

  for (const { field, sourceField } of NUMERIC_FIELDS) {
    const raw = (input[field] ?? "").trim();
    if (raw === "") {
      // Cleared: hand the field back to the automatic build.
      locked.delete(field);
      set[field] = null;
      if (sourceField) set[sourceField] = "unknown";
    } else {
      const value = parseNumber(raw);
      if (value === null) continue; // unparseable - leave it untouched
      set[field] = String(value);
      locked.add(field);
      if (sourceField) set[sourceField] = "manual";
    }
  }

  const systemType = (input.systemType ?? "").trim().toUpperCase();
  if (systemType === "") {
    locked.delete("systemType");
    set.systemType = null;
    set.systemTypeSource = "unknown";
  } else if (systemType === "OPEN" || systemType === "CLOSED") {
    set.systemType = systemType;
    locked.add("systemType");
    set.systemTypeSource = "manual";
  }

  const nicotine = input.containsNicotine ?? prior.containsNicotine;
  if (nicotine !== prior.containsNicotine) {
    set.containsNicotine = nicotine;
    locked.add("containsNicotine");
  }

  set.lockedFields = [...locked];

  const pick = <T,>(key: string, fallback: T) => (key in set ? (set[key] as T) : fallback);
  set.needsReview =
    (pick("containsNicotine", prior.containsNicotine) as boolean) &&
    (pick("wholesaleCost", prior.wholesaleCost) === null ||
      pick("systemType", prior.systemType) === null ||
      pick("liquidMl", prior.liquidMl) === null);

  return set;
}
