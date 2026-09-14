"use client";

import { saveProduct } from "@/app/actions/products";

export type ProductView = {
  id: number;
  sku: string;
  description: string | null;
  unitsSold: number;
  revenue: number;
  retailPrice: number | null;
  observedUnitPrice: number | null;
  priceSource: string;
  wholesaleCost: number | null;
  costSource: string;
  liquidMl: number | null;
  mlSource: string;
  cartridgesPerUnit: number | null;
  systemType: string | null;
  systemTypeSource: string;
  containsNicotine: boolean;
  statesSold: string[];
  classificationNote: string | null;
  lockedFields: string[];
  needsReview: boolean;
  reviewedAt: string | null;
};

const money = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function Source({ source }: { source: string }) {
  const label: Record<string, string> = {
    observed: "from sales",
    purchases: "from purchases",
    medusa: "from Medusa",
    parsed: "from name",
    inferred: "from name",
    manual: "you set this",
    unknown: "missing",
  };
  const tone =
    source === "manual" || source === "medusa"
      ? "badge-filed"
      : source === "unknown"
        ? "badge-overdue"
        : "badge-ready";
  return <span className={`badge ${tone}`}>{label[source] ?? source}</span>;
}

export function ProductRow({
  p,
  selected,
  onToggle,
}: {
  p: ProductView;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <>
      <tr className={p.needsReview && !p.reviewedAt ? "flagged" : ""}>
        <td>
          <input type="checkbox" checked={selected} onChange={() => onToggle(p.id)} />
        </td>
        <td className="font-mono text-[11px] font-semibold">
          {p.sku}
          {p.reviewedAt && (
            <div className="mt-0.5">
              <span className="badge badge-filed">reviewed</span>
            </div>
          )}
        </td>
        <td className="max-w-[300px]">
          <div className="truncate">{p.description ?? "—"}</div>
          <div className="text-[10px] text-[var(--muted)]">
            {p.statesSold.slice(0, 8).join(" ")}
            {p.statesSold.length > 8 ? ` +${p.statesSold.length - 8}` : ""}
          </div>
        </td>
        <td className="num">{p.unitsSold.toLocaleString()}</td>
        <td className="num font-semibold">{money(p.revenue)}</td>
        <td className="num">
          {money(p.retailPrice)}
          <div className="mt-0.5"><Source source={p.priceSource} /></div>
        </td>
        <td className="num">
          {money(p.wholesaleCost)}
          <div className="mt-0.5"><Source source={p.costSource} /></div>
        </td>
        <td className="num">
          {p.liquidMl === null ? "—" : `${p.liquidMl} mL`}
          <div className="mt-0.5"><Source source={p.mlSource} /></div>
        </td>
        <td>
          {p.systemType ?? (p.containsNicotine ? "—" : "n/a")}
          <div className="mt-0.5"><Source source={p.systemTypeSource} /></div>
        </td>
        <td>
          <details>
            <summary className="btn btn-sm cursor-pointer list-none">Edit</summary>
            <form
              action={saveProduct}
              className="mt-3 w-[520px] space-y-3 rounded-lg border border-[var(--line)] bg-slate-50 p-3"
            >
              <input type="hidden" name="id" value={p.id} />
              <div>
                <label className="field">Description</label>
                <input name="description" type="text" defaultValue={p.description ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field">Wholesale cost per unit</label>
                  <input
                    name="wholesaleCost"
                    type="text"
                    defaultValue={p.wholesaleCost ?? ""}
                    placeholder="not in the sales export"
                  />
                </div>
                <div>
                  <label className="field">Retail price per unit</label>
                  <input
                    name="retailPrice"
                    type="text"
                    defaultValue={p.retailPrice ?? ""}
                    placeholder={p.observedUnitPrice ? String(p.observedUnitPrice) : ""}
                  />
                </div>
                <div>
                  <label className="field">Liquid mL per unit</label>
                  <input name="liquidMl" type="text" defaultValue={p.liquidMl ?? ""} />
                </div>
                <div>
                  <label className="field">Cartridges per unit</label>
                  <input
                    name="cartridgesPerUnit"
                    type="text"
                    defaultValue={p.cartridgesPerUnit ?? ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field">System type</label>
                  <select name="systemType" defaultValue={p.systemType ?? ""}>
                    <option value="">— not set —</option>
                    <option value="OPEN">OPEN (refillable liquid)</option>
                    <option value="CLOSED">CLOSED (pod / disposable)</option>
                  </select>
                </div>
                <label className="flex items-end gap-2 pb-2 text-[12px]">
                  <input type="checkbox" name="containsNicotine" defaultChecked={p.containsNicotine} />
                  Contains nicotine
                </label>
              </div>

              {p.classificationNote && (
                <p className="text-[11px] text-[var(--muted)]">
                  Read from the name: {p.classificationNote}
                </p>
              )}
              {p.observedUnitPrice !== null && (
                <p className="text-[11px] text-[var(--muted)]">
                  Measured selling price across {p.unitsSold.toLocaleString()} units:{" "}
                  <strong>{money(p.observedUnitPrice)}</strong>
                </p>
              )}
              <p className="text-[11px] text-[var(--muted)]">
                Anything you type here is kept forever and never overwritten by a future upload.
                Clear a box to hand that field back to the automatic build.
                {p.lockedFields.length > 0 && (
                  <> Currently yours: <strong>{p.lockedFields.join(", ")}</strong>.</>
                )}
              </p>
              <button className="btn btn-primary" type="submit">Save</button>
            </form>
          </details>
        </td>
      </tr>
    </>
  );
}
