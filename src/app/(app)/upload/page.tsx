import { desc } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { AvalaraUploader } from "./AvalaraUploader";
import { SimpleUploader } from "./SimpleUploader";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const recent = await db.select().from(uploads).orderBy(desc(uploads.createdAt)).limit(15);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Upload</h1>
        <p className="text-[12px] text-[var(--muted)]">
          The Avalara export is the main event: it drives sales tax AND builds the product
          catalog automatically — item codes, product names, quantities and the real per-unit
          prices you actually charged. The three files below only add what a sales-tax export
          cannot contain.
        </p>
      </div>

      <AvalaraUploader />

      <div className="callout callout-note">
        <strong>Products maintain themselves.</strong> Every sale line in the export carries an item
        code, a product name, a quantity and a line amount, so the SKU list and the real selling
        prices rebuild on each upload — see <a className="text-[var(--accent)]" href="/products">Products</a>.
        You only ever fill in what the export genuinely does not contain: wholesale cost, and mL for
        pods whose names do not state a volume.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleUploader
          kind="products"
          title="Product master"
          blurb="Optional — the catalog already builds itself from the Avalara export. Use this to bulk-fill wholesale cost, mL and OPEN/CLOSED. Anything here is locked and survives future uploads."
          columns="sku, description, wholesale_cost, retail_price, liquid_ml, cartridges_per_unit, system_type (OPEN/CLOSED), contains_nicotine"
        />
        <SimpleUploader
          kind="purchases"
          title="Purchase import (receipts basis)"
          blurb="What you PURCHASED into inventory. Kansas EC-2 Line 1a is mL purchased, not sold - it cannot be derived from sales data."
          columns="period, state, sku, description, quantity, ml_total, units_total, wholesale_cost"
        />
        <SimpleUploader
          kind="shipments"
          title="PACT shipment feed"
          blurb="Per-shipment customer detail from the order/shipping system. Contains PII - handle accordingly."
          columns="period, state, customer_name, ship_to_address, ship_to_city, ship_to_state, ship_to_zip, invoice_date, invoice_number, product, brand, quantity, ml_total"
        />
      </div>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">
          Recent uploads
        </h2>
        <table className="grid">
          <thead>
            <tr>
              <th>File</th>
              <th>Kind</th>
              <th className="num">Rows</th>
              <th>Status</th>
              <th>By</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((u) => (
              <tr key={u.id}>
                <td className="max-w-[360px] truncate">{u.filename}</td>
                <td>{u.kind}</td>
                <td className="num">{u.rowCount.toLocaleString()}</td>
                <td>{u.status}</td>
                <td>{u.uploadedBy}</td>
                <td>{u.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[var(--muted)]">No uploads yet.</div>
        )}
      </section>
    </div>
  );
}
