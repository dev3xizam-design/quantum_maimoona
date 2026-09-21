"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  removeStore,
  runAllOrderSyncs,
  runCatalogSync,
  runOrderSync,
  saveStore,
} from "@/app/actions/medusa";
import type { ConnectionView, OrderSyncResult, SyncResult } from "@/lib/medusa/sync";
import { MatchReview, type MatchRow } from "./MatchReview";

function StoreForm({ store, onDone }: { store?: ConnectionView; onDone?: () => void }) {
  const [state, formAction, saving] = useActionState(
    saveStore,
    null as { ok: boolean; message: string } | null,
  );
  const router = useRouter();

  if (state?.ok && onDone) setTimeout(onDone, 400);

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        router.refresh();
      }}
      className="space-y-3 rounded-lg border border-[var(--line)] bg-[#f8fbf9] p-4"
    >
      {store && <input type="hidden" name="id" value={store.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="field">Store name</label>
          <input name="name" type="text" defaultValue={store?.name ?? ""} placeholder="MIA Tyson Vape Deals" required />
        </div>
        <div>
          <label className="field">Medusa backend URL</label>
          <input
            name="baseUrl"
            type="text"
            defaultValue={store?.baseUrl ?? ""}
            placeholder="https://store.medusajs.app  or  https://api.yoursite.com"
            required
          />
        </div>
        <div>
          <label className="field">Secret API key</label>
          <input
            name="secret"
            type="password"
            autoComplete="off"
            placeholder={store?.hasSecret ? `saved — ends ${store.secretLast4}` : "sk_..."}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[12px]">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="syncOrders" defaultChecked={store?.syncOrders ?? true} /> Read
          orders for PACT
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="syncCatalog" defaultChecked={store?.syncCatalog ?? true} /> Read
          catalog for cost / mL
        </label>
        <button className="btn btn-primary btn-sm ml-auto" type="submit" disabled={saving}>
          {saving ? "Testing…" : store ? "Save & re-test" : "Add store & test"}
        </button>
      </div>
      {state && (
        <div className={`callout ${state.ok ? "callout-ok" : "callout-warn"}`}>{state.message}</div>
      )}
    </form>
  );
}

export function StoresPanel({
  connections,
  nameMatches,
  shipmentSummary,
}: {
  connections: ConnectionView[];
  nameMatches: MatchRow[];
  shipmentSummary: { source: string; label: string | null; rows: number; periods: number }[];
}) {
  const [adding, setAdding] = useState(connections.length === 0);
  const [editing, setEditing] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [log, setLog] = useState<string | null>(null);
  const router = useRouter();

  const catalog = (id: number) =>
    start(async () => {
      const res = await runCatalogSync(id);
      setLog(
        res.ok
          ? `${res.result.store}: ${res.result.variants} variants, ${res.result.matched} matched (${res.result.matchedByBarcode} by code, ${res.result.matchedByName} by name, ${res.result.ambiguousNames} too close to call).`
          : `Catalog sync failed: ${res.error}`,
      );
      router.refresh();
    });

  const orders = (id: number) =>
    start(async () => {
      const res = await runOrderSync(id);
      setLog(
        res.ok ? describeOrders(res.result) : `Order sync failed: ${res.error}`,
      );
      router.refresh();
    });

  const allOrders = () =>
    start(async () => {
      const res = await runAllOrderSyncs();
      setLog(
        res.ok
          ? res.results.map(describeOrders).join("  ·  ") || "No store is set to read orders."
          : `Order sync failed: ${res.error}`,
      );
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">Connected stores</h2>
            <p className="mt-1 max-w-[80ch] text-[12.5px] text-[var(--muted)]">
              Every storefront that ships product. Quantum reads each one&rsquo;s{" "}
              <strong>orders</strong> to build the PACT Act feed — customer, address, invoice,
              quantity — and its <strong>catalog</strong> for wholesale cost, mL and open/closed. It
              only ever reads; nothing is written back.
            </p>
          </div>
          <div className="pagehead-actions">
            {connections.length > 0 && (
              <button className="btn" disabled={pending} onClick={allOrders}>
                {pending ? "Working…" : "Sync orders — all stores"}
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
              {adding ? "Cancel" : "Add a store"}
            </button>
          </div>
        </div>

        {adding && (
          <div className="mt-4">
            <StoreForm onDone={() => setAdding(false)} />
          </div>
        )}

        {log && <div className="callout callout-note mt-4">{log}</div>}

        {connections.length > 0 && (
          <div className="mt-4 space-y-3">
            {connections.map((c) => (
              <div key={c.id} className="rounded-lg border border-[var(--line)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{c.name}</span>
                      <span className={`badge ${c.status === "ok" ? "badge-filed" : "badge-overdue"}`}>
                        {c.status === "ok" ? "connected" : "not connected"}
                      </span>
                      {!c.syncOrders && <span className="badge badge-no_activity">orders off</span>}
                      {!c.syncCatalog && <span className="badge badge-no_activity">catalog off</span>}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                      {c.baseUrl.replace(/^https?:\/\//, "")}
                      {c.secretLast4 && ` · key ends ${c.secretLast4}`}
                      {c.ordersSyncedAt && ` · orders ${c.ordersSyncedAt}`}
                      {c.lastSyncedAt && ` · catalog ${c.lastSyncedAt}`}
                    </div>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    <button className="btn btn-sm" disabled={pending || !c.syncOrders} onClick={() => orders(c.id)}>
                      Sync orders
                    </button>
                    <button className="btn btn-sm" disabled={pending || !c.syncCatalog} onClick={() => catalog(c.id)}>
                      Sync catalog
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                      {editing === c.id ? "Close" : "Edit"}
                    </button>
                    <form action={removeStore}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn btn-sm btn-danger" type="submit">Remove</button>
                    </form>
                  </div>
                </div>

                {c.status !== "ok" && c.lastError && (
                  <div className="callout callout-warn mt-3">{c.lastError}</div>
                )}
                {c.orderStats && (
                  <p className="mt-2 text-[11.5px] text-[var(--muted)] tnum">
                    {String((c.orderStats as Record<string, unknown>).ordersRead ?? 0)} orders read ·{" "}
                    {String((c.orderStats as Record<string, unknown>).shipmentRows ?? 0)} shipment
                    lines · {String((c.orderStats as Record<string, unknown>).states ?? 0)} states
                  </p>
                )}
                {editing === c.id && (
                  <div className="mt-3">
                    <StoreForm store={c} onDone={() => setEditing(null)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="help mt-4">
          <strong>Keys are encrypted at rest</strong> with AES-256-GCM, never sent back to the
          browser and never logged — only the last four characters are shown. Use a{" "}
          <strong>Secret API key</strong> from the Medusa admin (Settings → Secret API Keys); a
          Publishable key only reaches the storefront API and cannot see orders.
        </div>
      </section>

      {shipmentSummary.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="panel-head">
            PACT shipment feed
            <Link href="/months" className="ml-auto text-[12px] font-normal text-[var(--accent)]">
              see it on a month →
            </Link>
          </div>
          <div className="overflow-x-auto">
          <table className="qtable">
            <thead>
              <tr>
                <th>Source</th>
                <th>Store</th>
                <th className="num">Shipment lines</th>
                <th className="num">Months covered</th>
              </tr>
            </thead>
            <tbody>
              {shipmentSummary.map((s, i) => (
                <tr key={i}>
                  <td>
                    <span className="badge badge-ready">
                      {s.source === "medusa" ? "Medusa" : s.source === "shopify_csv" ? "Shopify (CSV)" : s.source}
                    </span>
                  </td>
                  <td>{s.label ?? "—"}</td>
                  <td className="num">{s.rows.toLocaleString()}</td>
                  <td className="num">{s.periods}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="help m-4">
            These rows are what PACT reports are built from. Historical Shopify orders go in through{" "}
            <Link className="font-semibold text-[var(--accent)]" href="/upload/shopify">
              Upload → Shopify orders
            </Link>
            ; everything from here on comes straight from Medusa.
          </div>
        </section>
      )}

      {nameMatches.length > 0 && (
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13.5px] font-semibold">Name matches to review ({nameMatches.length})</h3>
            <span className="badge badge-not_started">judgement calls</span>
          </div>
          <p className="mt-1 mb-3 max-w-[80ch] text-[12px] text-[var(--muted)]">
            These had no barcode in common, so they were matched on the product name. A wrong one
            assigns a wrong wholesale cost and quietly changes an excise return — check them.
            Lowest confidence first.
          </p>
          <MatchReview rows={nameMatches} />
        </section>
      )}
    </div>
  );
}

function describeOrders(r: OrderSyncResult): string {
  const skipped = r.skippedNoAddress + r.skippedNonUs + r.skippedCancelled;
  return (
    `${r.store}: ${r.ordersRead} orders → ${r.shipmentRows} shipment lines across ${r.states} states` +
    (r.periods.length ? ` (${r.periods[0]} to ${r.periods[r.periods.length - 1]})` : "") +
    (skipped ? `, ${skipped} skipped` : "") +
    `, ${r.withCustomerName} with a customer name.`
  );
}

export type { SyncResult };
