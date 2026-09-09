import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { computeSales } from "../src/lib/engine/sales";
import { computeExcise } from "../src/lib/engine/excise";
import { buildWorkbook, workbookFilename } from "../src/lib/excel/workbook";
import type { TxRow } from "../src/lib/engine/types";

const ctx = {
  company: "Maximum Vapor Inc.",
  fein: "82-1098441",
  accountNumber: "STS-15666036-03",
  licenseNumber: null,
  loginField: null,
  accountNotes: null,
};

function row(p: Partial<TxRow>): TxRow {
  return {
    documentId: "INV1", lineNo: "1", ref1: null, itemCode: "SKU1",
    itemDescription: "30ML Bottle", docType: "Sales Invoice",
    documentDate: "2026-07-15", period: "2026-07", state: "OK",
    destCounty: "Oklahoma", destCity: "Edmond", destZip: "73013",
    jurisdictionType: "State", jurisdictionDescription: "OK",
    rate: 0.045, lineAmount: 500, discountAmount: 0, taxableAmount: 500,
    exemptAmount: 0, taxAmount: 22.5, quantity: 4, ...p,
  };
}

const out = process.argv[2] ?? "/tmp";

const sales = computeSales(
  [
    row({}),
    row({ jurisdictionType: "City", jurisdictionDescription: "Oklahoma City", rate: 0.04, taxAmount: 20 }),
    row({ documentId: "INV2", lineAmount: 250, taxableAmount: 200, exemptAmount: 50, taxAmount: 9 }),
  ],
  {
    config: {
      state: "OK", frequency: "MONTHLY", stateRate: 0.045, hasLocal: true,
      allocation: "city_county", rounding: "whole_dollar",
      portal: "https://oktap.tax.ok.gov", formName: "Sales Tax Return", dueDay: 20,
    },
    codes: [
      { jurisdictionName: "Oklahoma City", jurisdictionType: "city", officialCode: "5521", pairedCode: "5588", pairedName: "Oklahoma", rate: 0.04, rateIncludesState: false, avalaraAlias: "Edmond" },
      { jurisdictionName: "Oklahoma", jurisdictionType: "county", officialCode: "5588", pairedCode: null, pairedName: null, rate: 0, rateIncludesState: false, avalaraAlias: null },
    ],
    period: "2026-07",
  },
);

const excise = computeExcise({
  config: {
    state: "KS", structure: "C", basis: "RECEIPTS", rate: 0.05, rateUnit: "per_ml",
    openRate: null, openRateUnit: null, closedRate: null, closedRateUnit: null,
    frequency: "MONTHLY", portal: "https://www.ksrevenue.gov",
    formName: "EC-2", dueDay: 20, notes: "License CM000573. ACH Credit only.",
  },
  period: "2026-07",
  rows: [],
  purchases: [{ sku: "SKU1", description: "30ML", quantity: 10, mlTotal: 617, unitsTotal: 10, wholesaleCost: 300 }],
  products: [],
});

async function main() {
  for (const result of [sales, excise]) {
    const buf = await buildWorkbook(result, ctx);
    const path = `${out}/${workbookFilename(result)}`;
    writeFileSync(path, buf);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path);
    console.log(
      `${workbookFilename(result)}  ${(buf.length / 1024).toFixed(1)} KB  tabs: ${wb.worksheets.map((w) => w.name).join(", ")}`,
    );
  }
  console.log("\nOK sales:", { gross: sales.gross, exempt: sales.exempt, taxable: sales.taxable, taxComputed: sales.taxComputed, reconciles: sales.reconciles });
  console.log("KS excise:", { totalMl: excise.totalMl, taxComputed: excise.taxComputed });
}

main();
