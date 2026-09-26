"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { FileDrop } from "@/components/FileDrop";
import { ApiError, postJson } from "@/lib/api-client";
import { parseShopifyOrders, type ShopifyParseResult } from "@/lib/ingest/shopify";

const BATCH = 400;

export function ShopifyUploader() {
  const [store, setStore] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<ShopifyParseResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const router = useRouter();

  async function handle(file: File) {
    if (!store.trim()) {
      setMsg({ ok: false, text: "Name the site this export came from first — it keeps the three Shopify stores apart." });
      return;
    }
    setBusy(true);
    setMsg(null);
    setReport(null);
    try {
      let records: Record<string, string>[];
      let headers: string[];
      if (/\.xlsx$/i.test(file.name)) {
        const { readXlsxRecords } = await import("@/lib/ingest/xlsx-records");
        ({ records, headers } = await readXlsxRecords(await file.arrayBuffer(), "Orders"));
      } else {
        const parsed = Papa.parse<Record<string, string>>(await file.text(), {
          header: true,
          skipEmptyLines: true,
        });
        records = parsed.data;
        headers = parsed.meta.fields ?? [];
      }
      const result = parseShopifyOrders(records, headers, store.trim());
      setReport(result);

      if (result.missingColumns.length) {
        throw new Error(
          `That file is missing ${result.missingColumns.join(", ")}. Export Orders from Shopify with all columns included.`,
        );
      }
      if (!result.rows.length) throw new Error("No usable US shipment lines found in that file.");

      const rows = result.rows.map((r) => ({
        sourceSystem: "shopify_csv",
        sourceLabel: store.trim(),
        externalId: r.externalId,
        orderNumber: r.orderNumber,
        period: r.period,
        state: r.state,
        customerName: r.customerName,
        shipToAddress: r.shipToAddress,
        shipToCity: r.shipToCity,
        shipToState: r.shipToState,
        shipToZip: r.shipToZip,
        invoiceDate: r.invoiceDate,
        invoiceNumber: r.invoiceNumber,
        product: r.product,
        brand: r.brand,
        quantity: r.quantity,
        mlTotal: r.mlTotal,
      }));

      let uploadId: number | undefined;
      let stored = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const res = await postJson<{ uploadId: number; count: number }>("/api/ingest/simple", {
          kind: "shipments",
          filename: `${store.trim()} — ${file.name}`,
          rows: rows.slice(i, i + BATCH),
          uploadId,
        });
        uploadId = res.uploadId;
        stored += res.count;
        setProgress({ done: Math.min(i + BATCH, rows.length), total: rows.length });
      }
      await postJson("/api/ingest/simple", { uploadId, done: true, total: stored });

      setMsg({
        ok: true,
        text: `Imported ${stored.toLocaleString()} shipment line(s) from ${result.orders.toLocaleString()} orders, covering ${result.periods[0]} to ${result.periods[result.periods.length - 1]}.`,
      });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError || e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h2 className="text-[14px] font-semibold">Historical Shopify orders</h2>
        <p className="mt-1 max-w-[78ch] text-[12.5px] text-[var(--muted)]">
          For the months your sites were still on Shopify. This is the PACT Act feed — who you
          shipped to, where, when and what — for periods Medusa has no record of. From the
          migration date onwards it comes straight from Medusa instead.
        </p>

        <div className="mt-4 max-w-[320px]">
          <label className="field" htmlFor="store">Which site is this export from?</label>
          <input
            id="store"
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="e.g. Vape Closeouts"
          />
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Used to keep the three stores&rsquo; orders apart, and to make re-importing the same
            file replace rows rather than duplicate them.
          </p>
        </div>

        <div className="mt-4">
          <div className="field">Export it from Shopify</div>
          <p className="text-[12px] text-[var(--muted)]">
            Shopify admin → Orders → Export → <em>All orders</em> (or a date range) → CSV for Excel.
            The engine needs the shipping address columns, so do not trim them out. A Matrixify
            monthly Orders export (.xlsx) works as it is.
          </p>
        </div>

        <div className="mt-4">
          <FileDrop
            accept=".csv,.xlsx"
            disabled={busy}
            buttonLabel={busy ? "Importing…" : "Choose Shopify export"}
            hint="orders_export.csv or a Matrixify Export_….xlsx"
            onFiles={(files) => handle(files[0])}
          />
        </div>

        {progress && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="font-semibold">Importing</span>
              <span className="tnum text-[var(--muted)]">
                {progress.done.toLocaleString()} of {progress.total.toLocaleString()}
              </span>
            </div>
            <div className="progressbar">
              <span style={{ width: `${Math.max(4, (progress.done / progress.total) * 100)}%` }} />
            </div>
          </div>
        )}

        {msg && <div className={`callout mt-4 ${msg.ok ? "callout-ok" : "callout-warn"}`}>{msg.text}</div>}

        {report && report.rows.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Orders", value: report.orders.toLocaleString() },
              { label: "Shipment lines", value: report.rows.length.toLocaleString() },
              { label: "Months covered", value: String(report.periods.length) },
              {
                label: "Skipped",
                value: String(
                  report.skippedNoState + report.skippedNonUs + report.skippedRefunded + report.skippedNonProduct,
                ),
                tone: report.skippedNoState > 0 ? "warn" : undefined,
              },
            ].map((t) => (
              <div key={t.label} className="stat">
                <div className="stat-label">{t.label}</div>
                <div className={`stat-value ${t.tone === "warn" ? "text-[var(--danger)]" : ""}`}>
                  {t.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {report &&
          (report.skippedNonUs > 0 ||
            report.skippedRefunded > 0 ||
            report.skippedNoState > 0 ||
            report.skippedNonProduct > 0) && (
          <div className="callout callout-note mt-3">
            Skipped {report.skippedNonUs} non-US, {report.skippedRefunded} refunded or voided,{" "}
            {report.skippedNonProduct} package-protection or shipping-insurance add-ons, and{" "}
            {report.skippedNoState} with no usable ship-to state (including territories and
            foreign addresses when the export has no country column). PACT only covers interstate
            shipments within the US, and a line with no state cannot be reported at all — it is
            counted here rather than dropped quietly.
          </div>
        )}
      </div>

      <div className="help">
        <strong>Shopify&rsquo;s export repeats each order once per line item</strong>, but fills in
        the order number, date and shipping address only on the first of those rows. Quantum carries
        that header down the following rows — reading the file literally would produce one complete
        shipment and a pile of blanks.
      </div>
    </div>
  );
}
