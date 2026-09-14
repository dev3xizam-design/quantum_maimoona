/** Exposes the registration step on its own so it can be tested without HTTP. */
import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "../../src/db";
import { medusaProducts, products } from "../../src/db/schema";
import { classifyProduct } from "../../src/lib/products/classify";

export async function syncCatalogRegisterOnly(integrationId: number, storeName: string) {
  const variants = await db
    .select()
    .from(medusaProducts)
    .where(and(eq(medusaProducts.integrationId, integrationId), dsql`${medusaProducts.matchedSku} IS NULL`));

  const existing = new Set(
    (await db.select({ sku: products.sku }).from(products)).map((p) => p.sku.trim().toUpperCase()),
  );

  const values: (typeof products.$inferInsert)[] = [];
  const seen = new Set<string>();

  for (const v of variants) {
    const raw = v.barcode || v.upc || v.ean || v.sku;
    const sku = raw?.trim().toUpperCase();
    if (!sku || seen.has(sku) || existing.has(sku)) continue;
    seen.add(sku);

    const description = [v.productTitle, v.variantTitle].filter(Boolean).join(" - ") || sku;
    const c = classifyProduct(description, sku);
    const cost = v.wholesaleCost ? Number(v.wholesaleCost) : null;
    const ml = v.liquidMl ? Number(v.liquidMl) : c.liquidMl;
    const systemType = v.systemType ?? c.systemType;

    values.push({
      sku,
      description,
      source: "medusa",
      storeName,
      medusaVariantId: v.variantId,
      wholesaleCost: cost === null ? null : String(cost),
      liquidMl: ml === null ? null : String(ml),
      cartridgesPerUnit: c.cartridgesPerUnit === null ? null : String(c.cartridgesPerUnit),
      systemType,
      containsNicotine: c.containsNicotine,
      costSource: cost === null ? "unknown" : "medusa",
      mlSource: ml === null ? "unknown" : v.liquidMl ? "medusa" : "parsed",
      systemTypeSource: systemType === null ? "unknown" : v.systemType ? "medusa" : "inferred",
      classificationNote: `From ${storeName}`,
      needsReview: false,
      updatedAt: new Date(),
    });
  }

  for (let i = 0; i < values.length; i += 200) {
    await db
      .insert(products)
      .values(values.slice(i, i + 200))
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          description: dsql`excluded.description`,
          storeName: dsql`excluded.store_name`,
          medusaVariantId: dsql`excluded.medusa_variant_id`,
          updatedAt: dsql`excluded.updated_at`,
        },
      });
  }
  return values.length;
}
