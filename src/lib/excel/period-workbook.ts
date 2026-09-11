/**
 * The whole month in one workbook: a Summary tab, an Action Items tab, and
 * then ONE TAB PER STATE carrying that state's own return - the form lines in
 * the order its portal asks for them, its jurisdiction breakdown, its excise
 * and its PACT count.
 */

import ExcelJS from "exceljs";
import { fmtPct, round2 } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import { rateUnitLabel } from "@/lib/engine/excise";
import type { StateBundle, PeriodComputation } from "@/lib/period";
import { salesFormFor } from "./forms/sales";
import { exciseFormFor } from "./forms/excise";
import type { FormCtx, ReturnLine } from "./forms/types";
import {
  MONEY_FMT,
  MONEY0_FMT,
  PCT_FMT,
  QTY_FMT,
  HILITE,
  WARN,
  OK_GREEN,
  SUBTLE,
  ACCENT,
  autoWidth,
  fill,
  headerRow,
  noteRow,
  sectionRow,
  spacer,
  titleRow,
} from "./style";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const numFmt = (f: string | undefined) =>
  f === "money0" ? MONEY0_FMT : f === "pct" ? PCT_FMT : f === "qty" ? QTY_FMT : MONEY_FMT;

function ctxFor(b: StateBundle, company: string, fein: string): FormCtx {
  return {
    company,
    fein,
    accountNumber: b.account?.accountNumber ?? null,
    licenseNumber: b.account?.licenseNumber ?? b.exciseAccount?.licenseNumber ?? null,
    loginField: null,
    accountNotes: null,
  };
}

function writeLines(ws: ExcelJS.Worksheet, lines: ReturnLine[]) {
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
    const cell = row.getCell(3);
    if (typeof l.value === "number") {
      cell.numFmt = numFmt(l.format);
      cell.alignment = { horizontal: "right" };
    }
    if (l.highlight) {
      fill(cell, `FF${HILITE}`);
      cell.font = { bold: true };
      row.getCell(2).font = { bold: true };
    }
    row.getCell(4).font = { size: 9, color: { argb: "FF6B7280" } };
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
  }
}

/* ------------------------------------------------------------------ */

function instructionsTab(wb: ExcelJS.Workbook, comp: PeriodComputation, company: string, fein: string) {
  const ws = wb.addWorksheet("Instructions", { views: [{ showGridLines: false }] });
  autoWidth(ws, [4, 30, 96]);

  titleRow(ws, `QUANTUM TAX AUTOMATION - ${company} - ${periodLabel(comp.month)}`, 3);
  const sub = ws.addRow(["", `FEIN ${fein}`, `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`]);
  sub.font = { color: { argb: "FF6B7F74" }, size: 10 };
  spacer(ws);

  sectionRow(ws, "HOW TO USE THIS WORKBOOK", 3);
  const steps = [
    "Start on the Summary tab. It lists every state that had sales this period, with the tax due for each and the date it is due.",
    "Read the Action Items tab next. Anything that would make a return wrong is listed there, per state, with the exact SKUs or jurisdictions named. Resolve those before filing anything.",
    "Then work state by state. Every state has its own tab, named by its two-letter code along the bottom of this workbook.",
    "On a state's tab, the Return section lists that state's form lines IN THE ORDER ITS PORTAL ASKS FOR THEM. Type the yellow numbers into the portal, top to bottom.",
    "The numbered steps at the bottom of each state tab tell you where to log in, which form to open, and which box each figure belongs in.",
    "After you file, go back into Quantum and press Mark filed with the confirmation number. That is what keeps the calendar honest.",
  ];
  steps.forEach((text, i) => {
    const row = ws.addRow([String(i + 1), "", text]);
    row.getCell(1).font = { bold: true, color: { argb: `FF${ACCENT}` } };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(16, Math.ceil(text.length / 95) * 15);
  });
  spacer(ws);

  sectionRow(ws, "WHAT THE COLOURS MEAN", 3);
  const legend: [string, string, string][] = [
    [HILITE, "Yellow cell", "A number you type into the state portal."],
    [WARN, "Red cell", "Something must be resolved before this return is filed. The reason is on the Action Items tab."],
    [OK_GREEN, "Green cell", "A check that passed - for example Taxable + Exempt = Gross."],
    [SUBTLE, "Grey note", "Context or a warning worth reading, but not a blocker."],
  ];
  for (const [colour, label, meaning] of legend) {
    const row = ws.addRow(["", label, meaning]);
    fill(row.getCell(2), `FF${colour}`);
    row.getCell(2).font = { bold: true };
    row.getCell(3).alignment = { wrapText: true };
  }
  spacer(ws);

  sectionRow(ws, "THINGS THAT CATCH PEOPLE OUT", 3);
  const gotchas = [
    "Frequency is per state PER TAX TYPE. Kansas sales tax is ANNUAL while its EC-2 excise is MONTHLY. Each state tab shows the period each of its returns covers.",
    "PACT Act reports are due on the 10th - ten days EARLIER than most sales tax returns, which are due on the 20th.",
    "Vapor excise is a separate return on a separate account from sales tax, with a different base. It is never part of the sales tax return.",
    "Kansas EC-2 taxes mL PURCHASED into inventory, not mL sold. It reads the purchase import and ignores sales data.",
    "Some forms round to whole dollars (FL, IL, OK, TN). Each state's tab uses that state's own rounding - do not re-round.",
    "Where a figure is missing rather than zero, Quantum says so instead of guessing. A blank wholesale cost means the excise shown is understated, not that the tax is nil.",
  ];
  for (const g of gotchas) noteRow(ws, g, "note", 3);
  spacer(ws);

  sectionRow(ws, "IMPORTANT", 3);
  noteRow(
    ws,
    "This workbook PREPARES returns. A person files them. Every figure traces to transactions multiplied by a rate held in an editable table - nothing here is estimated. It is an accounting tool, not tax advice: a CPA should sign off on the rule set and spot-check filings.",
    "warn",
    3,
  );
  noteRow(
    ws,
    "Never record a state-portal password, PIN, card number or bank login in this workbook or in Quantum. Those belong in a password manager.",
    "warn",
    3,
  );
  return ws;
}


function summaryTab(wb: ExcelJS.Workbook, comp: PeriodComputation, company: string, fein: string) {
  const ws = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 8, showGridLines: false }] });
  autoWidth(ws, [8, 22, 16, 16, 16, 16, 16, 16, 14, 12, 12, 40]);

  titleRow(ws, `ALL STATES - ${periodLabel(comp.month)} - ${company}`, 12);
  const info = ws.addRow([`FEIN ${fein}`, `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`]);
  info.font = { color: { argb: "FF6B7280" } };
  spacer(ws);

  sectionRow(ws, "Totals for the period", 12);
  const t = comp.totals;
  const totalsRow = [
    ["States with activity", `${t.statesWithActivity} of ${t.states} registered`],
    ["Gross sales", t.gross],
    ["Taxable sales", t.taxable],
    ["Sales tax due", t.salesTax],
    ["Vapor excise due", t.exciseTax],
    ["TOTAL TAX DUE", t.totalTax],
    ["Tax collected by Avalara", t.collected],
    ["Under/over-collection", t.delta],
    ["PACT shipment lines", t.pactShipments],
  ] as [string, string | number][];
  for (const [label, value] of totalsRow) {
    const r = ws.addRow([label, value]);
    if (typeof value === "number") r.getCell(2).numFmt = MONEY_FMT;
    if (label === "TOTAL TAX DUE") {
      r.font = { bold: true, size: 12 };
      fill(r.getCell(2), `FF${HILITE}`);
    }
    if (label.startsWith("Under/over") && Math.abs(t.delta) >= 0.01) fill(r.getCell(2), `FF${WARN}`);
  }
  spacer(ws);

  if (t.reconcileFailures.length) {
    noteRow(
      ws,
      `RECONCILIATION FAILED in ${t.reconcileFailures.join(", ")} - Taxable + Exempt does not equal Gross. Do not file those states until the upload is corrected.`,
      "warn",
      12,
    );
    spacer(ws);
  }

  sectionRow(ws, "By state - each has its own tab", 12);
  headerRow(ws, [
    "State", "Name", "Gross", "Exempt", "Taxable", "Sales tax", "Collected", "Delta",
    "Excise", "PACT lines", "Sales due", "Form / notes",
  ]);

  for (const b of comp.bundles) {
    if (!b.hasActivity) continue;
    const s = b.sales;
    const row = ws.addRow([
      b.state,
      STATE_NAMES[b.state] ?? b.state,
      s?.gross ?? 0,
      s?.exempt ?? 0,
      s?.taxable ?? 0,
      s?.taxComputed ?? 0,
      s?.taxCollected ?? 0,
      s?.delta ?? 0,
      b.excise?.taxComputed ?? 0,
      b.pact?.shipmentCount ?? 0,
      s?.dueDate ?? "",
      [s?.form, b.excise?.form].filter(Boolean).join(" · "),
    ]);
    [3, 4, 5, 6, 7, 8, 9].forEach((i) => (row.getCell(i).numFmt = MONEY_FMT));
    row.getCell(1).font = { bold: true };
    if (s && Math.abs(s.delta) >= 0.01) fill(row.getCell(8), `FF${WARN}`);
    if (s && !s.reconciles) fill(row.getCell(1), `FF${WARN}`);
  }

  const quiet = comp.bundles.filter((b) => !b.hasActivity).map((b) => b.state);
  if (quiet.length) {
    spacer(ws);
    noteRow(ws, `No transactions this period (nothing to file): ${quiet.join(", ")}`, "note", 12);
  }
  return ws;
}

function actionsTab(wb: ExcelJS.Workbook, comp: PeriodComputation) {
  const ws = wb.addWorksheet("Action Items", { views: [{ showGridLines: false }] });
  autoWidth(ws, [8, 12, 120]);
  titleRow(ws, `Everything needing attention before filing - ${periodLabel(comp.month)}`, 3);
  spacer(ws);

  let any = false;
  for (const b of comp.bundles) {
    const items: [string, string][] = [
      ...(b.sales?.warnings ?? []).map((w) => ["sales", w] as [string, string]),
      ...(b.excise?.warnings ?? []).map((w) => ["excise", w] as [string, string]),
      ...(b.pact?.warnings ?? []).map((w) => ["pact", w] as [string, string]),
      ...b.errors.map((e) => ["error", e] as [string, string]),
    ];
    if (!items.length) continue;
    any = true;
    for (const [type, text] of items) {
      const row = ws.addRow([b.state, type, text]);
      row.getCell(1).font = { bold: true };
      row.getCell(3).alignment = { wrapText: true, vertical: "top" };
      row.height = Math.max(16, Math.ceil(text.length / 115) * 15);
      if (/FAILED|MISSING|UNDER-COLLECTION|NOT SET/.test(text)) fill(row.getCell(2), `FF${WARN}`);
    }
  }
  if (!any) {
    const row = ws.addRow(["", "", "Nothing outstanding - every state reconciled with no missing data."]);
    fill(row.getCell(3), `FF${OK_GREEN}`);
  }
  return ws;
}

function stateTab(wb: ExcelJS.Workbook, b: StateBundle, company: string, fein: string) {
  const ws = wb.addWorksheet(b.state, { views: [{ showGridLines: false }] });
  autoWidth(ws, [10, 52, 18, 62]);
  const ctx = ctxFor(b, company, fein);

  titleRow(ws, `${b.state} - ${STATE_NAMES[b.state] ?? b.state}`, 4);

  if (!b.hasActivity) {
    spacer(ws);
    noteRow(ws, "No transactions for this state in this period. Nothing to file.", "note", 4);
    return ws;
  }

  const kv = (label: string, value: unknown) => {
    const r = ws.addRow([label, String(value ?? "-")]);
    r.getCell(1).font = { bold: true, color: { argb: "FF6B7280" } };
    ws.mergeCells(r.number, 2, r.number, 4);
  };
  kv("Entity", `${company}   FEIN ${fein}`);
  if (b.account?.accountNumber) kv("Sales tax account", b.account.accountNumber);
  if (b.exciseAccount?.licenseNumber) kv("Excise license", b.exciseAccount.licenseNumber);
  spacer(ws);

  /* ---- SALES ---------------------------------------------------------- */
  if (b.sales) {
    const s = b.sales;
    sectionRow(ws, `SALES / USE TAX - ${s.form ?? "return"} - ${s.periodLabel} - due ${s.dueDate}`, 4);
    if (s.portal) kv("Portal", s.portal);
    spacer(ws);

    writeLines(ws, salesFormFor(b.state).lines(s, ctx));
    spacer(ws);

    sectionRow(ws, "Reconciliation", 4);
    const rec = ws.addRow([
      "",
      "Taxable + Exempt = Gross",
      s.reconciles ? "OK" : `FAILED by ${s.reconcileDiff}`,
      "",
    ]);
    fill(rec.getCell(3), s.reconciles ? `FF${OK_GREEN}` : `FF${WARN}`);
    const d = ws.addRow(["", "Computed - collected", s.delta, "Positive means under-collected"]);
    d.getCell(3).numFmt = MONEY_FMT;
    if (Math.abs(s.delta) >= 0.01) fill(d.getCell(3), `FF${WARN}`);
    ws.addRow(["", "State rate applied", fmtPct(s.stateRate), ""]);
    ws.addRow(["", "Rounding", s.rounding === "whole_dollar" ? "Whole dollars" : "Cents", ""]);
    spacer(ws);

    const allocated = s.byCounty.filter((l) => l.gross !== 0 || l.tax !== 0);
    if (s.allocation !== "flat" && allocated.length) {
      sectionRow(ws, "Jurisdiction allocation", 4);
      headerRow(ws, ["Code", "Jurisdiction", "Taxable", "Tax"]);
      for (const l of allocated) {
        const row = ws.addRow([l.code ?? "MISSING", l.name, l.taxable, l.tax]);
        row.getCell(3).numFmt = MONEY_FMT;
        row.getCell(4).numFmt = MONEY_FMT;
        if (!l.code) fill(row.getCell(1), `FF${WARN}`);
        if (l.pairedCode) {
          const pair = ws.addRow([l.pairedCode, `${l.pairedName ?? ""} (county pair)`, l.taxable, 0]);
          pair.getCell(3).numFmt = MONEY_FMT;
          pair.font = { italic: true };
        }
      }
      spacer(ws);
    }
  }

  /* ---- EXCISE --------------------------------------------------------- */
  if (b.excise) {
    const e = b.excise;
    sectionRow(
      ws,
      `VAPOR EXCISE - ${e.form ?? "return"} - structure ${e.structure}, ${e.basis} basis - due ${e.dueDate}`,
      4,
    );
    if (e.portal) kv("Portal", e.portal);
    spacer(ws);
    writeLines(ws, exciseFormFor(b.state).lines(e, ctx));
    spacer(ws);

    const gaps = [
      ...e.dataGaps.cost.map((g) => ({ ...g, missing: "wholesale cost" })),
      ...e.dataGaps.ml.map((g) => ({ ...g, missing: "mL per unit" })),
      ...e.dataGaps.systemType.map((g) => ({ ...g, missing: "open/closed" })),
    ].sort((a, b2) => b2.retail - a.retail);
    if (gaps.length) {
      sectionRow(ws, "SKUs missing data - the excise above is understated until these are filled in", 4);
      headerRow(ws, ["SKU", "Product", "Missing", "Retail this period"]);
      for (const g of gaps.slice(0, 40)) {
        const row = ws.addRow([g.sku, g.description ?? "", g.missing, g.retail]);
        row.getCell(4).numFmt = MONEY_FMT;
        fill(row.getCell(3), `FF${WARN}`);
      }
      spacer(ws);
    }
  }

  /* ---- PACT ----------------------------------------------------------- */
  if (b.pact && b.pact.shipmentCount > 0) {
    const p = b.pact;
    sectionRow(ws, `PACT ACT - ENDS report - due ${p.dueDate} (earlier than sales tax)`, 4);
    ws.addRow(["", "Shipment lines to report", p.shipmentCount, ""]);
    ws.addRow(["", "Total quantity", p.totalQuantity, ""]).getCell(3).numFmt = QTY_FMT;
    ws.addRow(["", "Data source", p.source === "shipments" ? "Shipment feed" : "Avalara export - customer detail MISSING", ""]);
    spacer(ws);
  }

  /* ---- STEPS AND WARNINGS --------------------------------------------- */
  const warnings = [...(b.sales?.warnings ?? []), ...(b.excise?.warnings ?? []), ...(b.pact?.warnings ?? [])];
  if (warnings.length) {
    sectionRow(ws, "Resolve before filing", 4);
    for (const w of warnings) noteRow(ws, w, "warn", 4);
    spacer(ws);
  }

  if (b.sales) {
    sectionRow(ws, "How to file the sales tax return", 4);
    salesFormFor(b.state)
      .steps(b.sales, ctx)
      .forEach((step, i) => {
        const row = ws.addRow([String(i + 1), step]);
        ws.mergeCells(row.number, 2, row.number, 4);
        row.getCell(1).font = { bold: true, color: { argb: "FF0F766E" } };
        row.getCell(2).alignment = { wrapText: true, vertical: "top" };
        row.height = Math.max(16, Math.ceil(step.length / 100) * 15);
      });
  }
  return ws;
}

export async function buildPeriodWorkbook(
  comp: PeriodComputation,
  opts: { company: string; fein: string; includeQuietStates?: boolean },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = opts.company;
  wb.created = new Date();

  instructionsTab(wb, comp, opts.company, opts.fein);
  summaryTab(wb, comp, opts.company, opts.fein);
  actionsTab(wb, comp);

  for (const b of comp.bundles) {
    if (!b.hasActivity && !opts.includeQuietStates) continue;
    stateTab(wb, b, opts.company, opts.fein);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function periodWorkbookFilename(month: string): string {
  return `All_States_${month}.xlsx`;
}

export { STATE_NAMES };
