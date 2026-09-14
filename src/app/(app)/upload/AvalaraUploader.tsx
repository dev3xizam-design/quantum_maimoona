"use client";

import { useState } from "react";
import { FileDrop } from "@/components/FileDrop";
import { postJson } from "@/lib/api-client";
import Papa from "papaparse";
import JSZip from "jszip";
import type { Worksheet } from "exceljs";
import {
  accumulateStats,
  buildHeaderMap,
  emptyStats,
  missingRequired,
  normalizeRow,
  roundStats,
  type IngestStats,
  type NormalizedRow,
} from "@/lib/ingest/avalara";

const BATCH = 400;

type Progress = { phase: string; rows: number; inserted: number; duplicates: number };

/**
 * The Avalara export is parsed IN THE BROWSER and streamed to the API in small
 * batches. That keeps a 200k-row, 198-column file well clear of the serverless
 * request-body limit, and the validation report can be shown as it goes.
 */
export function AvalaraUploader() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [stats, setStats] = useState<IngestStats | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const post = <T,>(path: string, body: unknown) => postJson<T>(path, body);

  async function parseCsv(
    file: File | Blob,
    name: string,
    uploadId: number,
    stats: IngestStats,
    seen: Set<string>,
    counters: Progress,
  ) {
    return new Promise<void>((resolve, reject) => {
      let map: Record<string, string> | null = null;
      let buffer: NormalizedRow[] = [];
      const pending: Promise<unknown>[] = [];

      Papa.parse(file as File, {
        header: true,
        skipEmptyLines: true,
        chunkSize: 1024 * 512,
        chunk: (results, parser) => {
          if (!map) {
            map = buildHeaderMap(results.meta.fields ?? []);
            const missing = missingRequired(map);
            if (missing.length) {
              parser.abort();
              reject(
                new Error(
                  `${name}: missing required column(s) ${missing.join(", ")}. Is this a SalesTaxDocumentLineDetail export?`,
                ),
              );
              return;
            }
          }
          for (const raw of results.data as Record<string, unknown>[]) {
            const row = normalizeRow(raw, map, name);
            if (!row) continue;
            accumulateStats(stats, row, seen);
            buffer.push(row);
          }
          if (buffer.length >= BATCH) {
            const batch = buffer;
            buffer = [];
            parser.pause();
            pending.push(
              post<{ inserted: number; duplicates: number }>("/api/ingest/rows", { uploadId, rows: batch })
                .then((r) => {
                  counters.rows += batch.length;
                  counters.inserted += r.inserted;
                  counters.duplicates += r.duplicates;
                  setProgress({ ...counters });
                  parser.resume();
                })
                .catch((e) => {
                  parser.abort();
                  reject(e);
                }),
            );
          }
        },
        complete: async () => {
          try {
            await Promise.all(pending);
            if (buffer.length) {
              const r = await post<{ inserted: number; duplicates: number }>("/api/ingest/rows", { uploadId, rows: buffer });
              counters.rows += buffer.length;
              counters.inserted += r.inserted;
              counters.duplicates += r.duplicates;
              setProgress({ ...counters });
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (e) => reject(e),
      });
    });
  }

  /**
   * XLSX path. ExcelJS ships a browser build, so the workbook is read here and
   * only normalized rows cross the wire - the file itself never gets uploaded.
   */
  async function parseXlsx(
    file: File | Blob,
    name: string,
    uploadId: number,
    stats: IngestStats,
    seen: Set<string>,
    counters: Progress,
  ) {
    setProgress({ ...counters, phase: `Reading ${name} (Excel files load fully before parsing)` });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (file as Blob).arrayBuffer());

    const sheet = pickSheet(wb.worksheets);
    if (!sheet) throw new Error(`${name}: no worksheet in this file has Avalara column headers.`);

    const headerRowNumber = findHeaderRow(sheet);
    const headers: string[] = [];
    sheet.getRow(headerRowNumber).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = cellText(cell.value);
    });

    const map = buildHeaderMap(headers.filter(Boolean));
    const missing = missingRequired(map);
    if (missing.length) {
      throw new Error(
        `${name}: missing required column(s) ${missing.join(", ")}. Is this a SalesTaxDocumentLineDetail export?`,
      );
    }

    let buffer: NormalizedRow[] = [];
    const flush = async () => {
      if (!buffer.length) return;
      const batch = buffer;
      buffer = [];
      const r = await post<{ inserted: number; duplicates: number }>("/api/ingest/rows", { uploadId, rows: batch });
      counters.rows += batch.length;
      counters.inserted += r.inserted;
      counters.duplicates += r.duplicates;
      setProgress({ ...counters, phase: "Parsing" });
    };

    for (let n = headerRowNumber + 1; n <= sheet.rowCount; n++) {
      const excelRow = sheet.getRow(n);
      const raw: Record<string, unknown> = {};
      let hasValue = false;
      excelRow.eachCell({ includeEmpty: false }, (cell, col) => {
        const key = headers[col - 1];
        if (!key) return;
        const v = cellValue(cell.value);
        if (v !== null && v !== "") hasValue = true;
        raw[key] = v;
      });
      if (!hasValue) continue;

      const row = normalizeRow(raw, map, name);
      if (!row) continue;
      accumulateStats(stats, row, seen);
      buffer.push(row);
      if (buffer.length >= BATCH) await flush();
    }
    await flush();
  }

  async function handleFiles(files: FileList) {
    setBusy(true);
    setErrors([]);
    setStats(null);
    const counters: Progress = { phase: "Parsing", rows: 0, inserted: 0, duplicates: 0 };
    setProgress(counters);

    try {
      const names = Array.from(files).map((f) => f.name).join(", ");
      const { uploadId } = await post<{ uploadId: number }>("/api/ingest/start", {
        filename: names,
        kind: "avalara",
      });

      const runningStats = emptyStats();
      const seen = new Set<string>();

      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter(
            (f) => !f.dir && /\.(csv|xlsx)$/i.test(f.name) && !f.name.startsWith("__MACOSX"),
          );
          if (!entries.length) {
            throw new Error(`${file.name}: the ZIP contains no .csv or .xlsx files.`);
          }
          for (const entry of entries) {
            const blob = await entry.async("blob");
            if (/\.xlsx$/i.test(entry.name)) {
              await parseXlsx(blob, entry.name, uploadId, runningStats, seen, counters);
            } else {
              await parseCsv(blob, entry.name, uploadId, runningStats, seen, counters);
            }
          }
        } else if (file.name.toLowerCase().endsWith(".csv")) {
          await parseCsv(file, file.name, uploadId, runningStats, seen, counters);
        } else if (file.name.toLowerCase().endsWith(".xlsx")) {
          await parseXlsx(file, file.name, uploadId, runningStats, seen, counters);
        } else if (file.name.toLowerCase().endsWith(".xls")) {
          throw new Error(
            `${file.name}: the old .xls format cannot be read. Open it in Excel and Save As .xlsx or .csv.`,
          );
        } else {
          throw new Error(`${file.name}: upload a .csv, .xlsx or .zip export.`);
        }
      }

      const finalStats = roundStats(runningStats);
      await post("/api/ingest/finish", {
        uploadId,
        rowCount: counters.rows,
        stats: finalStats as unknown as Record<string, unknown>,
      });
      setStats(finalStats);
      setProgress({ ...counters, phase: "Done" });
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
    }
  }

  const partial =
    stats && stats.minDate && stats.maxDate
      ? stats.minDate.slice(8) !== "01" || !isMonthEnd(stats.maxDate)
      : false;

  const pct =
    progress && progress.rows > 0
      ? Math.min(100, Math.round((progress.inserted / Math.max(progress.rows, 1)) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h2 className="text-[14px] font-semibold">Avalara export</h2>
        <p className="mt-1 text-[12.5px] text-[var(--muted)]">
          The SalesTaxDocumentLineDetail report — <strong>.xlsx</strong>, <strong>.csv</strong>, or a
          ZIP of several. It is parsed in your browser and streamed in, so the file never leaves your
          machine and size is not a limit. Re-uploading a period is safe: duplicate rows are ignored,
          never double-counted.
        </p>

        <div className="mt-4">
          <FileDrop
            accept=".csv,.xlsx,.zip"
            multiple
            disabled={busy}
            buttonLabel={busy ? "Working…" : "Choose files"}
            hint=".xlsx, .csv or .zip — several at once is fine"
            onFiles={handleFiles}
          />
        </div>

        {progress && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="font-semibold">{progress.phase}</span>
              <span className="tnum text-[var(--muted)]">
                {progress.rows.toLocaleString()} read · {progress.inserted.toLocaleString()} new ·{" "}
                {progress.duplicates.toLocaleString()} duplicate
              </span>
            </div>
            <div className="progressbar">
              <span style={{ width: progress.phase === "Done" ? "100%" : `${Math.max(pct, 6)}%` }} />
            </div>
          </div>
        )}

        {errors.map((e, i) => (
          <div key={i} className="callout callout-warn mt-4">{e}</div>
        ))}
      </div>

      {stats && (
        <div className="panel overflow-hidden">
          <div className="panel-head">
            Validation report
            <span className="ml-auto text-[11.5px] font-normal text-[var(--muted)]">
              {stats.rows.toLocaleString()} rows · {stats.lines.toLocaleString()} unique lines ·{" "}
              {stats.minDate} to {stats.maxDate}
            </span>
          </div>

          <div className="space-y-3 p-4">
            {partial && (
              <div className="callout callout-warn">
                This file does not start on the 1st or end on a month end — the period may be only
                partially covered. Check before filing.
              </div>
            )}
            {stats.nonCommitted > 0 && (
              <div className="callout callout-warn">
                {stats.nonCommitted.toLocaleString()} row(s) are not in Committed status. Only
                committed documents should be filed — re-export from Avalara with the Committed
                filter.
              </div>
            )}
            <div className="callout callout-note">
              Every state below must show <strong>OK</strong>. That check —
              Taxable + Exempt = Gross — is what catches a double-counted or partial upload before
              it reaches a return.
            </div>
          </div>

          <table className="qtable">
            <thead>
              <tr>
                <th>State</th>
                <th className="num">Rows</th>
                <th className="num">Gross</th>
                <th className="num">Exempt</th>
                <th className="num">Taxable</th>
                <th className="num">Tax collected</th>
                <th>Taxable + Exempt = Gross</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.byState)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([state, s]) => {
                  const ok = Math.abs(s.gross - (s.taxable + s.exempt)) <= 0.011;
                  return (
                    <tr key={state} className={ok ? "" : "flagged"}>
                      <td className="font-semibold">{state}</td>
                      <td className="num">{s.rows.toLocaleString()}</td>
                      <td className="num">{s.gross.toFixed(2)}</td>
                      <td className="num">{s.exempt.toFixed(2)}</td>
                      <td className="num">{s.taxable.toFixed(2)}</td>
                      <td className="num">{s.tax.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${ok ? "badge-filed" : "badge-overdue"}`}>
                          {ok ? "OK" : "MISMATCH"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function isMonthEnd(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return d.getUTCDate() === next.getUTCDate();
}

/* ------------------------------------------------------------------ */
/* XLSX helpers                                                        */
/* ------------------------------------------------------------------ */

/** ExcelJS cell values can be rich text, formula results, hyperlinks or dates. */
function cellValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as Record<string, unknown>;
  if ("result" in o) return cellValue(o.result);
  if ("text" in o) return String(o.text);
  if ("richText" in o) return (o.richText as { text: string }[]).map((r) => r.text).join("");
  if ("error" in o) return null;
  return String(v);
}

function cellText(v: unknown): string {
  const out = cellValue(v);
  return out === null ? "" : String(out).trim();
}

function headerValuesAt(sheet: Worksheet, rowNumber: number): string[] {
  const values: string[] = [];
  sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
    values.push(cellText(cell.value));
  });
  return values.filter(Boolean);
}

/** Avalara puts the headers on row 1, but tolerate a title block above them. */
function findHeaderRow(sheet: Worksheet): number {
  for (let n = 1; n <= Math.min(20, sheet.rowCount); n++) {
    if (missingRequired(buildHeaderMap(headerValuesAt(sheet, n))).length === 0) return n;
  }
  return 1;
}

/** With several sheets, take the one whose headers actually match. */
function pickSheet(sheets: Worksheet[]): Worksheet | null {
  if (!sheets.length) return null;
  for (const sheet of sheets) {
    for (let n = 1; n <= Math.min(20, sheet.rowCount); n++) {
      if (missingRequired(buildHeaderMap(headerValuesAt(sheet, n))).length === 0) return sheet;
    }
  }
  return sheets.reduce((a, b) => (b.rowCount > a.rowCount ? b : a));
}
