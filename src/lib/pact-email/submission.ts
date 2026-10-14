import "server-only";
import ExcelJS from "exceljs";
import type { PactResult } from "@/lib/engine/types";

export type SubmissionCtx = {
  company: string;
  fein: string;
  licenseNumber: string | null;
  accountNumber: string | null;
};

/**
 * The file a state receives: who is reporting, for which month, and every
 * delivery sale shipped into the state - nothing else. The internal workbook
 * (filing steps, reconciliation, notes) stays in Quantum.
 */
export async function buildPactSubmission(r: PactResult, ctx: SubmissionCtx): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.company;
  wb.created = new Date();
  const ws = wb.addWorksheet("PACT Report", { views: [{ state: "frozen", ySplit: 9 }] });
  ws.columns = [
    { width: 26 }, { width: 34 }, { width: 18 }, { width: 7 }, { width: 11 },
    { width: 13 }, { width: 16 }, { width: 44 }, { width: 10 }, { width: 10 },
  ];

  const head = (label: string, value: string | null) => {
    const row = ws.addRow([label, value ?? ""]);
    row.getCell(1).font = { bold: true };
  };
  const title = ws.addRow([`PACT Act Report - Delivery Sales into ${r.state} - ${r.periodLabel}`]);
  title.font = { bold: true, size: 14 };
  head("Seller", ctx.company);
  head("FEIN", ctx.fein);
  head("State license / account no.", ctx.licenseNumber ?? ctx.accountNumber);
  head("Reporting period", r.periodLabel);
  head("Shipments", String(r.shipmentCount));
  head("Prepared", new Date().toISOString().slice(0, 10));
  ws.addRow([]);

  const header = ws.addRow([
    "Customer name",
    "Ship-to address",
    "City",
    "State",
    "ZIP",
    "Invoice date",
    "Invoice number",
    "Product / brand",
    "Quantity",
    "mL",
  ]);
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
    c.alignment = { vertical: "middle" };
  });

  for (const row of r.rows) {
    const product =
      row.brand && row.product?.toUpperCase().startsWith(row.brand.toUpperCase())
        ? row.product
        : [row.brand, row.product].filter(Boolean).join(" - ");
    const added = ws.addRow([
      row.customerName ?? "",
      row.shipToAddress ?? "",
      row.shipToCity ?? "",
      row.shipToState ?? "",
      row.shipToZip ?? "",
      row.invoiceDate ?? "",
      row.invoiceNumber ?? "",
      product,
      row.quantity,
      row.ml || null,
    ]);
    added.getCell(5).numFmt = "@";
    added.getCell(9).numFmt = "#,##0";
    added.getCell(10).numFmt = "#,##0.##";
  }

  const total = ws.addRow(["Total", "", "", "", "", "", "", "", r.totalQuantity, r.totalMl || null]);
  total.font = { bold: true };
  total.getCell(9).numFmt = "#,##0";
  total.getCell(10).numFmt = "#,##0.##";
  ws.autoFilter = { from: { row: 9, column: 1 }, to: { row: 9, column: 10 } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
