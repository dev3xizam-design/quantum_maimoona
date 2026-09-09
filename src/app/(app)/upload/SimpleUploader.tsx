"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";

type Kind = "products" | "purchases" | "shipments";

const ALIASES: Record<Kind, Record<string, string[]>> = {
  products: {
    sku: ["sku", "itemcode", "productcode", "code"],
    description: ["description", "itemdescription", "name", "productname"],
    wholesaleCost: ["wholesalecost", "wholesale", "cost", "unitcost"],
    retailPrice: ["retailprice", "retail", "price", "msrp"],
    liquidMl: ["liquidml", "ml", "mlperunit", "milliliters", "volumeml"],
    cartridgesPerUnit: ["cartridgesperunit", "cartridges", "podsperunit", "units"],
    systemType: ["systemtype", "system", "openclosed", "type"],
    containsNicotine: ["containsnicotine", "nicotine"],
  },
  purchases: {
    period: ["period", "month", "yearmonth"],
    state: ["state", "stateprovince"],
    sku: ["sku", "itemcode", "productcode"],
    description: ["description", "itemdescription", "name"],
    quantity: ["quantity", "qty", "unitsreceived"],
    mlTotal: ["mltotal", "ml", "totalml", "milliliters"],
    unitsTotal: ["unitstotal", "units", "cartridges"],
    wholesaleCost: ["wholesalecost", "cost", "totalcost", "extendedcost"],
  },
  shipments: {
    period: ["period", "month"],
    state: ["state", "shiptostate", "stateprovince"],
    customerName: ["customername", "customer", "name", "billtoname"],
    shipToAddress: ["shiptoaddress", "address", "address1", "shipaddress"],
    shipToCity: ["shiptocity", "city"],
    shipToState: ["shiptostate", "state"],
    shipToZip: ["shiptozip", "zip", "postalcode", "zipcode"],
    invoiceDate: ["invoicedate", "date", "documentdate"],
    invoiceNumber: ["invoicenumber", "invoice", "documentid", "ordernumber"],
    product: ["product", "itemdescription", "description"],
    brand: ["brand"],
    quantity: ["quantity", "qty"],
    mlTotal: ["mltotal", "ml", "totalml"],
  },
};

const NUMERIC = new Set([
  "wholesaleCost",
  "retailPrice",
  "liquidMl",
  "cartridgesPerUnit",
  "quantity",
  "mlTotal",
  "unitsTotal",
]);

const canon = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function SimpleUploader({
  kind,
  title,
  blurb,
  columns,
}: {
  kind: Kind;
  title: string;
  blurb: string;
  columns: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [period, setPeriod] = useState("");

  async function handle(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const headers = parsed.meta.fields ?? [];
      const byCanon = new Map(headers.map((h) => [canon(h), h]));

      const map: Record<string, string> = {};
      for (const [field, aliases] of Object.entries(ALIASES[kind])) {
        for (const a of aliases) {
          const hit = byCanon.get(a);
          if (hit) {
            map[field] = hit;
            break;
          }
        }
      }
      if (kind === "products" && !map.sku) throw new Error("No SKU / item-code column found.");
      if (kind !== "products" && !map.period && !period) {
        throw new Error("No period column found - set the period above, or add a `period` column.");
      }

      const rows = parsed.data
        .map((raw) => {
          const out: Record<string, unknown> = {};
          for (const [field, header] of Object.entries(map)) {
            const v = raw[header];
            if (v === undefined || v === "") continue;
            out[field] = NUMERIC.has(field) ? Number(String(v).replace(/[$,\s]/g, "")) || 0 : String(v).trim();
          }
          if (!out.period && period) out.period = period;
          if (kind === "products" && out.systemType) {
            out.systemType = String(out.systemType).toUpperCase().includes("CLOS") ? "CLOSED" : "OPEN";
          }
          return out;
        })
        .filter((r) => Object.keys(r).length > 0);

      const res = await fetch("/api/ingest/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, filename: file.name, rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setMsg({ ok: true, text: `Loaded ${json.count.toLocaleString()} row(s).` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="panel p-4">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <p className="mt-1 text-[12px] text-[var(--muted)]">{blurb}</p>
      <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{columns}</p>

      {kind !== "products" && (
        <div className="mt-3 max-w-[200px]">
          <label className="field" htmlFor={`${kind}-period`}>Period (if not a column)</label>
          <input
            id={`${kind}-period`}
            type="text"
            placeholder="2026-07"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      )}

      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
          className="text-[13px]"
        />
      </div>

      {msg && (
        <div className={`callout mt-3 ${msg.ok ? "callout-ok" : "callout-warn"}`}>{msg.text}</div>
      )}
    </section>
  );
}
