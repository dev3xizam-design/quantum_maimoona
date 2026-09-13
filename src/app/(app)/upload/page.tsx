import Link from "next/link";
import { AvalaraUploader } from "./AvalaraUploader";

export const dynamic = "force-dynamic";

export default function AvalaraUploadPage() {
  return (
    <div className="space-y-4">
      <AvalaraUploader />
      <div className="help">
        <strong>Products maintain themselves.</strong> Every sale line carries an item code, a
        product name, a quantity and a line amount, so the SKU list and the real selling prices
        rebuild on each upload — see{" "}
        <Link className="text-[var(--accent)] font-semibold" href="/products">
          Products
        </Link>
        . You only ever fill in what the export genuinely does not contain: wholesale cost, and mL
        for pods whose names do not state a volume.
      </div>
    </div>
  );
}
