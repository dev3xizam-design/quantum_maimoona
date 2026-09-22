"use client";

import { useMemo, useState } from "react";
import { deletePortal, savePortal } from "@/app/actions/portals";
import { stateName } from "@/lib/states";

export type PortalRow = {
  id: number;
  state: string;
  label: string;
  purpose: string | null;
  portalUrl: string | null;
  loginId: string | null;
  licenseNumber: string | null;
  frequency: string | null;
  status: string;
  notes: string | null;
};

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Ready to file" },
  { key: "blocked", label: "Blocked" },
  { key: "needs_license", label: "Needs licence" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  blocked: "Blocked",
  needs_license: "Needs licence",
  no_login: "No login yet",
};

/**
 * Clipboard writes need a user gesture and a secure context. Every call here
 * comes from a click, and the textarea path covers the rare browser that has
 * no async clipboard at all.
 */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyChip({
  label,
  value,
  onCopied,
  wide,
}: {
  label: string;
  value: string;
  onCopied: (what: string) => void;
  wide?: boolean;
}) {
  const [hit, setHit] = useState(false);
  return (
    <button
      type="button"
      className="copychip"
      data-hit={hit}
      data-wide={wide ? "true" : undefined}
      title={`Copy ${label} — ${value}`}
      onClick={async () => {
        if (!(await copy(value))) return;
        setHit(true);
        onCopied(label);
        setTimeout(() => setHit(false), 900);
      }}
    >
      <span className="copychip-label">{label}</span>
      <span className="copychip-value">{value}</span>
      <span className="copychip-icon" aria-hidden>
        {hit ? (
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </span>
    </button>
  );
}

function Fields({ r }: { r?: PortalRow }) {
  return (
    <div className="formgrid">
      <div>
        <label className="field">State</label>
        <input name="state" defaultValue={r?.state ?? ""} maxLength={2} placeholder="AZ" />
      </div>
      <div>
        <label className="field">Frequency</label>
        <input name="frequency" defaultValue={r?.frequency ?? ""} placeholder="M" />
      </div>
      <div>
        <label className="field">Status</label>
        <select name="status" defaultValue={r?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
          <option value="needs_license">Needs licence</option>
          <option value="no_login">No login yet</option>
        </select>
      </div>
      <div className="col-span-full">
        <label className="field">Account name</label>
        <input name="label" defaultValue={r?.label ?? ""} required placeholder="Kentucky - file-only SER" />
      </div>
      <div className="col-span-full">
        <label className="field">Portal link</label>
        <input name="portalUrl" defaultValue={r?.portalUrl ?? ""} placeholder="https://mytax.illinois.gov/_/" />
      </div>
      <div>
        <label className="field">Login ID</label>
        <input name="loginId" defaultValue={r?.loginId ?? ""} placeholder="username or customer ID" />
      </div>
      <div>
        <label className="field">Licence number</label>
        <input name="licenseNumber" defaultValue={r?.licenseNumber ?? ""} />
      </div>
      <div className="col-span-full">
        <label className="field">What gets filed here</label>
        <input name="purpose" defaultValue={r?.purpose ?? ""} placeholder="Sales & Use Tax / PACT Act" />
      </div>
      <div className="col-span-full">
        <label className="field">Notes</label>
        <input name="notes" defaultValue={r?.notes ?? ""} />
      </div>
    </div>
  );
}

export function PortalsView({ rows, fein }: { rows: PortalRow[]; fein: string }) {
  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function flash(what: string) {
    setToast(`${what} copied`);
    setTimeout(() => setToast(null), 1500);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, active: 0, blocked: 0, needs_license: 0 };
    for (const r of rows) if (r.status in c) c[r.status] += 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (!needle) return true;
      return [r.state, stateName(r.state), r.label, r.loginId, r.licenseNumber, r.purpose, r.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, tab, q]);

  const withLinks = shown.filter((r) => r.portalUrl);

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Portals</h1>
            <p className="page-sub mt-0.5">
              Every state login in one place. Click any chip to copy it, then open the portal and
              paste. {rows.length} accounts, {rows.filter((r) => r.portalUrl).length} with a link.
            </p>
          </div>
          <div className="pagehead-actions">
            <button
              type="button"
              className="btn"
              disabled={!withLinks.length}
              onClick={async () => {
                const text = withLinks.map((r) => `${r.label} — ${r.portalUrl}`).join("\n");
                if (await copy(text)) flash(`${withLinks.length} links`);
              }}
            >
              Copy all links
            </button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                if (await copy(fein)) flash("FEIN");
              }}
            >
              Copy FEIN
            </button>
          </div>
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="tab"
              data-active={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="tab-count" data-tone={t.key === "blocked" ? "warn" : undefined}>
                {counts[t.key] ?? 0}
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="callout callout-note">
        Passwords, PINs and security answers are <strong>not</strong> stored here, on purpose — keep
        those in your password manager. This page holds only what is safe to keep: the link, the
        login ID, and the licence or account number.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a state, account, login or licence number…"
          className="max-w-[420px] flex-1"
        />
        <span className="text-[12px] text-[var(--muted)]">
          {shown.length} of {rows.length}
        </span>
      </div>

      <div className="portalgrid">
        {shown.map((r, i) => (
          <article
            key={r.id}
            className="portalcard anim-up"
            style={{ "--d": `${Math.min(i, 14) * 35}ms` } as React.CSSProperties}
            data-status={r.status}
          >
            <header className="portalcard-head">
              <span className="badge badge-ready">{r.state}</span>
              <span className="min-w-0">
                <span className="portalcard-title">{r.label}</span>
                <span className="portalcard-sub">
                  {r.purpose ?? stateName(r.state)}
                  {r.frequency ? ` · ${r.frequency}` : ""}
                </span>
              </span>
              {r.status !== "active" && (
                <span className={`badge ml-auto ${r.status === "blocked" ? "badge-overdue" : "badge-not_started"}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              )}
            </header>

            <div className="portalcard-chips">
              {r.loginId && <CopyChip label="Login ID" value={r.loginId} onCopied={flash} wide />}
              {r.licenseNumber && <CopyChip label="Licence" value={r.licenseNumber} onCopied={flash} wide />}
              <CopyChip label="FEIN" value={fein} onCopied={flash} />
            </div>

            {r.notes && <p className="portalcard-note">{r.notes}</p>}

            <footer className="portalcard-foot">
              {r.portalUrl ? (
                <>
                  <a
                    className="btn btn-primary btn-sm"
                    href={r.portalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open portal ↗
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={async () => {
                      if (await copy(r.portalUrl!)) flash("Link");
                    }}
                  >
                    Copy link
                  </button>
                </>
              ) : (
                <span className="text-[11.5px] text-[var(--muted)]">No portal link on file</span>
              )}
              <details className="ml-auto">
                <summary className="btn btn-sm btn-ghost cursor-pointer list-none">Edit</summary>
                <div className="portalcard-edit">
                  <form action={savePortal} className="space-y-3">
                    <input type="hidden" name="id" value={r.id} />
                    <Fields r={r} />
                    <button className="btn btn-primary btn-sm" type="submit">Save</button>
                  </form>
                  <form action={deletePortal} className="mt-2">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-sm btn-danger" type="submit">Remove</button>
                  </form>
                </div>
              </details>
            </footer>
          </article>
        ))}
      </div>

      {!shown.length && (
        <div className="panel p-8 text-center text-[13px] text-[var(--muted)]">
          Nothing matches {q ? `“${q}”` : "this tab"}.
        </div>
      )}

      <details className="panel p-4">
        <summary className="cursor-pointer text-[13px] font-semibold">Add a portal</summary>
        <form action={savePortal} className="mt-3 space-y-3">
          <Fields />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
      </details>

      <div className="copytoast" data-show={toast !== null} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
