import { SimpleUploader } from "../SimpleUploader";

export const dynamic = "force-dynamic";

export default function PurchaseUploadPage() {
  return (
    <div className="space-y-4">
      <SimpleUploader
        kind="purchases"
        title="Purchase import (receipts basis)"
        blurb="What you PURCHASED into inventory. Kansas EC-2 line 1a is mL purchased, not sold — it cannot be derived from sales data at all. This file also fills wholesale cost automatically, as a weighted average per SKU."
        columns="period, state, sku, description, quantity, ml_total, units_total, wholesale_cost"
      />
      <div className="help">
        <strong>Without this, Kansas EC-2 cannot be computed</strong> — it will report zero and say
        so rather than guess. Any state whose excise is a percentage of wholesale also depends on
        the cost this file carries.
      </div>
    </div>
  );
}
