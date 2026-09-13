"use client";

import { useMemo, useState, useTransition } from "react";
import { bulkSetSystemType, rebuildCatalog } from "@/app/actions/products";
import { ProductRow, type ProductView } from "./ProductRow";

type Filter = "all" | "review" | "cost" | "ml" | "system";

const FILTERS: { key: Filter; label: string; match: (p: ProductView) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "review", label: "Needs review", match: (p) => p.needsReview },
  { key: "cost", label: "Missing cost", match: (p) => p.containsNicotine && p.wholesaleCost === null },
  { key: "ml", label: "Missing mL", match: (p) => p.containsNicotine && p.liquidMl === null },
  { key: "system", label: "No open/closed", match: (p) => p.containsNicotine && p.systemType === null },
];

export function ProductTable({ products }: { products: ProductView[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        f.match(p) &&
        (!q || p.sku.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)),
    );
  }, [products, filter, query]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const rebuild = () =>
    start(async () => {
      const res = await rebuildCatalog();
      setMsg(
        res.ok
          ? `Rebuilt from the transactions: ${res.result.skusSeen} SKUs, ${res.result.withPrice} priced, ${res.result.needsReview} still need something.`
          : `Rebuild failed: ${res.error}`,
      );
    });

  const bulk = (systemType: "OPEN" | "CLOSED") =>
    start(async () => {
      const fd = new FormData();
      fd.set("ids", [...selected].join(","));
      fd.set("systemType", systemType);
      await bulkSetSystemType(fd);
      setSelected(new Set());
      setMsg(`Set ${systemType} on the selected SKUs.`);
    });

  return (
    <div className="space-y-3">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-sub mt-0.5">
              Built automatically from every sale line in the Avalara export — item code, name,
              quantity and amount. Prices are measured from what you actually charged.
            </p>
          </div>
          <div className="pagehead-actions">
            <input
              type="text"
              placeholder="Search SKU or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-[240px]"
            />
            <button className="btn" disabled={pending} onClick={rebuild}>
              {pending ? "Working…" : "Rebuild catalog"}
            </button>
          </div>
        </div>

        <nav className="tabs">
          {FILTERS.map((f) => {
            const count = products.filter(f.match).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="tab"
                data-active={filter === f.key}
              >
                {f.label}
                <span className="tab-count" data-tone={f.key !== "all" && count > 0 ? "warn" : undefined}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {selected.size > 0 && (
        <div className="callout callout-note flex items-center gap-3">
          <strong>{selected.size} selected</strong>
          <button className="btn btn-sm" disabled={pending} onClick={() => bulk("OPEN")}>
            Mark OPEN
          </button>
          <button className="btn btn-sm" disabled={pending} onClick={() => bulk("CLOSED")}>
            Mark CLOSED
          </button>
          <button className="btn btn-sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {msg && <div className="callout callout-ok">{msg}</div>}

      <div className="panel overflow-x-auto">
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
          <div className="p-6 text-center text-[13px] text-[var(--muted)]">
            {products.length === 0
              ? "No products yet. Upload an Avalara export — the catalog builds itself from the item codes and line amounts on every sale line."
              : "Nothing matches this filter."}
          </div>
        )}
      </div>
    </div>
  );
}
