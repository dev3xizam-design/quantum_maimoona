import { desc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { fmtMoney, num } from "@/lib/money";
import { ProductTable } from "./ProductTable";
import type { ProductView } from "./ProductRow";

export const dynamic = "force-dynamic";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div
        className={`stat-value ${
          tone === "warn" ? "text-[var(--danger)]" : tone === "ok" ? "text-[var(--ok)]" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default async function ProductsPage() {
  const rows = await db.select().from(products).orderBy(desc(products.revenue)).limit(2000);

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
    classificationNote: p.classificationNote,
    lockedFields: p.lockedFields ?? [],
    needsReview: p.needsReview,
  }));

  const nicotine = view.filter((p) => p.containsNicotine);
  const totalRevenue = view.reduce((s, p) => s + p.revenue, 0);
  const missingCost = nicotine.filter((p) => p.wholesaleCost === null);
  const missingCostRevenue = missingCost.reduce((s, p) => s + p.revenue, 0);
  const priced = view.filter((p) => p.retailPrice !== null).length;

  return (
    <div className="space-y-4">
      <ProductTable products={view} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="SKUs in catalog"
          value={view.length.toLocaleString()}
          sub={`${fmtMoney(totalRevenue)} of sales`}
        />
        <Tile
          label="Priced automatically"
          value={`${priced} / ${view.length}`}
          tone={priced === view.length && view.length > 0 ? "ok" : undefined}
          sub="unit price measured from the line amounts"
        />
        <Tile
          label="Missing wholesale cost"
          value={String(missingCost.length)}
          tone={missingCost.length ? "warn" : "ok"}
          sub={
            missingCost.length
              ? `${fmtMoney(missingCostRevenue)} of sales affected`
              : "nothing outstanding"
          }
        />
        <Tile
          label="Needs review"
          value={String(view.filter((p) => p.needsReview).length)}
          tone={view.some((p) => p.needsReview) ? "warn" : "ok"}
          sub="listed first in the tabs above"
        />
      </div>

      <div className="help">
        <strong>What builds itself, and what does not.</strong> The SKU list, product names, units
        sold, revenue and the <em>real</em> per-unit selling price all come straight from the export
        and refresh on every upload. Volume in mL and open/closed are read out of the product name
        where it states them. Two things a sales-tax export simply does not contain:{" "}
        <strong>wholesale cost</strong> (upload the purchase import and it fills in, or type it once
        per SKU) and <strong>mL for pods and disposables</strong> whose names never state a volume.
        Those are left empty rather than estimated — a guessed cost would understate an excise
        return.
      </div>
    </div>
  );
}
