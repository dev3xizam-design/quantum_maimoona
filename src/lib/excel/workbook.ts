/**
 * Worksheet generator (doc 05).
 *
 * One .xlsx per state per tax type per period, with the same five tabs every
 * time: Filing Sheet, Return, Jurisdiction Detail, Reconciliation, Notes.
 * The Return tab mirrors the portal form so the numbers are transcribed, never
 * recalculated.
 *
 * A workbook is NEVER emitted when the reconciliation invariant fails - the
 * caller checks `result.reconciles` first.
 */

import ExcelJS from "exceljs";
import { round2, fmtPct } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import { rateUnitLabel } from "@/lib/engine/excise";
import { allocationLabel, allocationLines } from "@/lib/engine/sales";
import type { AnyResult, ExciseResult, PactResult, SalesResult } from "@/lib/engine/types";
import { salesFormFor } from "./forms/sales";
import { exciseFormFor } from "./forms/excise";
import { pactFormFor } from "./forms/pact";
import type { FormCtx, ReturnLine } from "./forms/types";
import {
  MONEY_FMT,
  MONEY0_FMT,
  PCT_FMT,
  QTY_FMT,
  HILITE,
  OK_GREEN,
  WARN,
  autoWidth,
  fill,
  headerRow,
  kv,
  noteRow,
  sectionRow,
  spacer,
  titleRow,
} from "./style";

const numFmt = (f: string | undefined) =>
  f === "money0" ? MONEY0_FMT : f === "pct" ? PCT_FMT : f === "qty" ? QTY_FMT : MONEY_FMT;

function headerBlock(ws: ExcelJS.Worksheet, title: string, r: AnyResult, ctx: FormCtx) {
  titleRow(ws, title);
  kv(ws, "Entity", `${ctx.company}   FEIN ${ctx.fein}`);
  kv(ws, "State / Tax type", `${r.state} - ${r.taxType.toUpperCase()}`);
  kv(ws, "Period", `${r.periodLabel} (${r.period})`);
  kv(ws, "Due date", r.dueDate);
  kv(ws, "Form", r.form ?? "-");
  kv(ws, "Portal", r.portal ?? "-");
  kv(ws, "Account / License", [ctx.accountNumber, ctx.licenseNumber].filter(Boolean).join("  /  ") || "(add in Config > Accounts)");
  kv(ws, "Generated", new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC");
  spacer(ws);
}

function writeReturnLines(ws: ExcelJS.Worksheet, lines: ReturnLine[]) {
  headerRow(ws, ["Line", "Description", "Value", "Note"]);
  for (const l of lines) {
    if (l.kind === "blank") {
      spacer(ws);
      continue;
    }
    if (l.kind === "section") {
      sectionRow(ws, l.label, 4);
      continue;
    }
    const row = ws.addRow([l.line ?? "", l.label, l.value ?? "", l.note ?? ""]);
    const valueCell = row.getCell(3);
    if (typeof l.value === "number") {
      valueCell.numFmt = numFmt(l.format);
      valueCell.alignment = { horizontal: "right" };
    }
    if (l.highlight) {
      fill(valueCell, `FF${HILITE}`);
      valueCell.font = { bold: true };
      row.getCell(2).font = { bold: true };
    }
    row.getCell(4).font = { size: 9, color: { argb: "FF6B7280" } };
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
  }
}

/* ------------------------------------------------------------------ */

function filingSheet(wb: ExcelJS.Workbook, r: AnyResult, ctx: FormCtx, steps: string[]) {
  const ws = wb.addWorksheet("Filing Sheet", { views: [{ showGridLines: false }] });
  autoWidth(ws, [6, 100, 20, 20, 20, 20]);
  headerBlock(ws, `HOW TO FILE - ${r.state} ${r.taxType.toUpperCase()} - ${r.periodLabel}`, r, ctx);

  if (r.taxType === "sales") {
    sectionRow(ws, "The numbers", 6);
    const nums: [string, number][] = [
      ["Gross sales", r.gross],
      ["Exempt sales", r.exempt],
      ["Taxable sales", r.taxable],
      ["TAX DUE", r.taxComputed],
      ["Tax collected (Avalara)", r.taxCollected],
      ["Difference (computed - collected)", r.delta],
    ];
    for (const [label, value] of nums) {
      const row = ws.addRow(["", label, value]);
      row.getCell(3).numFmt = r.rounding === "whole_dollar" ? MONEY0_FMT : MONEY_FMT;
      if (label === "TAX DUE") {
        row.getCell(2).font = { bold: true, size: 12 };
        row.getCell(3).font = { bold: true, size: 12 };
        fill(row.getCell(3), `FF${HILITE}`);
      }
      if (label.startsWith("Difference") && r.delta >= 0.01) fill(row.getCell(3), `FF${WARN}`);
    }
    spacer(ws);
  } else if (r.taxType === "excise") {
    sectionRow(ws, "The numbers", 6);
    const row = ws.addRow(["", "EXCISE TAX DUE", r.taxComputed]);
    row.getCell(3).numFmt = MONEY_FMT;
    row.getCell(2).font = { bold: true, size: 12 };
    row.getCell(3).font = { bold: true, size: 12 };
    fill(row.getCell(3), `FF${HILITE}`);
    spacer(ws);
  } else {
    sectionRow(ws, "The numbers", 6);
    ws.addRow(["", "Shipment lines to report", r.shipmentCount]);
    ws.addRow(["", "Total quantity", r.totalQuantity]);
    spacer(ws);
  }

  sectionRow(ws, "Step by step", 6);
  steps.forEach((s, i) => {
    const row = ws.addRow([String(i + 1), s]);
    row.getCell(1).font = { bold: true, color: { argb: "FF0F766E" } };
    row.getCell(1).alignment = { vertical: "top" };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(16, Math.ceil(s.length / 95) * 15);
  });

  spacer(ws);
  if (r.warnings.length) {
    sectionRow(ws, "Before you file - resolve these", 6);
    for (const w of r.warnings) noteRow(ws, w, "warn", 6);
    spacer(ws);
  }

  noteRow(
    ws,
    "This worksheet PREPARES the return. A human files it. Portal logins live on the Portals page, encrypted; never store card numbers, CVVs or bank credentials anywhere in this system.",
    "note",
    6,
  );
  return ws;
}

function returnSheet(wb: ExcelJS.Workbook, r: AnyResult, ctx: FormCtx, title: string, lines: ReturnLine[]) {
  const ws = wb.addWorksheet("Return", { views: [{ showGridLines: false }] });
  autoWidth(ws, [10, 52, 18, 60]);
  headerBlock(ws, title, r, ctx);
  writeReturnLines(ws, lines);
  return ws;
}

function jurisdictionSheet(wb: ExcelJS.Workbook, r: SalesResult) {
  const ws = wb.addWorksheet("Jurisdiction Detail", { views: [{ showGridLines: false }] });
  autoWidth(ws, [10, 28, 14, 16, 16, 16, 14, 16, 16]);
  titleRow(ws, `${r.state} - jurisdiction allocation - ${r.periodLabel}`, 9);
  spacer(ws);

  if (r.state === "TX") {
    // Texas files by taxing authority, not destination county - see allocationLines.
    sectionRow(ws, allocationLabel(r), 9);
    headerRow(ws, ["Type", "Jurisdiction", "Code", "", "", "", "Taxable", "Rate", "Tax"]);
    for (const l of allocationLines(r)) {
      const row = ws.addRow([l.type, l.name, l.code ?? "MISSING", "", "", "", l.taxable, l.rate, l.tax]);
      [7, 9].forEach((i) => (row.getCell(i).numFmt = MONEY_FMT));
      row.getCell(8).numFmt = PCT_FMT;
      if (!l.code) fill(row.getCell(3), `FF${WARN}`);
    }
    spacer(ws);
    noteRow(ws, "Destination counties with no county sales tax (Travis, Harris, Dallas...) have no Comptroller code and no line on the return.", "note", 9);
    spacer(ws);
  }

  sectionRow(ws, r.state === "TX" ? "By destination county (reference only - not return lines)" : "By destination county (from deduped sale lines)", 9);
  headerRow(ws, ["Type", "Jurisdiction", "Code", "Paired code", "Gross", "Exempt", "Taxable", "Rate", "Tax"]);
  for (const l of r.byCounty) {
    if (l.gross === 0 && l.taxable === 0 && l.tax === 0) continue;
    const row = ws.addRow([
      l.type,
      l.name,
      l.code ?? (r.state === "TX" ? "" : "MISSING"),
      l.pairedCode ?? "",
      l.gross,
      l.exempt,
      l.taxable,
      l.rate,
      l.tax,
    ]);
    [5, 6, 7, 9].forEach((i) => (row.getCell(i).numFmt = MONEY_FMT));
    row.getCell(8).numFmt = PCT_FMT;
    if (!l.code && r.state !== "TX") fill(row.getCell(3), `FF${WARN}`);
  }
  spacer(ws);

  if (r.byCity.length) {
    sectionRow(ws, "By destination city", 9);
    headerRow(ws, ["Type", "City", "Code", "Paired county code", "Gross", "Exempt", "Taxable", "Rate", "Tax"]);
    for (const l of r.byCity) {
      if (l.taxable === 0 && l.tax === 0) continue;
      const row = ws.addRow([
        l.type,
        l.name,
        l.code ?? (r.state === "TX" ? "" : "MISSING"),
        l.pairedCode ?? "",
        l.gross,
        l.exempt,
        l.taxable,
        l.rate,
        l.tax,
      ]);
      [5, 6, 7, 9].forEach((i) => (row.getCell(i).numFmt = MONEY_FMT));
      row.getCell(8).numFmt = PCT_FMT;
      if (!l.code) fill(row.getCell(3), `FF${WARN}`);
    }
    spacer(ws);
  }

  // Paired city + county COPO rows are Oklahoma's format; Texas codes are never paired.
  if (r.allocation === "city_county" && r.state === "OK") {
    sectionRow(ws, "Portal import format (code, net taxable) - paired city AND county rows", 9);
    headerRow(ws, ["Code", "Net taxable"]);
    for (const l of r.byCity) {
      if (!l.code || l.taxable === 0) continue;
      const row = ws.addRow([l.code, l.taxable]);
      row.getCell(2).numFmt = MONEY_FMT;
      if (l.pairedCode) {
        const pair = ws.addRow([l.pairedCode, l.taxable]);
        pair.getCell(2).numFmt = MONEY_FMT;
        pair.getCell(1).font = { italic: true };
      }
    }
    spacer(ws);
    noteRow(ws, "Each city row must be paired with its county row. OKC spans four counties - 5521 (Oklahoma County) is correct, 0921 (Canadian) is not.", "note", 9);
    spacer(ws);
  }

  sectionRow(ws, "Every Avalara jurisdiction row (tax is summed across ALL of these, never deduped)", 9);
  headerRow(ws, ["Type", "Jurisdiction", "Code", "", "Gross", "Exempt", "Taxable", "Rate", "Tax"]);
  for (const l of r.byJurisdiction) {
    const row = ws.addRow([l.type, l.name, l.code ?? "", "", "", l.exempt, l.taxable, l.rate, l.tax]);
    [6, 7, 9].forEach((i) => (row.getCell(i).numFmt = MONEY_FMT));
    row.getCell(8).numFmt = PCT_FMT;
  }
  return ws;
}

function exciseDetailSheet(wb: ExcelJS.Workbook, r: ExciseResult) {
  const ws = wb.addWorksheet("Basis Detail", { views: [{ showGridLines: false }] });
  autoWidth(ws, [28, 22, 18, 18, 18, 18]);
  titleRow(ws, `${r.state} excise basis - structure ${r.structure} - ${r.basis} basis`, 6);
  spacer(ws);

  headerRow(ws, ["Component", "Basis", "Basis amount", "Rate", "Rate type", "Tax"]);
  for (const c of r.components) {
    const row = ws.addRow([c.label, c.basisLabel, c.basisAmount, c.rate, rateUnitLabel(c.rateUnit), c.tax]);
    row.getCell(3).numFmt = c.rateUnit.startsWith("pct") ? MONEY_FMT : QTY_FMT;
    row.getCell(4).numFmt = c.rateUnit.startsWith("pct") ? PCT_FMT : MONEY_FMT;
    row.getCell(6).numFmt = MONEY_FMT;
  }
  const total = ws.addRow(["TOTAL", "", "", "", "", r.taxComputed]);
  total.font = { bold: true };
  total.getCell(6).numFmt = MONEY_FMT;
  fill(total.getCell(6), `FF${HILITE}`);
  spacer(ws);

  sectionRow(ws, "Quantity basis", 6);
  ws.addRow(["Total mL", r.totalMl]).getCell(2).numFmt = QTY_FMT;
  ws.addRow(["Total units", r.totalUnits]).getCell(2).numFmt = QTY_FMT;
  ws.addRow(["Total cartridges", r.totalCartridges]).getCell(2).numFmt = QTY_FMT;
  ws.addRow(["Total wholesale cost", r.wholesaleCost]).getCell(2).numFmt = MONEY_FMT;
  ws.addRow(["Total retail price", r.retailPrice]).getCell(2).numFmt = MONEY_FMT;
  spacer(ws);

  sectionRow(ws, "Product master coverage", 6);
  ws.addRow(["Lines matched to a SKU", `${r.skuCoverage.matched} of ${r.skuCoverage.total}`]);
  if (r.skuCoverage.missing.length) {
    ws.addRow(["Missing SKUs", r.skuCoverage.missing.join(", ")]).getCell(2).alignment = { wrapText: true };
  }

  const gapRows = [
    ...r.dataGaps.cost.map((g) => ({ ...g, missing: "wholesale cost" })),
    ...r.dataGaps.ml.map((g) => ({ ...g, missing: "mL per unit" })),
    ...r.dataGaps.systemType.map((g) => ({ ...g, missing: "open/closed" })),
  ].sort((a, b) => b.retail - a.retail);

  if (gapRows.length) {
    spacer(ws);
    sectionRow(ws, "SKUs missing data this return needs (ranked by revenue)", 6);
    headerRow(ws, ["SKU", "Product", "Missing", "Units", "Retail this period", ""]);
    for (const g of gapRows.slice(0, 100)) {
      const row = ws.addRow([g.sku, g.description ?? "", g.missing, g.units, g.retail, ""]);
      row.getCell(4).numFmt = QTY_FMT;
      row.getCell(5).numFmt = MONEY_FMT;
      fill(row.getCell(3), `FF${WARN}`);
    }
    spacer(ws);
    noteRow(
      ws,
      "Each row above contributes ZERO to the tax computed on the Return tab, so the figure is understated until they are filled in on the Products page (or the purchase import is uploaded for cost).",
      "warn",
      6,
    );
  }
  return ws;
}

function pactDetailSheet(wb: ExcelJS.Workbook, r: PactResult) {
  const ws = wb.addWorksheet("Shipment Detail", { views: [{ showGridLines: false }] });
  autoWidth(ws, [28, 34, 18, 8, 12, 14, 18, 30, 16, 12, 12]);
  titleRow(ws, `PACT Act ENDS report - ${r.state} - ${r.periodLabel}`, 11);
  spacer(ws);
  noteRow(ws, "Contains customer PII. Handle accordingly - do not email unencrypted, do not retain beyond the legal requirement.", "warn", 11);
  spacer(ws);
  headerRow(ws, [
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
    "Sticks",
  ]);
  for (const row of r.rows) {
    const added = ws.addRow([
      row.customerName ?? "",
      row.shipToAddress ?? "",
      row.shipToCity ?? "",
      row.shipToState ?? "",
      row.shipToZip ?? "",
      row.invoiceDate ?? "",
      row.invoiceNumber ?? "",
      // "Suorin Air" already names its brand; "Suorin - Suorin Air" says it twice.
      row.brand && row.product?.toUpperCase().startsWith(row.brand.toUpperCase())
        ? row.product
        : [row.brand, row.product].filter(Boolean).join(" - "),
      row.quantity,
      row.ml,
      "",
    ]);
    added.getCell(9).numFmt = QTY_FMT;
    added.getCell(10).numFmt = QTY_FMT;
    if (!row.customerName || !row.shipToAddress) fill(added.getCell(1), `FF${WARN}`);
  }
  spacer(ws);
  noteRow(ws, "The Sticks column stays empty - it is for cigarettes, which you do not sell.", "note", 11);
  return ws;
}

function reconciliationSheet(wb: ExcelJS.Workbook, r: AnyResult, sourceNote: string) {
  const ws = wb.addWorksheet("Reconciliation", { views: [{ showGridLines: false }] });
  autoWidth(ws, [42, 20, 20, 60]);
  titleRow(ws, "Reconciliation & audit trail", 4);
  spacer(ws);

  if (r.taxType === "sales") {
    sectionRow(ws, "The invariant: Taxable + Exempt must equal Gross", 4);
    headerRow(ws, ["Check", "Value", "Expected", "Result"]);
    const rows: [string, number, number, boolean][] = [
      ["Gross (deduped State rows, less discounts)", r.gross, r.gross, true],
      ["Exempt", r.exempt, r.exempt, true],
      ["Taxable (Gross - Exempt)", r.taxable, round2(r.gross - r.exempt), true],
      ["Taxable + Exempt", round2(r.taxable + r.exempt), r.gross, r.reconciles],
    ];
    for (const [label, value, expected, pass] of rows) {
      const row = ws.addRow([label, value, expected, pass ? "OK" : `FAIL - off by ${r.reconcileDiff}`]);
      row.getCell(2).numFmt = MONEY_FMT;
      row.getCell(3).numFmt = MONEY_FMT;
      fill(row.getCell(4), pass ? `FF${OK_GREEN}` : `FF${WARN}`);
    }
    spacer(ws);

    sectionRow(ws, "Collected vs computed", 4);
    headerRow(ws, ["Measure", "Amount", "", "Meaning"]);
    const cvc: [string, number, string][] = [
      ["Tax collected by Avalara (all jurisdiction rows)", r.taxCollected, "What was actually charged to customers"],
      ["Tax computed at the state's official rate", r.taxComputed, "What the state's form will assess"],
      ["Delta (computed - collected)", r.delta, r.delta > 0 ? "UNDER-COLLECTED - the difference is a margin hit" : r.delta < 0 ? "Over-collected" : "Match"],
    ];
    for (const [label, value, meaning] of cvc) {
      const row = ws.addRow([label, value, "", meaning]);
      row.getCell(2).numFmt = MONEY_FMT;
      row.getCell(4).alignment = { wrapText: true };
      // Under-collection is the margin hit; over-collection is not an alarm.
      if (label.startsWith("Delta") && r.delta >= 0.01) fill(row.getCell(2), `FF${WARN}`);
    }
    spacer(ws);

    sectionRow(ws, "State vs local split (as collected)", 4);
    ws.addRow(["State-level tax", r.stateTaxCollected]).getCell(2).numFmt = MONEY_FMT;
    ws.addRow(["Local (county/city/special) tax", r.localTaxCollected]).getCell(2).numFmt = MONEY_FMT;
    spacer(ws);

    sectionRow(ws, "Source data", 4);
    ws.addRow(["Avalara rows read", r.rowCount]);
    ws.addRow(["Unique document lines (after dedupe)", r.lineCount]);
    ws.addRow(["Documents", r.documentCount]);
    ws.addRow(["Return lines netted", r.returnLineCount]);
    ws.addRow(["State rate applied", fmtPct(r.stateRate)]);
    ws.addRow(["Rounding", r.rounding === "whole_dollar" ? "Whole dollars" : "Cents"]);
    ws.addRow(["Allocation mode", r.allocation]);
  } else if (r.taxType === "excise") {
    sectionRow(ws, "Excise basis", 4);
    ws.addRow(["Structure", r.structure]);
    ws.addRow(["Basis", r.basis === "RECEIPTS" ? "RECEIPTS (product purchased)" : "SALES (product sold)"]);
    ws.addRow(["Total tax", r.taxComputed]).getCell(2).numFmt = MONEY_FMT;
    ws.addRow(["SKU coverage", `${r.skuCoverage.matched} of ${r.skuCoverage.total}`]);
  } else {
    sectionRow(ws, "PACT report", 4);
    ws.addRow(["Shipment lines", r.shipmentCount]);
    ws.addRow(["Total quantity", r.totalQuantity]);
    ws.addRow(["Total mL", r.totalMl]);
    ws.addRow(["Data source", r.source === "shipments" ? "Shipment feed" : "Avalara sales export (incomplete for PACT)"]);
  }

  spacer(ws);
  noteRow(ws, sourceNote, "note", 4);
  return ws;
}

function notesSheet(wb: ExcelJS.Workbook, r: AnyResult) {
  const ws = wb.addWorksheet("Notes", { views: [{ showGridLines: false }] });
  autoWidth(ws, [110]);
  titleRow(ws, "Notes, flags and things needing human judgment", 1);
  spacer(ws);
  if (r.warnings.length) {
    sectionRow(ws, "Warnings", 1);
    for (const w of r.warnings) noteRow(ws, w, "warn", 1);
    spacer(ws);
  }
  if (r.notes.length) {
    sectionRow(ws, "Notes", 1);
    for (const n of r.notes) noteRow(ws, n, "note", 1);
    spacer(ws);
  }
  sectionRow(ws, "Standing reminders", 1);
  for (const n of [
    "Every figure here traces to transactions x a rate in an editable table. Nothing is estimated or guessed.",
    "When a state changes a rate, edit ONE row in Config with the correct effective date. Past periods keep the old rate automatically.",
    "Frequency is stored PER STATE PER TAX TYPE. Kansas sales is annual while its EC-2 excise is monthly - never assume one frequency covers a state.",
    "This system is an accounting tool, not tax advice. A CPA should sign off on the rule set and spot-check filings.",
  ]) {
    noteRow(ws, n, "note", 1);
  }
  return ws;
}

/* ------------------------------------------------------------------ */

export async function buildWorkbook(r: AnyResult, ctx: FormCtx): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.company;
  wb.created = new Date();

  const sourceNote = `Generated from the normalized Avalara transactions for ${r.state} ${periodLabel(r.period)} using the config effective at the start of the period.`;

  if (r.taxType === "sales") {
    const spec = salesFormFor(r.state);
    filingSheet(wb, r, ctx, spec.steps(r, ctx));
    returnSheet(wb, r, ctx, spec.title, spec.lines(r, ctx));
    jurisdictionSheet(wb, r);
    reconciliationSheet(wb, r, sourceNote);
  } else if (r.taxType === "excise") {
    const spec = exciseFormFor(r.state);
    filingSheet(wb, r, ctx, spec.steps(r, ctx));
    returnSheet(wb, r, ctx, spec.title, spec.lines(r, ctx));
    exciseDetailSheet(wb, r);
    reconciliationSheet(wb, r, sourceNote);
  } else {
    const spec = pactFormFor(r.state);
    filingSheet(wb, r, ctx, spec.steps(r, ctx));
    pactDetailSheet(wb, r);
    reconciliationSheet(wb, r, sourceNote);
  }

  notesSheet(wb, r);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function workbookFilename(r: AnyResult): string {
  return `${r.state}_${r.taxType}_${r.period}.xlsx`;
}
