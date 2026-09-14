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
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString().slice(0, 10) : null,
  }));

  const nicotine = view.filter((p) => p.containsNicotine);
  const sold = view.filter((p) => p.unitsSold !== 0);
  const neverSold = view.filter((p) => p.unitsSold === 0);
  const soldWithCost = sold.filter((p) => p.wholesaleCost !== null).length;
  /**
   * A master full of costed SKUs that have never been sold, next to sold SKUs
   * with no cost, means the two files key products differently - the cost data
   * exists but will never reach a return.
   */
  const skuMismatch =
    sold.length > 0 &&
    soldWithCost === 0 &&
    neverSold.filter((p) => p.wholesaleCost !== null).length > 20;
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

      {skuMismatch && (
        <div className="callout callout-warn">
          <strong>Your product master and the Avalara export do not use the same SKUs.</strong>{" "}
          {neverSold.filter((p) => p.wholesaleCost !== null).length.toLocaleString()} SKUs in the
          catalog have a wholesale cost but have never appeared on a sale, while all{" "}
          {sold.length.toLocaleString()} SKUs that did sell have no cost at all. The cost data is
          loaded, it just cannot be matched — so every percentage-of-wholesale excise return is
          still understated. Re-export the master keyed on the same item code Avalara reports (the
          sold SKUs look like barcodes), or add that code as the <code>sku</code> column.
        </div>
      )}

      <div className="help">
        <strong>Reviewed means read, not fixed.</strong> Marking a SKU reviewed records that you
        have looked at it. It does <em>not</em> fill in the missing wholesale cost or mL — the
        Missing cost and Missing mL tabs keep counting it, and the excise return keeps reporting
        that it is understated. Use it to clear the noise once you have decided a gap is acceptable.
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
