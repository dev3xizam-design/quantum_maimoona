import type { Worksheet, Row, Cell } from "exceljs";

/* Quantum palette, sampled from the logo mark. */
export const BRAND = "05301F";      // deep forest - title bars
export const ACCENT = "0F5B33";     // section headings, table headers
export const ACCENT_LIGHT = "1F9B4D";
export const HILITE = "FFF3B0";     // yellow = a number you type into the portal
export const WARN = "FDECEA";       // red = resolve before filing
export const OK_GREEN = "DCF5E5";
export const RULE = "DFE6E2";
export const SUBTLE = "F3F7F4";

export const MONEY_FMT = '#,##0.00;[Red]-#,##0.00';
export const MONEY0_FMT = '#,##0;[Red]-#,##0';
export const PCT_FMT = "0.0000%";
export const QTY_FMT = "#,##0.0000";

export function fill(cell: Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function titleRow(ws: Worksheet, text: string, span = 6): Row {
  const row = ws.addRow([text]);
  row.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  row.height = 24;
  ws.mergeCells(row.number, 1, row.number, span);
  fill(row.getCell(1), `FF${BRAND}`);
  row.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  return row;
}

export function sectionRow(ws: Worksheet, text: string, span = 6): Row {
  const row = ws.addRow([text]);
  row.font = { bold: true, size: 11, color: { argb: `FF${ACCENT}` } };
  ws.mergeCells(row.number, 1, row.number, span);
  row.getCell(1).border = { bottom: { style: "thin", color: { argb: `FF${RULE}` } } };
  return row;
}

export function kv(ws: Worksheet, label: string, value: unknown, span = 6): Row {
  const row = ws.addRow([label, value ?? ""]);
  row.getCell(1).font = { bold: true, color: { argb: "FF6B7280" } };
  ws.mergeCells(row.number, 2, row.number, span);
  row.getCell(2).alignment = { horizontal: "left", wrapText: true };
  return row;
}

export function headerRow(ws: Worksheet, cells: string[]): Row {
  const row = ws.addRow(cells);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => {
    fill(c, `FF${ACCENT}`);
    c.alignment = { vertical: "middle", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: `FF${RULE}` } } };
  });
  row.height = 20;
  return row;
}

export function spacer(ws: Worksheet) {
  ws.addRow([]);
}

export function autoWidth(ws: Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

export function noteRow(ws: Worksheet, text: string, kind: "note" | "warn" = "note", span = 6): Row {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const c = row.getCell(1);
  c.alignment = { wrapText: true, vertical: "top" };
  if (kind === "warn") {
    fill(c, `FF${WARN}`);
    c.font = { bold: true, color: { argb: "FF991B1B" } };
  } else {
    c.font = { color: { argb: "FF374151" } };
  }
  row.height = Math.max(18, Math.ceil(text.length / 110) * 16);
  return row;
}
