import { db } from "@/db";
import { medusaProducts } from "@/db/schema";
import { sql as dsql } from "drizzle-orm";
import { getIntegrationView } from "@/lib/medusa/sync";
import { MedusaPanel } from "./MedusaPanel";
import type { MatchRow } from "./MatchReview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Medusa" };

const rowsOf = (r: unknown) =>
  (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows) as Record<string, unknown>[];

export default async function MedusaConfigPage() {
  const connection = await getIntegrationView();

  let counts = { variants: 0, matched: 0, byName: 0, ambiguous: 0, withCost: 0, withMl: 0 };
  let nameMatches: MatchRow[] = [];
  let unmatchedSamples: { sku: string | null; barcode: string | null; title: string | null }[] = [];

  try {
    const c = rowsOf(
      await db.execute(dsql`
        SELECT count(*)::int variants,
               count(*) FILTER (WHERE matched_sku IS NOT NULL)::int matched,
               count(*) FILTER (WHERE match_method = 'name')::int by_name,
               count(*) FILTER (WHERE match_method = 'ambiguous')::int ambiguous,
               count(*) FILTER (WHERE wholesale_cost IS NOT NULL)::int with_cost,
               count(*) FILTER (WHERE liquid_ml IS NOT NULL)::int with_ml
        FROM medusa_products`),
    )[0];
    counts = {
      variants: Number(c.variants),
      matched: Number(c.matched),
      byName: Number(c.by_name),
      ambiguous: Number(c.ambiguous),
      withCost: Number(c.with_cost),
      withMl: Number(c.with_ml),
    };

    // Name matches are judgement calls, so they are listed for review - worst
    // confidence first, because that is where a mistake will be.
    nameMatches = rowsOf(
      await db.execute(dsql`
        SELECT m.id, m.product_title, m.variant_title, m.sku, m.barcode,
               m.matched_sku, m.match_method, m.match_score, p.description
        FROM medusa_products m
        LEFT JOIN products p ON p.sku = m.matched_sku
        WHERE m.match_method = 'name'
        ORDER BY m.match_score ASC
        LIMIT 40`),
    ).map((r) => ({
      id: Number(r.id),
      productTitle: (r.product_title as string) ?? null,
      variantTitle: (r.variant_title as string) ?? null,
      sku: (r.sku as string) ?? null,
      barcode: (r.barcode as string) ?? null,
      matchedSku: (r.matched_sku as string) ?? null,
      matchedDescription: (r.description as string) ?? null,
      matchMethod: (r.match_method as string) ?? null,
      matchScore: r.match_score === null ? null : Number(r.match_score),
    }));

    unmatchedSamples = (
      await db
        .select({
          sku: medusaProducts.sku,
          barcode: medusaProducts.barcode,
          title: medusaProducts.productTitle,
        })
        .from(medusaProducts)
        .where(dsql`${medusaProducts.matchedSku} IS NULL AND ${medusaProducts.matchMethod} <> 'ambiguous'`)
        .limit(8)
    ).map((r) => r);
  } catch {
    /* table not migrated yet */
  }

  return (
    <MedusaPanel
      connection={connection}
      counts={counts}
      nameMatches={nameMatches}
      unmatchedSamples={unmatchedSamples}
    />
  );
}
