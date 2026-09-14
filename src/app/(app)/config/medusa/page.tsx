import { db } from "@/db";
import { medusaProducts } from "@/db/schema";
import { sql as dsql } from "drizzle-orm";
import { getIntegrationView } from "@/lib/medusa/sync";
import { MedusaPanel } from "./MedusaPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Medusa" };

export default async function MedusaConfigPage() {
  const connection = await getIntegrationView();

  const rows = (r: unknown) =>
    Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows;

  let counts = { variants: 0, matched: 0, withCost: 0, withMl: 0 };
  let unmatchedSamples: { sku: string | null; barcode: string | null; title: string | null }[] = [];
  try {
    const c = rows(
      await db.execute(dsql`
        SELECT count(*)::int variants,
               count(*) FILTER (WHERE matched_sku IS NOT NULL)::int matched,
               count(*) FILTER (WHERE wholesale_cost IS NOT NULL)::int with_cost,
               count(*) FILTER (WHERE liquid_ml IS NOT NULL)::int with_ml
        FROM medusa_products`),
    )[0];
    counts = {
      variants: Number(c.variants),
      matched: Number(c.matched),
      withCost: Number(c.with_cost),
      withMl: Number(c.with_ml),
    };
    unmatchedSamples = (
      await db
        .select({
          sku: medusaProducts.sku,
          barcode: medusaProducts.barcode,
          title: medusaProducts.productTitle,
        })
        .from(medusaProducts)
        .where(dsql`${medusaProducts.matchedSku} IS NULL`)
        .limit(8)
    ).map((r) => r);
  } catch {
    /* table not migrated yet */
  }

  return (
    <MedusaPanel connection={connection} counts={counts} unmatchedSamples={unmatchedSamples} />
  );
}
