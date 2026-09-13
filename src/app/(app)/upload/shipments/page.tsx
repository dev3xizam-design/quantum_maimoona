import { SimpleUploader } from "../SimpleUploader";

export const dynamic = "force-dynamic";

export default function ShipmentUploadPage() {
  return (
    <div className="space-y-4">
      <SimpleUploader
        kind="shipments"
        title="PACT shipment feed"
        blurb="Per-shipment customer detail from the order or shipping system. The Avalara sales export has no customer names or street addresses, and PACT requires both."
        columns="period, state, customer_name, ship_to_address, ship_to_city, ship_to_state, ship_to_zip, invoice_date, invoice_number, product, brand, quantity, ml_total"
      />
      <div className="callout callout-warn">
        <strong>This file contains customer PII.</strong> It is written to the PACT worksheet only —
        never rendered in the dashboard and never logged. Handle the file itself accordingly.
      </div>
    </div>
  );
}
