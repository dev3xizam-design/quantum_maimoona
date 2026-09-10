import { desc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { fmtMoney, num } from "@/lib/money";
import { ProductTable } from "./ProductTable";
import type { ProductView } from "./ProductRow";

export const dynamic = "force-dynamic";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div
        className={`mt-1 text-[22px] font-semibold tnum ${
          tone === "warn" ? "text-[var(--danger)]" : tone === "ok" ? "text-[var(--ok)]" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</div>}
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
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Products</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Built automatically from every sale line in the Avalara export — item code, product name,
          quantity and amount. Prices are measured from what you actually charged, not typed in.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="SKUs in catalog" value={view.length.toLocaleString()} sub={`${fmtMoney(totalRevenue)} of sales`} />
        <Tile label="Priced automatically" value={`${priced} / ${view.length}`} tone={priced === view.length ? "ok" : undefined} sub="unit price from the line amounts" />
        <Tile
          label="Missing wholesale cost"
          value={String(missingCost.length)}
          tone={missingCost.length ? "warn" : "ok"}
          sub={missingCost.length ? `${fmtMoney(missingCostRevenue)} of sales affected` : "nothing outstanding"}
        />
        <Tile
          label="Needs review"
          value={String(view.filter((p) => p.needsReview).length)}
          tone={view.some((p) => p.needsReview) ? "warn" : "ok"}
          sub="sorted by revenue below"
        />
      </div>

      <div className="callout callout-note">
        <strong>What builds itself, and what does not.</strong> The SKU list, product names, units
        sold, revenue and the <em>real</em> per-unit selling price all come straight from the export
        and refresh on every upload. Volume in mL and open/closed are read out of the product name
        where it says so. Two things a sales-tax export simply does not contain:{" "}
        <strong>wholesale cost</strong> (upload the purchase import and it fills in, or type it once
        per SKU) and <strong>mL for pods and disposables</strong> whose names never state a volume.
        Those are left empty rather than estimated — a guessed cost would understate an excise
        return. Work the list top-down: it is ordered by revenue, so the SKUs that move the tax come
        first.
      </div>

      <ProductTable products={view} />
    </div>
  );
}
