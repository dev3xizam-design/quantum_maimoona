"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  removeMedusaConnection,
  runMedusaSync,
  saveMedusaConnection,
} from "@/app/actions/medusa";
import type { SyncResult } from "@/lib/medusa/sync";

type Connection = {
  baseUrl: string;
  secretLast4: string | null;
  hasSecret: boolean;
  authScheme: string | null;
  status: string;
  lastError: string | null;
  lastTestedAt: string | null;
  lastSyncedAt: string | null;
  stats: Record<string, unknown> | null;
} | null;

export function MedusaPanel({
  connection,
  counts,
  unmatchedSamples,
}: {
  connection: Connection;
  counts: { variants: number; matched: number; withCost: number; withMl: number };
  unmatchedSamples: { sku: string | null; barcode: string | null; title: string | null }[];
}) {
  const [state, formAction, saving] = useActionState(
    saveMedusaConnection,
    null as { ok: boolean; message: string } | null,
  );
  const [syncing, startSync] = useTransition();
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const router = useRouter();

  const connected = connection?.status === "ok" && connection.hasSecret;

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">Medusa connection</h2>
            <p className="mt-1 max-w-[76ch] text-[12.5px] text-[var(--muted)]">
              Quantum reads your Medusa catalog to learn things a sales-tax export cannot carry:
              the barcode each internal SKU maps to, wholesale cost, mL per unit and whether a
              device is open or closed. It only ever <strong>reads</strong> — nothing is written
              back to Medusa.
            </p>
          </div>
          {connection && (
            <span className={`badge ${connected ? "badge-filed" : "badge-overdue"}`}>
              {connected ? "connected" : "not connected"}
            </span>
          )}
        </div>

        <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="field" htmlFor="baseUrl">Medusa backend URL</label>
            <input
              id="baseUrl"
              name="baseUrl"
              type="text"
              defaultValue={connection?.baseUrl ?? ""}
              placeholder="https://mia-tyson-vape-deals.medusajs.app"
              required
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              The backend, not the storefront. Pasting the <code>/app</code> dashboard URL is fine —
              it is trimmed for you.
            </p>
          </div>
          <div>
            <label className="field" htmlFor="secret">Secret API key</label>
            <input
              id="secret"
              name="secret"
              type="password"
              autoComplete="off"
              placeholder={
                connection?.hasSecret ? `saved — ends ${connection.secretLast4}` : "sk_..."
              }
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Medusa admin → Settings → <strong>Secret API Keys</strong>. A Publishable key will not
              work; it only reaches the storefront API.
            </p>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Testing…" : connection?.hasSecret ? "Save & re-test" : "Save & test connection"}
            </button>
            {connection && (
              <button
                className="btn btn-sm btn-danger"
                type="button"
                onClick={() => startSync(async () => { await removeMedusaConnection(); router.refresh(); })}
              >
                Remove connection
              </button>
            )}
            {connection?.lastTestedAt && (
              <span className="text-[11.5px] text-[var(--muted)]">
                last tested {connection.lastTestedAt}
                {connection.authScheme ? ` · ${connection.authScheme}` : ""}
              </span>
            )}
          </div>
        </form>

        {state && (
          <div className={`callout mt-4 ${state.ok ? "callout-ok" : "callout-warn"}`}>
            {state.message}
          </div>
        )}
        {!state && connection?.status === "error" && connection.lastError && (
          <div className="callout callout-warn mt-4">{connection.lastError}</div>
        )}

        <div className="help mt-4">
          <strong>Where the key is kept.</strong> Encrypted at rest with AES-256-GCM, never sent
          back to the browser, never logged — only the last four characters are shown. This is an
          integration key the app needs to function, which is a different thing from a state-portal
          password: those must never be stored here at all.
        </div>
      </section>

      {connected && (
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-[14px] font-semibold">Catalog sync</h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                Pulls every product and variant, then matches them to the item codes Avalara
                reports — barcode first, then UPC, EAN, and finally the Medusa SKU.
              </p>
            </div>
            <button
              className="btn btn-primary ml-auto"
              disabled={syncing}
              onClick={() =>
                startSync(async () => {
                  setSyncError(null);
                  setSync(null);
                  const res = await runMedusaSync();
                  if (res.ok) setSync(res.result);
                  else setSyncError(res.error);
                  router.refresh();
                })
              }
            >
              {syncing ? "Syncing…" : "Sync catalog now"}
            </button>
          </div>

          {connection?.lastSyncedAt && (
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              last synced {connection.lastSyncedAt}
            </p>
          )}

          {syncError && <div className="callout callout-warn mt-4">{syncError}</div>}

          {(sync || counts.variants > 0) && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Variants in Medusa", value: (sync?.variants ?? counts.variants).toLocaleString() },
                {
                  label: "Matched to sold SKUs",
                  value: (sync?.matched ?? counts.matched).toLocaleString(),
                  tone: (sync?.matched ?? counts.matched) === 0 ? "warn" : "ok",
                },
                { label: "With wholesale cost", value: (sync?.withCost ?? counts.withCost).toLocaleString() },
                { label: "With mL", value: (sync?.withMl ?? counts.withMl).toLocaleString() },
              ].map((t) => (
                <div key={t.label} className="stat">
                  <div className="stat-label">{t.label}</div>
                  <div
                    className={`stat-value ${
                      t.tone === "warn" ? "text-[var(--danger)]" : t.tone === "ok" ? "text-[var(--ok)]" : ""
                    }`}
                  >
                    {t.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sync && (
            <div className={`callout mt-4 ${sync.matched > 0 ? "callout-ok" : "callout-warn"}`}>
              {sync.matched > 0 ? (
                <>
                  Matched <strong>{sync.matched.toLocaleString()}</strong> variant(s) —{" "}
                  {sync.matchedByBarcode.toLocaleString()} by barcode/UPC/EAN and{" "}
                  {sync.matchedBySku.toLocaleString()} by SKU. Cost, mL and open/closed from those
                  variants now feed the excise engines.{" "}
                  {sync.unmatchedSoldSkus.length > 0 && (
                    <>
                      Still unmatched among SKUs that actually sold:{" "}
                      <span className="font-mono">{sync.unmatchedSoldSkus.slice(0, 6).join(", ")}</span>.
                    </>
                  )}
                </>
              ) : (
                <>
                  <strong>Nothing matched.</strong> None of the {sync.variants.toLocaleString()}{" "}
                  Medusa variants carry a barcode, UPC, EAN or SKU that appears in your Avalara
                  data. Either this Medusa store sells a different catalog, or the barcode field is
                  empty on its variants.
                </>
              )}
            </div>
          )}

          {unmatchedSamples.length > 0 && (
            <div className="mt-4">
              <div className="field mb-1.5">Sample of variants that did not match</div>
              <table className="qtable">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Medusa SKU</th>
                    <th>Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedSamples.map((r, i) => (
                    <tr key={i}>
                      <td className="max-w-[380px] truncate">{r.title ?? "—"}</td>
                      <td className="font-mono text-[11.5px]">{r.sku ?? "—"}</td>
                      <td className="font-mono text-[11.5px]">{r.barcode ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11.5px] text-[var(--muted)]">
                A blank barcode column is the usual reason. Fill in <code>barcode</code> on the
                Medusa variant with the code Avalara reports and sync again.
              </p>
            </div>
          )}

          <div className="help mt-4">
            Medusa never overrides something you set by hand. The order of authority for cost is:
            what you typed, then a purchase import, then Medusa. See{" "}
            <Link className="font-semibold text-[var(--accent)]" href="/products">Products</Link> for
            what each value came from.
          </div>
        </section>
      )}
    </div>
  );
}
