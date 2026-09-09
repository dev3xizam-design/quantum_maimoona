import type { PactResult } from "@/lib/engine/types";
import type { FormCtx, PactFormSpec } from "./types";

const GENERIC: PactFormSpec = {
  id: "PACT_PA2_ENDS",
  title: "PACT Act - ENDS / Consumable Material Report",
  steps: (r: PactResult, ctx: FormCtx) => [
    `File on ${r.portal ?? "the state's tobacco portal"} - usually the same login as the vapor excise account (${ctx.licenseNumber ?? ctx.accountNumber ?? "license on file"}).`,
    `Report every shipment into ${r.state} for ${r.periodLabel}: ${r.shipmentCount} shipment line(s).`,
    "Fill the ENDS / consumable-material section only. Leave the cigarette PA-1 sections and any 'sticks' column BLANK - you do not sell cigarettes.",
    "Each line needs: customer name, ship-to address/city/state/ZIP, invoice date, invoice number, product/brand, quantity (and mL where asked).",
    "Where the state accepts a file upload (Nevada, Kansas), use the Shipment Detail tab - it is already in line-list form.",
    "Due by the 10th of the following month - earlier than sales tax's 20th.",
    "PACT applies from the FIRST interstate shipment - no economic-nexus threshold, and it applies in AK/DE/MT/NH/OR too.",
    r.source === "transactions"
      ? "WARNING: this list was built from the Avalara sales export, which lacks customer names and street addresses. Upload the shipment feed before filing."
      : "Customer detail came from the shipment feed - verify names and addresses are complete.",
  ],
};

export function pactFormFor(_state: string): PactFormSpec {
  return GENERIC;
}
