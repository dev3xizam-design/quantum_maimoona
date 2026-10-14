"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  removeStore,
  runCatalogSync,
  runOrderSync,
  saveStore,
} from "@/app/actions/medusa";
import type { ConnectionView, OrderSyncResult, SyncResult } from "@/lib/medusa/sync";
import { MatchReview, type MatchRow } from "./MatchReview";
import { ConnectGrid } from "./ConnectGrid";
import {
  approveStore,
  rotatePushKey,
  setStoreActive,
  syncEveryStore,
  syncStore,
  testStore,
} from "@/app/actions/connectors";
import { platform, providerLabel } from "@/lib/connectors/catalog";

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

export type StoreConnection = ConnectionView & { active: boolean };

export function StoresPanel({
  connections,
  nameMatches,
  shipmentSummary,
  ready,
  connectedId,
  connectError,
  errorProvider,
}: {
  connections: StoreConnection[];
  nameMatches: MatchRow[];
  shipmentSummary: { source: string; label: string | null; rows: number; periods: number }[];
  ready: Record<string, boolean>;
  connectedId: number | null;
  connectError: string | null;
  errorProvider: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [freshKey, setFreshKey] = useState<{ id: number; key: string } | null>(null);
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
      const res = await syncEveryStore();
      setLog(res.message);
      router.refresh();
    });

  const pull = (id: number, full = false) =>
    start(async () => {
      const res = await syncStore(id, full);
      setLog(res.ok ? res.message : `Order sync failed: ${res.message}`);
      router.refresh();
    });

  const test = (id: number) =>
    start(async () => {
      const res = await testStore(id);
      setLog(res.message);
      router.refresh();
    });

  const rotate = (id: number) =>
    start(async () => {
      if (!confirm("Issue a new key? The plugin or integration using the old key stops syncing until it gets the new one.")) return;
      const res = await rotatePushKey(id);
      if (res.key) setFreshKey({ id, key: res.key });
      setLog(res.message);
      router.refresh();
    });

  const other = connections.filter((c) => c.provider !== "medusa");
  const medusa = connections.filter((c) => c.provider === "medusa");

  return (
    <div className="space-y-4">
      {connectError && (
        <div className="callout callout-warn">
          <strong>{errorProvider ? `${providerLabel(errorProvider)}: ` : ""}not connected.</strong> {connectError}
        </div>
      )}
      {connectedId && (
        <div className="callout callout-ok">
          <strong>{connections.find((c) => c.id === connectedId)?.name ?? "Store"} is connected.</strong>{" "}
          {String((connections.find((c) => c.id === connectedId)?.orderStats as Record<string, unknown> | null)?.ordersRead ?? "Its")}{" "}
          orders read on the first sync — they are in the PACT feed below.
        </div>
      )}

      <ConnectGrid ready={ready} onMedusa={() => setAdding(true)} initial={errorProvider} />

      {other.length > 0 && (
        <section className="panel p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <h2 className="text-[14px] font-semibold">Connected stores ({other.length})</h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                Pull stores re-read the last 14 days on every sync (to catch cancellations); a full resync
                re-reads everything. Plugin stores push each order as it happens.
              </p>
            </div>
            <div className="pagehead-actions">
              <button className="btn" disabled={pending} onClick={allOrders}>
                {pending ? "Working…" : "Sync orders — all stores"}
              </button>
            </div>
          </div>
          {log && <div className="callout callout-note mt-4">{log}</div>}
          <div className="mt-4 space-y-3">
            {other.map((c) => {
              const p = platform(c.provider);
              const stats = c.orderStats as Record<string, unknown> | null;
              const pendingApproval = c.status === "pending";
              return (
                <div
                  key={c.id}
                  className="rounded-lg border p-4"
                  style={{ borderColor: c.id === connectedId ? "var(--green)" : "var(--line)" }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="tile-icon shrink-0 font-bold text-white"
                      style={{ background: p?.color ?? "#555", fontSize: (p?.monogram.length ?? 0) > 2 ? 10 : 13 }}
                    >
                      {p?.monogram ?? "?"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold">{c.name}</span>
                        <span className="badge badge-ready">
                          {c.provider === "push"
                            ? "plugin / API"
                            : providerLabel(c.provider)}
                        </span>
                        <span
                          className={`badge ${
                            pendingApproval ? "badge-not_started" : !c.active ? "badge-no_activity" : c.status === "ok" ? "badge-filed" : c.status === "unconfigured" ? "badge-not_started" : "badge-overdue"
                          }`}
                        >
                          {pendingApproval ? "awaiting approval" : !c.active ? "paused" : c.status === "ok" ? "connected" : c.status === "unconfigured" ? "waiting for first contact" : "error"}
                        </span>
                      </div>
                      <div className="mt-0.5 break-all text-[11.5px] text-[var(--muted)]">
                        {c.baseUrl.replace(/^[a-z-]+:\/\//, "")}
                        {c.secretLast4 && ` · key ends ${c.secretLast4}`}
                        {c.pushKeyLast4 && ` · connection key ends ${c.pushKeyLast4}`}
                        {c.ordersSyncedAt && ` · orders ${c.ordersSyncedAt}`}
                        {c.lastPushAt && ` · last push ${c.lastPushAt}`}
                      </div>
                    </div>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      {pendingApproval ? (
                        <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => start(async () => { await approveStore(c.id); router.refresh(); })}>
                          Approve
                        </button>
                      ) : c.provider === "push" ? (
                        <button className="btn btn-sm" disabled={pending} onClick={() => rotate(c.id)}>
                          New key
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-sm" disabled={pending || !c.active} onClick={() => pull(c.id)}>
                            Sync orders
                          </button>
                          <button className="btn btn-sm btn-ghost" disabled={pending || !c.active} onClick={() => pull(c.id, true)}>
                            Full resync
                          </button>
                          <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => test(c.id)}>
                            Test
                          </button>
                        </>
                      )}
                      {!pendingApproval && (
                        <button
                          className="btn btn-sm btn-ghost"
                          disabled={pending}
                          onClick={() => start(async () => { await setStoreActive(c.id, !c.active); router.refresh(); })}
                        >
                          {c.active ? "Pause" : "Resume"}
                        </button>
                      )}
                      <form action={removeStore} onSubmit={(e) => { if (!confirm(`Remove ${c.name}? Orders already synced stay in the PACT feed.`)) e.preventDefault(); }}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn btn-sm btn-danger" type="submit">Remove</button>
                      </form>
                    </div>
                  </div>
                  {c.status === "error" && c.lastError && <div className="callout callout-warn mt-3">{c.lastError}</div>}
                  {stats && (
                    <p className="mt-2 text-[11.5px] text-[var(--muted)] tnum">
                      {Number(stats.ordersRead ?? 0).toLocaleString()} orders read ·{" "}
                      {Number(stats.shipmentRows ?? 0).toLocaleString()} shipment lines · {String(stats.states ?? 0)} states
                      {Number(stats.skippedCancelled ?? 0) > 0 && ` · ${String(stats.skippedCancelled)} cancelled`}
                      {Number(stats.skippedNotShipped ?? 0) > 0 && ` · ${String(stats.skippedNotShipped)} not shipped yet`}
                      {Number(stats.skippedNonUs ?? 0) > 0 && ` · ${String(stats.skippedNonUs)} non-US`}
                      {Number(stats.skippedNoAddress ?? 0) > 0 && ` · ${String(stats.skippedNoAddress)} with no US ship-to`}
                      {stats.window ? ` · ${String(stats.window)}` : ""}
                    </p>
                  )}
                  {freshKey?.id === c.id && (
                    <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-[12px]">
                      New connection key — copy it now, it is not shown again:
                      <code className="mt-1 block break-all">{freshKey.key}</code>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">Medusa stores</h2>
            <p className="mt-1 max-w-[80ch] text-[12.5px] text-[var(--muted)]">
              Every storefront that ships product. Quantum reads each one&rsquo;s{" "}
              <strong>orders</strong> to build the PACT Act feed — customer, address, invoice,
              quantity — and its <strong>catalog</strong> for wholesale cost, mL and open/closed. It
              only ever reads; nothing is written back.
            </p>
          </div>
          <div className="pagehead-actions">
            <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
              {adding ? "Cancel" : "Add a Medusa store"}
            </button>
          </div>
        </div>

        {adding && (
          <div className="mt-4">
            <StoreForm onDone={() => setAdding(false)} />
          </div>
        )}

        {log && other.length === 0 && <div className="callout callout-note mt-4">{log}</div>}

        {medusa.length > 0 && (
          <div className="mt-4 space-y-3">
            {medusa.map((c) => (
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
                      {c.pushKeyLast4 ? ` · real-time tax key ends ${c.pushKeyLast4}` : " · real-time tax off"}
                    </div>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    <button className="btn btn-sm" disabled={pending} onClick={() => rotate(c.id)}>
                      {c.pushKeyLast4 ? "New tax key" : "Real-time tax key"}
                    </button>
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
                {freshKey?.id === c.id && (
                  <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-[12px]">
                    <strong>Real-time tax key — copy it now, Quantum will not show it again.</strong>
                    <code className="mt-1 block break-all">{freshKey.key}</code>
                    <p className="mt-2 text-[var(--muted)]">
                      Set it on the Medusa backend as <code>QUANTUM_API_KEY</code>, with{" "}
                      <code>QUANTUM_API_URL</code> = this site&apos;s address. Checkout then calls{" "}
                      <code>/api/tax/v1/calculate</code>, and shipped orders commit themselves.
                    </p>
                  </div>
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
                    <span className="badge badge-ready">{s.source === "push" ? "Plugin / API" : providerLabel(s.source)}</span>
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
            ; everything from here on comes straight from the connected stores.
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
  const skipped = r.skippedNoAddress + r.skippedNonUs + r.skippedCancelled + (r.skippedNotShipped ?? 0);
  return (
    `${r.store}: ${r.ordersRead} orders → ${r.shipmentRows} shipment lines across ${r.states} states` +
    (r.periods.length ? ` (${r.periods[0]} to ${r.periods[r.periods.length - 1]})` : "") +
    (skipped ? `, ${skipped} skipped` : "") +
    `, ${r.withCustomerName} with a customer name.`
  );
}

export type { SyncResult };
