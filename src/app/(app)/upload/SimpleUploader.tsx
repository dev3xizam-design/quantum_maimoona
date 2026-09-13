"use client";

import { useState } from "react";
import { FileDrop } from "@/components/FileDrop";
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
    }
  }

  return (
    <div className="panel p-5">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      <p className="mt-1 max-w-[70ch] text-[12.5px] text-[var(--muted)]">{blurb}</p>

      <div className="mt-3">
        <div className="field">Columns it looks for</div>
        <code className="block rounded-lg border border-[var(--line)] bg-[#f7faf8] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-[var(--ink-2)]">
          {columns}
        </code>
        <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">
          Column names are matched loosely — <code>wholesale_cost</code>, <code>WholesaleCost</code>{" "}
          and <code>Wholesale Cost</code> all work. Anything it cannot find is simply left empty.
        </p>
      </div>

      {kind !== "products" && (
        <div className="mt-4 max-w-[220px]">
          <label className="field" htmlFor={`${kind}-period`}>
            Period (only if the file has no period column)
          </label>
          <input
            id={`${kind}-period`}
            type="text"
            placeholder="2026-08"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      )}

      <div className="mt-4">
        <FileDrop
          accept=".csv"
          disabled={busy}
          buttonLabel={busy ? "Working…" : "Choose CSV"}
          hint="A .csv file"
          onFiles={(files) => handle(files[0])}
        />
      </div>

      {msg && (
        <div className={`callout mt-4 ${msg.ok ? "callout-ok" : "callout-warn"}`}>{msg.text}</div>
      )}
    </div>
  );
}
