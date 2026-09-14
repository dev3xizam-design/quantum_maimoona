"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bulkSetSystemType,
  clearReviewed,
  markNonProduct,
  markReviewed,
  rebuildCatalog,
} from "@/app/actions/products";
import { fmtMoney } from "@/lib/money";
import { ProductRow, type ProductView } from "./ProductRow";

type Tab = "all" | "review" | "cost" | "ml" | "system" | "reviewed";

const TABS: { key: Tab; label: string; tone?: "warn" }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review", tone: "warn" },
  { key: "cost", label: "Missing cost", tone: "warn" },
  { key: "ml", label: "Missing mL", tone: "warn" },
  { key: "system", label: "No open/closed", tone: "warn" },
  { key: "reviewed", label: "Reviewed" },
];

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div
        className={`stat-value ${tone === "warn" ? "text-[var(--danger)]" : tone === "ok" ? "text-[var(--ok)]" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function ProductTable({
  rows,
  counts,
  tab,
  query,
  stores,
  store,
  page,
  pages,
  matching,
  summary,
}: {
  rows: ProductView[];
  counts: Record<Tab, number>;
  tab: Tab;
  query: string;
  stores: { name: string; count: number }[];
  store: string;
  page: number;
  pages: number;
  matching: number;
  summary: {
    sold: number;
    priced: number;
    revenue: number;
    missingCostRevenue: number;
    neverSoldWithCost: number;
    skuMismatch: boolean;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState(query);

  const link = (next: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, String(v));
    }
    return `?${p.toString()}`;
  };

  const go = (next: Record<string, string | number | undefined>) => router.push(link(next));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const run = (fn: () => Promise<string>) =>
    start(async () => {
      setMsg(await fn());
      setSelected(new Set());
      router.refresh();
    });

  const selectedIds = () => [...selected].join(",");

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-sub mt-0.5">
              Every SKU you sell — built from the Avalara export and from every connected store.
              Search by name or SKU; prices are measured from what you actually charged.
            </p>
          </div>
          <div className="pagehead-actions">
            {stores.length > 0 && (
              <select
                value={store}
                onChange={(e) => go({ store: e.target.value || undefined, page: undefined })}
                className="w-[190px]"
              >
                <option value="">All sources</option>
                <option value="avalara">From sales only</option>
                {stores.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.count.toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go({ q: search, page: undefined });
              }}
            >
              <input
                type="text"
                placeholder="Search SKU or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-[230px]"
              />
            </form>
            {counts.review > 0 && (
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const fd = new FormData();
                    fd.set("scope", "needs_review");
                    const r = await markReviewed(fd);
                    return `Marked ${r.count.toLocaleString()} SKU(s) reviewed. The missing data is still reported to excise — this only records that you have read them.`;
                  })
                }
              >
                Mark all {counts.review.toLocaleString()} as reviewed
              </button>
            )}
            {counts.reviewed > 0 && (
              <button
                className="btn btn-sm btn-ghost"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const r = await clearReviewed();
                    return `Cleared the reviewed mark on ${r.count.toLocaleString()} SKU(s).`;
                  })
                }
              >
                Undo reviewed
              </button>
            )}
            <button
              className="btn"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await rebuildCatalog();
                  return r.ok
                    ? `Rebuilt: ${r.result.skusSeen} SKUs from transactions, ${r.result.withPrice} priced, ${r.result.needsReview} still need something.`
                    : `Rebuild failed: ${r.error}`;
                })
              }
            >
              {pending ? "Working…" : "Rebuild catalog"}
            </button>
          </div>
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={link({ tab: t.key === "all" ? undefined : t.key, page: undefined })}
              className="tab"
              data-active={tab === t.key}
            >
              {t.label}
              <span className="tab-count" data-tone={t.tone && counts[t.key] > 0 ? "warn" : undefined}>
                {counts[t.key].toLocaleString()}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {msg && <div className="callout callout-ok">{msg}</div>}

      {summary.skuMismatch && (
        <div className="callout callout-warn">
          <strong>Your product master and the Avalara export do not use the same SKUs.</strong>{" "}
          {summary.neverSoldWithCost.toLocaleString()} SKUs have a wholesale cost but have never
          appeared on a sale, while none of the {summary.sold.toLocaleString()} that did sell have a
          cost. Connect the store those products live in under{" "}
          <Link className="font-semibold text-[var(--accent)]" href="/config/stores">
            Config → Stores
          </Link>{" "}
          so they can be matched on barcode.
        </div>
      )}

      {selected.size > 0 && (
        <div className="callout callout-note flex flex-wrap items-center gap-3">
          <strong>{selected.size} selected</strong>
          {(["OPEN", "CLOSED"] as const).map((type) => (
            <button
              key={type}
              className="btn btn-sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const fd = new FormData();
                  fd.set("ids", selectedIds());
                  fd.set("systemType", type);
                  await bulkSetSystemType(fd);
                  return `Set ${type} on the selected SKUs.`;
                })
              }
            >
              Mark {type}
            </button>
          ))}
          <button
            className="btn btn-sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const fd = new FormData();
                fd.set("scope", "selected");
                fd.set("ids", selectedIds());
                const r = await markReviewed(fd);
                return `Marked ${r.count} selected SKU(s) reviewed.`;
              })
            }
          >
            Mark reviewed
          </button>
          <button
            className="btn btn-sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const fd = new FormData();
                fd.set("ids", selectedIds());
                await markNonProduct(fd);
                return "Marked as not nicotine merchandise.";
              })
            }
          >
            Not merchandise
          </button>
          <button className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="SKUs in catalog"
          value={counts.all.toLocaleString()}
          sub={`${summary.sold.toLocaleString()} have sold · ${fmtMoney(summary.revenue)}`}
        />
        <Stat
          label="Priced automatically"
          value={summary.priced.toLocaleString()}
          sub="unit price measured from the line amounts"
        />
        <Stat
          label="Missing wholesale cost"
          value={counts.cost.toLocaleString()}
          tone={counts.cost ? "warn" : "ok"}
          sub={counts.cost ? `${fmtMoney(summary.missingCostRevenue)} of sales affected` : "nothing outstanding"}
        />
        <Stat
          label="Needs review"
          value={counts.review.toLocaleString()}
          tone={counts.review ? "warn" : "ok"}
          sub="acknowledged items drop out"
        />
      </div>

      <div className="panel overflow-x-auto">
        <div className="panel-head">
          {matching.toLocaleString()} matching
          <span className="ml-auto flex items-center gap-2 text-[12px] font-normal text-[var(--muted)]">
            Page {page} of {pages}
            <Link
              href={link({ page: Math.max(1, page - 1) })}
              className={`btn btn-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            >
              Prev
            </Link>
            <Link
              href={link({ page: Math.min(pages, page + 1) })}
              className={`btn btn-sm ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
            >
              Next
            </Link>
          </span>
        </div>
        <table className="qtable">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>SKU</th>
              <th>Product</th>
              <th className="num">Units</th>
              <th className="num">Revenue</th>
              <th className="num">Unit price</th>
              <th className="num">Wholesale cost</th>
              <th className="num">Volume</th>
              <th>Open / closed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <ProductRow key={p.id} p={p} selected={selected.has(p.id)} onToggle={toggle} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty">
            {counts.all === 0
              ? "No products yet. Upload an Avalara export — the catalog builds itself from the item codes and line amounts on every sale line."
              : "Nothing matches this filter."}
          </div>
        )}
      </div>

      <div className="help">
        <strong>Reviewed means read, not fixed.</strong> Marking a SKU reviewed records that you
        have looked at it. It does not fill in the missing cost or mL — those tabs keep counting it,
        and the excise return keeps reporting that it is understated.
      </div>
    </div>
  );
}
