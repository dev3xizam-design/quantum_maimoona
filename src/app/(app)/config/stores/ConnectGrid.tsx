"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { connectWithKeys, createApiConnection } from "@/app/actions/connectors";
import { PLATFORMS, type Field, type Platform } from "@/lib/connectors/catalog";

/**
 * "Connect a store": one tile per platform. Where the platform supports it the
 * tile is literally one button (plus the store address) that goes to the
 * platform's own approve screen; otherwise it opens the key form for it.
 */

function Monogram({ p, size = 34 }: { p: Platform; size?: number }) {
  return (
    <span
      className="tile-icon shrink-0 font-bold text-white"
      style={{ background: p.color, width: size, height: size, fontSize: p.monogram.length > 2 ? 10 : 13 }}
    >
      {p.monogram}
    </span>
  );
}

function Input({ f }: { f: Field }) {
  return (
    <div>
      <label className="field">
        {f.label}
        {f.optional && <span className="font-normal text-[var(--muted)]"> (optional)</span>}
      </label>
      <input
        name={f.name}
        type={f.secret ? "password" : "text"}
        autoComplete="off"
        placeholder={f.placeholder}
        required={!f.optional}
      />
      {f.help && <div className="mt-1 text-[11px] text-[var(--muted)]">{f.help}</div>}
    </div>
  );
}

function OneClick({ p }: { p: Platform }) {
  // A plain GET form: the browser navigates to the start route, which redirects onward.
  return (
    <form method="GET" action={`/api/connect/${p.id}/start`} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {p.addressField && <Input f={p.addressField} />}
        <div>
          <label className="field">
            Name in Quantum <span className="font-normal text-[var(--muted)]">(optional)</span>
          </label>
          <input name="name" type="text" placeholder="Suorin USA" />
        </div>
      </div>
      <button className="btn btn-primary" type="submit">
        Connect {p.name}
      </button>
      <p className="text-[11.5px] text-[var(--muted)]">
        You&rsquo;ll approve read-only access on {p.name}&rsquo;s own screen, then land back here with the
        store connected and its orders syncing.
      </p>
    </form>
  );
}

function KeyForm({ p }: { p: Platform }) {
  const [state, action, pending] = useActionState(connectWithKeys, null as { ok: boolean; message: string } | null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="provider" value={p.id} />
      <div className="help">{p.manualHelp}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {p.manualFields.map((f) => (
          <Input key={f.name} f={f} />
        ))}
        <div>
          <label className="field">
            Name in Quantum <span className="font-normal text-[var(--muted)]">(optional)</span>
          </label>
          <input name="name" type="text" />
        </div>
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Connecting & reading orders…" : `Connect ${p.name}`}
      </button>
      {state && <div className={`callout ${state.ok ? "callout-ok" : "callout-warn"}`}>{state.message}</div>}
    </form>
  );
}

function ApiForm() {
  const [state, action, pending] = useActionState(
    createApiConnection,
    null as { ok: boolean; message: string; key?: string } | null,
  );
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[var(--ink-2)]">
        For any platform without a built-in connector — a custom site, a POS, a marketplace, a
        headless build. Install a{" "}
        <Link className="font-semibold text-[var(--accent)]" href="/marketplace">
          Quantum plugin
        </Link>{" "}
        (it connects itself with one button), or create a key here and post orders to the{" "}
        <Link className="font-semibold text-[var(--accent)]" href="/marketplace/connect-api">
          Connect API
        </Link>
        .
      </p>
      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field">Store name</label>
          <input name="name" type="text" required placeholder="Retail POS" />
        </div>
        <div>
          <label className="field">
            Website <span className="font-normal text-[var(--muted)]">(optional)</span>
          </label>
          <input name="site" type="text" placeholder="https://…" />
        </div>
        <div>
          <label className="field">Platform</label>
          <input name="platform" type="text" placeholder="custom, Square, Etsy…" />
        </div>
        <div className="sm:col-span-3">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create connection key"}
          </button>
        </div>
      </form>
      {state && <div className={`callout ${state.ok ? "callout-ok" : "callout-warn"}`}>{state.message}</div>}
      {state?.key && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
          <code className="break-all text-[12px]">{state.key}</code>
          <button
            type="button"
            className="btn btn-sm ml-auto"
            onClick={() => {
              navigator.clipboard?.writeText(state.key!).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy key"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConnectGrid({
  ready,
  onMedusa,
  initial,
}: {
  ready: Record<string, boolean>;
  onMedusa: () => void;
  initial?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(initial ?? null);
  const [useKeys, setUseKeys] = useState(false);
  const p = PLATFORMS.find((x) => x.id === open);

  const choose = (id: string) => {
    if (id === "medusa") {
      setOpen(null);
      onMedusa();
      return;
    }
    setUseKeys(false);
    setOpen(open === id ? null : id);
  };

  const oneClick = p && ready[p.id] && p.oneClick !== "never" && p.id !== "push";

  return (
    <section className="panel p-5">
      <h2 className="text-[14px] font-semibold">Connect a store</h2>
      <p className="mt-1 mb-4 max-w-[80ch] text-[12.5px] text-[var(--muted)]">
        Pick the platform. Quantum only ever <strong>reads</strong> orders — customer, ship-to,
        products, quantities — to build the PACT feed. Nothing is written back to the store.
      </p>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
        {PLATFORMS.map((x) => {
          const isReady = ready[x.id] && x.oneClick !== "never";
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => choose(x.id)}
              className="tile text-left"
              style={open === x.id ? { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" } : undefined}
            >
              <div className="flex items-center gap-2.5">
                <Monogram p={x} />
                <span className="tile-title leading-tight">{x.name}</span>
              </div>
              <span className="tile-sub">{x.tagline}</span>
              <span className={`badge ${isReady ? "badge-filed" : "badge-not_started"} self-start`}>
                {x.id === "push" ? "plugin or API" : isReady ? "one click" : "API key"}
              </span>
            </button>
          );
        })}
      </div>

      {p && (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[#fafbff] p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <Monogram p={p} size={28} />
            <span className="text-[13.5px] font-semibold">{p.name}</span>
            {oneClick && (
              <button type="button" className="ml-auto text-[12px] font-semibold text-[var(--accent)]" onClick={() => setUseKeys((v) => !v)}>
                {useKeys ? "← one-click connect" : "use API keys instead"}
              </button>
            )}
          </div>

          {p.id === "push" ? (
            <ApiForm />
          ) : oneClick && !useKeys ? (
            <OneClick p={p} />
          ) : (
            <>
              {p.oneClick === "oauth" && !ready[p.id] && (
                <div className="callout callout-note mb-3">
                  One-click {p.name} switches on once Quantum&rsquo;s {p.name} app is registered and{" "}
                  <code>{p.oauthEnv?.join(", ")}</code> are set. Until then, connect with a key below —
                  it syncs exactly the same orders.
                </div>
              )}
              <KeyForm p={p} />
            </>
          )}

          {p.pluginSlug && p.id !== "push" && (
            <p className="mt-3 text-[11.5px] text-[var(--muted)]">
              Want orders the moment they are placed?{" "}
              <Link className="font-semibold text-[var(--accent)]" href={`/marketplace/${p.pluginSlug}`}>
                See the Quantum {p.name} plugin →
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
