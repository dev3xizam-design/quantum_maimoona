import { db } from "@/db";
import { sql as dsql } from "drizzle-orm";
import { listConnections } from "@/lib/medusa/sync";
import { StoresPanel } from "./StoresPanel";
import { oauthReadiness } from "@/lib/connectors/oauth";
import type { MatchRow } from "./MatchReview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stores" };

const rowsOf = (r: unknown) =>
  (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows) as Record<string, unknown>[];

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connect_error?: string; provider?: string }>;
}) {
  const sp = await searchParams;
  const connections = await listConnections();

  let nameMatches: MatchRow[] = [];
  let shipmentSummary: { source: string; label: string | null; rows: number; periods: number }[] = [];

  try {
    nameMatches = rowsOf(
      await db.execute(dsql`
        SELECT m.id, m.product_title, m.variant_title, m.sku, m.barcode,
               m.matched_sku, m.match_method, m.match_score, p.description
        FROM medusa_products m
        LEFT JOIN products p ON p.sku = m.matched_sku
        WHERE m.match_method = 'name'
        ORDER BY m.match_score ASC
        LIMIT 30`),
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

    shipmentSummary = rowsOf(
      await db.execute(dsql`
        SELECT source_system AS source, source_label AS label,
               count(*)::int rows, count(DISTINCT period)::int periods
        FROM shipments GROUP BY 1, 2 ORDER BY 3 DESC`),
    ).map((r) => ({
      source: String(r.source),
      label: (r.label as string) ?? null,
      rows: Number(r.rows),
      periods: Number(r.periods),
    }));
  } catch {
    /* not migrated yet */
  }

  return (
    <StoresPanel
      connections={connections}
      ready={oauthReadiness()}
      connectedId={sp.connected ? Number(sp.connected) : null}
      connectError={sp.connect_error ?? null}
      errorProvider={sp.connect_error ? (sp.provider ?? null) : null}
      nameMatches={nameMatches}
      shipmentSummary={shipmentSummary}
    />
  );
}
