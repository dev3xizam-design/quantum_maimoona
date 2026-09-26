/**
 * An .xlsx sheet -> the same `{ records, headers }` shape Papa gives for a CSV,
 * so every parser downstream reads one format.
 *
 * Matrixify's Shopify exports are .xlsx with the data on an "Orders" sheet and
 * an "Export Summary" sheet beside it; the preferred sheet is taken when present,
 * otherwise the first one.
 *
 * Isomorphic: the uploader loads it with a dynamic import so ExcelJS only ships
 * to the browser when someone actually drops a spreadsheet.
 */

import ExcelJS from "exceljs";

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return v.result === undefined ? "" : String(v.result);
    return "";
  }
  return String(v);
}

export async function readXlsxRecords(
  data: ArrayBuffer,
  preferredSheet?: string,
): Promise<{ records: Record<string, string>[]; headers: string[]; sheet: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = (preferredSheet && wb.getWorksheet(preferredSheet)) || wb.worksheets[0];
  if (!ws) return { records: [], headers: [], sheet: "" };

  const headers = (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(cellText);
  const records: Record<string, string>[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    const rec: Record<string, string> = {};
    headers.forEach((h, j) => {
      rec[h] = cellText(values[j + 1]);
    });
    records.push(rec);
  });
  return { records, headers, sheet: ws.name };
}
