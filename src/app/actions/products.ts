"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql as dsql } from "drizzle-orm";
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

export type ReviewScope = "all" | "needs_review" | "selected";

/**
 * Reviewing is an acknowledgement, not a repair. The SKU keeps whatever gap it
 * has, excise keeps reporting it, and the Missing cost / Missing mL tabs keep
 * counting it - this only records that a person has read it.
 */
export async function markReviewed(formData: FormData) {
  const session = await requireSession();
  const scope = String(formData.get("scope") ?? "needs_review") as ReviewScope;
  const now = new Date();

  if (scope === "selected") {
    const ids = String(formData.get("ids") ?? "")
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) return { ok: true as const, count: 0 };
    const updated = await db
      .update(products)
      .set({ reviewedAt: now, reviewedBy: session.email })
      .where(inArray(products.id, ids))
      .returning({ id: products.id });
    revalidatePath("/products");
    return { ok: true as const, count: updated.length };
  }

  const where =
    scope === "all"
      ? isNull(products.reviewedAt)
      : and(eq(products.needsReview, true), isNull(products.reviewedAt));

  const updated = await db
    .update(products)
    .set({ reviewedAt: now, reviewedBy: session.email })
    .where(where)
    .returning({ id: products.id });

  revalidatePath("/products");
  return { ok: true as const, count: updated.length };
}

export async function clearReviewed() {
  await requireSession();
  const updated = await db
    .update(products)
    .set({ reviewedAt: null, reviewedBy: null })
    .where(dsql`${products.reviewedAt} is not null`)
    .returning({ id: products.id });
  revalidatePath("/products");
  return { ok: true as const, count: updated.length };
}

/** Mark selected SKUs as not nicotine merchandise - shipping, fees, gift cards. */
export async function markNonProduct(formData: FormData) {
  await requireSession();
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return;

  const rows = await db.select().from(products).where(inArray(products.id, ids));
  for (const p of rows) {
    const locked = new Set(p.lockedFields ?? []);
    locked.add("containsNicotine");
    await db
      .update(products)
      .set({
        containsNicotine: false,
        needsReview: false,
        lockedFields: [...locked],
        updatedAt: new Date(),
      })
      .where(eq(products.id, p.id));
  }
  revalidatePath("/products");
}
