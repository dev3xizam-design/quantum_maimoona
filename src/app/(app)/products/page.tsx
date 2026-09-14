import { and, asc, desc, eq, isNotNull, isNull, or, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { num } from "@/lib/money";
import { ProductTable } from "./ProductTable";
import type { ProductView } from "./ProductRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

const PAGE_SIZE = 100;

export type ProductTab = "all" | "review" | "cost" | "ml" | "system" | "reviewed";

/**
 * Counts come from SQL over the WHOLE table, and rows are paged. The earlier
 * version loaded a slice and counted the slice, so every tab under-reported
 * once the catalog passed the slice size - "Needs review 0" when it was 1,198.
 */
const WHERE = {
  all: undefined,
  review: and(eq(products.needsReview, true), isNull(products.reviewedAt)),
  cost: and(eq(products.containsNicotine, true), isNull(products.wholesaleCost)),
  ml: and(eq(products.containsNicotine, true), isNull(products.liquidMl)),
  system: and(eq(products.containsNicotine, true), isNull(products.systemType)),
  reviewed: isNotNull(products.reviewedAt),
} as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string; store?: string }>;
}) {
  const sp = await searchParams;
  const store = (sp.store ?? "").trim();
  const tab = (["all", "review", "cost", "ml", "system", "reviewed"].includes(sp.tab ?? "")
    ? sp.tab
    : "all") as ProductTab;
  const query = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [countsRow] = await db
    .select({
      all: dsql<number>`count(*)::int`,
      review: dsql<number>`count(*) FILTER (WHERE ${products.needsReview} AND ${products.reviewedAt} IS NULL)::int`,
      cost: dsql<number>`count(*) FILTER (WHERE ${products.containsNicotine} AND ${products.wholesaleCost} IS NULL)::int`,
      ml: dsql<number>`count(*) FILTER (WHERE ${products.containsNicotine} AND ${products.liquidMl} IS NULL)::int`,
      system: dsql<number>`count(*) FILTER (WHERE ${products.containsNicotine} AND ${products.systemType} IS NULL)::int`,
      reviewed: dsql<number>`count(*) FILTER (WHERE ${products.reviewedAt} IS NOT NULL)::int`,
      sold: dsql<number>`count(*) FILTER (WHERE ${products.unitsSold} <> 0)::int`,
      priced: dsql<number>`count(*) FILTER (WHERE ${products.retailPrice} IS NOT NULL)::int`,
      revenue: dsql<number>`coalesce(sum(${products.revenue}), 0)::float8`,
      missingCostRevenue: dsql<number>`coalesce(sum(${products.revenue}) FILTER (WHERE ${products.containsNicotine} AND ${products.wholesaleCost} IS NULL), 0)::float8`,
      neverSoldWithCost: dsql<number>`count(*) FILTER (WHERE ${products.unitsSold} = 0 AND ${products.wholesaleCost} IS NOT NULL)::int`,
      soldWithCost: dsql<number>`count(*) FILTER (WHERE ${products.unitsSold} <> 0 AND ${products.wholesaleCost} IS NOT NULL)::int`,
    })
    .from(products);

  const search = query
    ? or(
        dsql`${products.sku} ILIKE ${"%" + query + "%"}`,
        dsql`${products.description} ILIKE ${"%" + query + "%"}`,
      )
    : undefined;
  const storeFilter = store
    ? store === "avalara"
      ? eq(products.source, "avalara")
      : eq(products.storeName, store)
    : undefined;
  const where = [WHERE[tab], search, storeFilter].filter(Boolean);
  const filter = where.length ? and(...where) : undefined;

  const [matching] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(products)
    .where(filter);
  const total = Number(matching.n);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);

  const rows = await db
    .select()
    .from(products)
    .where(filter)
    .orderBy(desc(products.revenue), asc(products.sku))
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);

  const view: ProductView[] = rows.map((p) => ({
    id: p.id,
    sku: p.sku,
    description: p.description,
    unitsSold: num(p.unitsSold),
    revenue: num(p.revenue),
    retailPrice: p.retailPrice === null ? null : num(p.retailPrice),
    observedUnitPrice: p.observedUnitPrice === null ? null : num(p.observedUnitPrice),
    priceSource: p.priceSource ?? "unknown",
    wholesaleCost: p.wholesaleCost === null ? null : num(p.wholesaleCost),
    costSource: p.costSource ?? "unknown",
    liquidMl: p.liquidMl === null ? null : num(p.liquidMl),
    mlSource: p.mlSource ?? "unknown",
    cartridgesPerUnit: p.cartridgesPerUnit === null ? null : num(p.cartridgesPerUnit),
    systemType: p.systemType,
    systemTypeSource: p.systemTypeSource ?? "unknown",
    containsNicotine: p.containsNicotine,
    statesSold: p.statesSold ?? [],
    source: p.source,
    storeName: p.storeName,
    classificationNote: p.classificationNote,
    lockedFields: p.lockedFields ?? [],
    needsReview: p.needsReview,
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString().slice(0, 10) : null,
  }));

  const storeRows = await db
    .select({ name: products.storeName, n: dsql<number>`count(*)::int` })
    .from(products)
    .where(dsql`${products.storeName} IS NOT NULL`)
    .groupBy(products.storeName)
    .orderBy(desc(dsql`count(*)`));
  const stores = storeRows.map((r) => ({ name: r.name as string, count: Number(r.n) }));

  const counts = {
    all: Number(countsRow.all),
    review: Number(countsRow.review),
    cost: Number(countsRow.cost),
    ml: Number(countsRow.ml),
    system: Number(countsRow.system),
    reviewed: Number(countsRow.reviewed),
  };

  const skuMismatch =
    Number(countsRow.sold) > 0 &&
    Number(countsRow.soldWithCost) === 0 &&
    Number(countsRow.neverSoldWithCost) > 20;

  return (
    <ProductTable
      rows={view}
      counts={counts}
      tab={tab}
      query={query}
      stores={stores}
      store={store}
      page={current}
      pages={pages}
      matching={total}
      summary={{
        sold: Number(countsRow.sold),
        priced: Number(countsRow.priced),
        revenue: Number(countsRow.revenue),
        missingCostRevenue: Number(countsRow.missingCostRevenue),
        neverSoldWithCost: Number(countsRow.neverSoldWithCost),
        skuMismatch,
      }}
    />
  );
}
