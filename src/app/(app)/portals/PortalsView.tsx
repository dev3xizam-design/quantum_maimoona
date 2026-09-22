"use client";

import { useMemo, useState } from "react";
import { deletePortal, revealSecrets, savePortal } from "@/app/actions/portals";
import type { PortalSecrets } from "@/lib/portal-secrets";
import { stateName } from "@/lib/states";

export type SecretShape = {
  password: boolean;
  pin: boolean;
  securityAnswers: boolean;
  codes: boolean;
};

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
  /** What is stored, not what it is. Values arrive only on Reveal. */
  secrets: SecretShape;
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

/** Masked until asked for, and it re-masks itself so it cannot be left open. */
function SecretChip({
  label,
  value,
  onCopied,
  multiline,
}: {
  label: string;
  value: string;
  onCopied: (what: string) => void;
  multiline?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const [hit, setHit] = useState(false);
  if (!value) return null;

  return (
    <div className="secretrow">
      <span className="copychip-label">{label}</span>
      <span className="secretvalue" data-shown={shown} data-multiline={multiline ? "true" : undefined}>
        {shown ? value : "••••••••••"}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-ghost secretbtn"
        onClick={() => setShown((v) => !v)}
      >
        {shown ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        className="btn btn-sm secretbtn"
        data-hit={hit}
        onClick={async () => {
          if (!(await copy(value))) return;
          setHit(true);
          onCopied(label);
          setTimeout(() => setHit(false), 900);
        }}
      >
        {hit ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * Nothing secret is in the page until this is clicked. The click calls the
 * server, which decrypts that one account and returns it to this component
 * alone, and Lock throws it away again.
 */
function SecretPanel({
  row,
  onCopied,
}: {
  row: PortalRow;
  onCopied: (what: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<PortalSecrets | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stored = [
    row.secrets.password && "password",
    row.secrets.pin && "PIN",
    row.secrets.securityAnswers && "answers",
    row.secrets.codes && "codes",
  ].filter(Boolean) as string[];

  if (!stored.length) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="revealbtn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            setData(await revealSecrets(row.id));
            setOpen(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not read these credentials.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        {busy ? "Unlocking…" : `Reveal ${stored.join(", ")}`}
        {error && <span className="revealerr">{error}</span>}
      </button>
    );
  }

  return (
    <div className="secretbox">
      <div className="secretbox-head">
        <span>Credentials</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost ml-auto"
          onClick={() => {
            setData(null);
            setOpen(false);
          }}
        >
          Lock
        </button>
      </div>
      <SecretChip label="Password" value={data?.password ?? ""} onCopied={onCopied} />
      <SecretChip label="PIN" value={data?.pin ?? ""} onCopied={onCopied} />
      <SecretChip label="Security answers" value={data?.securityAnswers ?? ""} onCopied={onCopied} multiline />
      <SecretChip label="Codes" value={data?.codes ?? ""} onCopied={onCopied} multiline />
    </div>
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

      {/* Boxes start empty even when something is saved: the plaintext must
          not sit in the page's HTML. Blank keeps what is there already. */}
      <div className="col-span-full secretfields">
        <div className="secretfields-head">
          Credentials — encrypted before they are stored
          {r && <span className="secretfields-hint">blank leaves the saved value alone</span>}
        </div>
        <div className="formgrid">
          <div>
            <label className="field">Password</label>
            <input name="password" type="password" autoComplete="new-password" placeholder={r?.secrets.password ? "•••••• saved" : ""} />
          </div>
          <div>
            <label className="field">PIN</label>
            <input name="pin" type="password" autoComplete="off" placeholder={r?.secrets.pin ? "•••••• saved" : ""} />
          </div>
          <div>
            <label className="field">Codes</label>
            <input name="codes" autoComplete="off" placeholder={r?.secrets.codes ? "•••••• saved" : "activation / access code"} />
          </div>
          <div className="col-span-full">
            <label className="field">Security answers</label>
            <input name="securityAnswers" autoComplete="off" placeholder={r?.secrets.securityAnswers ? "•••••• saved" : "question — answer"} />
          </div>
          {r && (
            <label className="col-span-full checkline">
              <input type="checkbox" name="clearSecrets" />
              Delete every credential saved for this account
            </label>
          )}
        </div>
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
        Passwords, PINs, security answers and codes are encrypted before they are stored, stay
        hidden until you press <strong>Reveal</strong> on a card, and are never written to a log.
        Anyone who can sign in to Quantum can reveal them — so treat a Quantum login as the key to
        every state portal, and never paste a card number or a bank login into these boxes.
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

            <SecretPanel row={r} onCopied={flash} />

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
