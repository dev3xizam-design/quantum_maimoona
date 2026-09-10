"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { refreshProductCatalog } from "@/lib/products/catalog";
import { buildProductUpdate } from "@/lib/products/edit";

export async function rebuildCatalog() {
  await requireSession();
  try {
    const result = await refreshProductCatalog();
    revalidatePath("/products");
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * A human edit wins permanently: the field is recorded in `lockedFields` and
 * every future catalog rebuild leaves it alone. Clearing a field unlocks it,
 * so it goes back to being derived from the data.
 */
export async function saveProduct(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  const [prior] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!prior) return;

  const str = (k: string) => String(formData.get(k) ?? "");
  const set = buildProductUpdate(prior, {
    description: str("description"),
    wholesaleCost: str("wholesaleCost"),
    retailPrice: str("retailPrice"),
    liquidMl: str("liquidMl"),
    cartridgesPerUnit: str("cartridgesPerUnit"),
    systemType: str("systemType"),
    containsNicotine: formData.get("containsNicotine") === "on",
  });

  await db.update(products).set(set).where(eq(products.id, id));
  revalidatePath("/products");
}

/** Bulk classify - the fastest way to clear an open/closed backlog. */
export async function bulkSetSystemType(formData: FormData) {
  await requireSession();
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const systemType = String(formData.get("systemType") ?? "").trim();
  if (!ids.length || !["OPEN", "CLOSED"].includes(systemType)) return;

  const rows = await db.select().from(products).where(inArray(products.id, ids));
  for (const p of rows) {
    const locked = new Set(p.lockedFields ?? []);
    locked.add("systemType");
    await db
      .update(products)
      .set({
        systemType,
        systemTypeSource: "manual",
        lockedFields: [...locked],
        needsReview: p.containsNicotine && (p.wholesaleCost === null || p.liquidMl === null),
        updatedAt: new Date(),
      })
      .where(eq(products.id, p.id));
  }

  revalidatePath("/products");
}
