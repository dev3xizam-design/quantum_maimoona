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
          Sales data drives sales tax. Excise needs the product master, and receipts-basis states
          (Kansas EC-2) need the purchase import. PACT needs the shipment feed for customer detail.
        </p>
      </div>

      <AvalaraUploader />

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleUploader
          kind="products"
          title="Product master"
          blurb="SKU-level data the excise engine needs: mL per unit, wholesale cost, and the open/closed flag that bifurcated states require."
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
