import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, pactRecipients, pactSends } from "@/db/schema";
import { stateName, STATE_NAMES } from "@/lib/states";
import { getTaxSetting } from "@/lib/tax/calculate";
import { render } from "@/lib/pact-email/learn";
import { missingSources, nextRun, pactEmailSettings, previousPeriod } from "@/lib/pact-email/send";
import { googleConfigured } from "@/lib/pact-email/google";
import {
  confirmAll,
  connectMailbox,
  disconnectMailbox,
  saveRecipient,
  saveSchedule,
  scanMailbox,
  sendNow,
  sendTestToMe,
} from "@/app/actions/pact-email";
import { PendingButton } from "./PendingButton";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "PACT emails" };

const TOKENS = "{{month}} {{mon}} {{mm}} {{year}} {{period}}";

/**
 * The PACT report email automation: the reporting mailbox, the states learned
 * from its past sent mail, the schedule, and every send.
 */
export default async function PactEmailPage({ searchParams }: { searchParams: Promise<{ msg?: string; tone?: string }> }) {
  const sp = await searchParams;
  const period = previousPeriod(new Date());
  const [[account], recipients, history, settings, lastScan, missing] = await Promise.all([
    db.select().from(emailAccounts).limit(1),
    db.select().from(pactRecipients).orderBy(pactRecipients.state),
    db.select().from(pactSends).orderBy(desc(pactSends.updatedAt)).limit(80),
    pactEmailSettings(),
    getTaxSetting<{ at: string; read: number; learned: number; unmatched: { date: string; to: string; subject: string }[] } | null>(
      "pact_email_last_scan",
      null,
    ),
    missingSources(period),
  ]);
  const unconfirmed = recipients.filter((r) => !r.confirmedAt).length;
  const sentPeriods = new Set(history.filter((h) => h.status === "sent").map((h) => h.period));
  const next = nextRun(new Date(), settings, (p) => sentPeriods.has(p));
  const nextDate = next.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const late = !settings.startPeriod || period < settings.startPeriod;
  const thisMonth = history.filter((h) => h.period === period);

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">PACT emails</h1>
            <p className="page-sub mt-0.5">
              Every month Quantum emails each state its PACT report from your reporting Gmail - the
              recipients, subject and message learned from the PACT emails you sent before, with a fresh
              Excel of the month&apos;s shipments attached. Due the 10th.
            </p>
          </div>
        </div>
      </div>

      {sp.msg && <div className={`callout ${sp.tone === "err" ? "callout-warn" : "callout-ok"}`}>{sp.msg}</div>}

      {/* 1. Mailbox */}
      <section className="panel p-5">
        <div className="text-[14px] font-semibold">1. Reporting mailbox</div>
        {account ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
            <span>
              Connected: <strong>{account.address}</strong>{" "}
              <span className="text-[var(--muted)]">({account.provider === "google" ? "signed in with Google" : "app password"})</span>
              {account.status === "error" && <span className="ml-2 text-[var(--danger)]">({account.lastError})</span>}
            </span>
            <form action={scanMailbox}>
              <PendingButton className="btn btn-primary" pendingText="Reading sent mail… this can take a minute">
                {account.lastScanAt ? "Read past PACT emails again" : "Read past PACT emails"}
              </PendingButton>
            </form>
            {googleConfigured() && (
              <a href="/api/google/oauth/start" className="btn">
                Sign in with Google again
              </a>
            )}
            <form action={disconnectMailbox}>
              <button className="btn btn-ghost">Disconnect</button>
            </form>
            {lastScan && (
              <span className="text-[12px] text-[var(--muted)]">
                Last read {lastScan.at.slice(0, 16).replace("T", " ")}: {lastScan.read} emails with attachments, {lastScan.learned} state(s) learned.
              </span>
            )}
          </div>
        ) : (
          <div className="mt-3 max-w-[680px] space-y-3">
            {googleConfigured() ? (
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/google/oauth/start" className="btn btn-primary">
                  Sign in with Google
                </a>
                <span className="text-[12px] text-[var(--muted)]">
                  Sign in as the reporting mailbox and allow mail access. Google words it as full access; Quantum only reads the
                  Sent folder&apos;s PACT emails and sends the PACT reports.
                </span>
              </div>
            ) : (
              <div className="callout callout-note text-[12.5px]">
                <strong>Sign in with Google is not set up yet.</strong> Your Google Workspace admin does this once (about 5 minutes):
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>
                    In{" "}
                    <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                      Google Cloud console
                    </a>
                    , signed in with the company account, create a project named &quot;Quantum&quot;.
                  </li>
                  <li>
                    APIs &amp; Services &gt; Library: enable the <strong>Gmail API</strong>.
                  </li>
                  <li>
                    OAuth consent screen: user type <strong>Internal</strong>, app name &quot;Quantum&quot;, add the scopes{" "}
                    <code>gmail.readonly</code> and <code>gmail.send</code>.
                  </li>
                  <li>
                    Credentials &gt; Create credentials &gt; OAuth client ID &gt; <strong>Web application</strong>, with the authorized
                    redirect URI <code>https://maxvapor-tax.vercel.app/api/google/oauth/callback</code>.
                  </li>
                  <li>Send the Client ID and Client secret to whoever runs Quantum, to add as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.</li>
                </ol>
              </div>
            )}
            <details open={!googleConfigured()}>
              <summary className="cursor-pointer text-[12.5px] font-semibold">Or connect with an app password</summary>
          <form action={connectMailbox} className="mt-3 grid gap-3">
            <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-[var(--muted)]">
              <li>Sign in to the Gmail that sends PACT reports. In Google Account &gt; Security, turn on 2-Step Verification.</li>
              <li>
                Open{" "}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                  myaccount.google.com/apppasswords
                </a>
                , create an app password named &quot;Quantum&quot;, and copy the 16 letters.
              </li>
              <li>In Gmail Settings &gt; Forwarding and POP/IMAP, make sure IMAP is enabled.</li>
            </ol>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                Gmail address
                <input name="address" type="email" required placeholder="reports@yourcompany.com" />
              </label>
              <label className="field">
                App password
                <input name="appPassword" type="password" required placeholder="xxxx xxxx xxxx xxxx" autoComplete="off" />
              </label>
            </div>
            <p className="text-[11.5px] text-[var(--muted)]">
              Stored encrypted. Used only to read this mailbox&apos;s Sent folder and to send the PACT reports. Revoke it in
              your Google account at any time.
            </p>
            <div>
              <PendingButton className="btn btn-primary" pendingText="Signing in to Gmail…">
                Connect and test
              </PendingButton>
            </div>
          </form>
            </details>
          </div>
        )}
      </section>

      {/* 2. Schedule */}
      <section className="panel p-5">
        <div className="text-[14px] font-semibold">2. Schedule</div>
        <form action={saveSchedule} className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> Send automatically every month
          </label>
          <label className="flex items-center gap-2">
            on day
            <input type="number" name="sendDay" min={1} max={9} defaultValue={settings.sendDay} className="w-[70px]" />
          </label>
          <button className="btn">Save</button>
          <span className="text-[12px] text-[var(--muted)]">
            {settings.startPeriod ? (
              <>
                First automatic month: <strong>{settings.startPeriod}</strong>. Next: the <strong>{next.period}</strong> reports on{" "}
                {nextDate} (deadline the 10th).
              </>
            ) : (
              <>
                Nothing is sent until a state is confirmed. Confirming now makes <strong>{next.period}</strong> the first automatic
                month (sent {nextDate}); earlier months stay with you.
              </>
            )}
          </span>
        </form>
        {missing.length > 0 ? (
          <div className="callout callout-warn mt-3">
            Waiting for {period} data from: <strong>{missing.join(", ")}</strong>. These had shipments the month before but none
            for {period} yet - upload or sync them. The reports go out automatically once the data is in.
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-[var(--muted)]">Every source that shipped last month has {period} data.</p>
        )}
        <form action={sendNow} className="mt-3 flex items-center gap-2 text-[12.5px]">
          <input type="hidden" name="period" value={period} />
          <PendingButton className="btn btn-sm" pendingText="Sending…" disabled={!account || !recipients.some((r) => r.confirmedAt)}>
            Send {period} reports now{late ? " (late)" : ""}
          </PendingButton>
          <span className="text-[var(--muted)]">
            Sends to every confirmed state that has not had its {period} report from Quantum yet; none is sent twice.
            {late && (
              <strong className="text-[var(--warn)]">
                {" "}
                {period} was due on the 10th - press this only if those reports were not already filed by hand.
              </strong>
            )}
          </span>
        </form>
      </section>

      {/* 3. Recipients */}
      <section className="panel p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[14px] font-semibold">3. States and recipients</div>
          {unconfirmed > 0 && (
            <form action={confirmAll}>
              <button className="btn btn-primary btn-sm">Confirm all {unconfirmed}</button>
            </form>
          )}
          <span className="text-[12px] text-[var(--muted)]">
            Only <strong>confirmed</strong> states are emailed. Preview shows next month&apos;s email. Placeholders: {TOKENS}
          </span>
        </div>

        {recipients.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-[var(--muted)]">
            {account ? "Nothing learned yet - press \"Read past PACT emails\", or add a state below." : "Connect the mailbox first."}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {recipients.map((r) => {
              const nonExcel = r.pastAttachmentTypes.filter((t) => !["xlsx", "xls", "csv"].includes(t));
              return (
                <details key={r.state} className="rounded-lg border border-[var(--line)] p-3" open={!r.confirmedAt}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[13px]">
                    <strong>
                      {r.state} {stateName(r.state)}
                    </strong>
                    <span className={r.confirmedAt ? "badge badge-filed" : "badge badge-not_started"}>
                      {r.confirmedAt ? "Confirmed" : "Needs confirming"}
                    </span>
                    {!r.active && <span className="badge badge-no_activity">Paused</span>}
                    <span className="text-[var(--muted)]">to {r.toAddresses.join(", ")}</span>
                  </summary>

                  <div className="mt-3 rounded bg-slate-50 p-3 text-[12.5px]">
                    <div>
                      <span className="text-[var(--muted)]">Subject:</span> {render(r.subjectTemplate, period)}
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">Attachment:</span>{" "}
                      {render(r.attachmentTemplate || `${r.state}_PACT_{{year}}-{{mm}}`, period)}.xlsx
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans">{render(r.bodyTemplate, period)}</pre>
                    {nonExcel.length > 0 && (
                      <div className="mt-2 text-[var(--warn)]">
                        Past emails to {r.state} attached {nonExcel.join(", ")} - Quantum sends Excel. If {r.state} requires its own
                        form, keep this state paused and file it yourself.
                      </div>
                    )}
                    {r.learnedFrom.length > 0 && (
                      <div className="mt-2 text-[11.5px] text-[var(--muted)]">
                        Learned from: {r.learnedFrom.map((l) => `${l.date.slice(0, 10)} "${l.subject}"`).join(" · ")}
                      </div>
                    )}
                  </div>

                  <form action={saveRecipient} className="mt-3 grid gap-2 text-[12.5px]">
                    <input type="hidden" name="state" value={r.state} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="field">
                        To
                        <input name="to" defaultValue={r.toAddresses.join(", ")} />
                      </label>
                      <label className="field">
                        Cc
                        <input name="cc" defaultValue={r.ccAddresses.join(", ")} />
                      </label>
                    </div>
                    <label className="field">
                      Subject
                      <input name="subject" defaultValue={r.subjectTemplate} />
                    </label>
                    <label className="field">
                      Attachment name (without .xlsx)
                      <input name="attachment" defaultValue={r.attachmentTemplate ?? ""} placeholder={`${r.state}_PACT_{{year}}-{{mm}}`} />
                    </label>
                    <label className="field">
                      Message
                      <textarea name="body" rows={5} defaultValue={r.bodyTemplate} />
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="hidden" name="hasActive" value="1" />
                      <input type="checkbox" name="active" value="on" defaultChecked={r.active} /> Send this state
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button name="intent" value="confirm" className="btn btn-primary btn-sm">
                        {r.confirmedAt ? "Save and keep confirmed" : "Confirm"}
                      </button>
                      <button name="intent" value="save" className="btn btn-sm">
                        Save without confirming
                      </button>
                      <button name="intent" value="delete" className="btn btn-sm btn-ghost">
                        Remove
                      </button>
                    </div>
                  </form>
                  <form action={sendTestToMe} className="mt-2">
                    <input type="hidden" name="state" value={r.state} />
                    <PendingButton className="btn btn-sm btn-ghost" pendingText="Building and sending the test…" disabled={!account}>
                      Send a test of the {period} report to me
                    </PendingButton>
                  </form>
                </details>
              );
            })}
          </div>
        )}

        <details className="mt-4 text-[12.5px]">
          <summary className="cursor-pointer font-semibold">Add a state by hand</summary>
          <form action={saveRecipient} className="mt-2 grid max-w-[640px] gap-2">
            <label className="field">
              State
              <select name="state" required defaultValue="">
                <option value="" disabled>
                  Pick a state
                </option>
                {Object.entries(STATE_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              To
              <input name="to" required placeholder="pact@state.gov" />
            </label>
            <label className="field">
              Subject
              <input name="subject" defaultValue="PACT Act Report - {{month}} {{year}}" />
            </label>
            <label className="field">
              Message
              <textarea name="body" rows={4} defaultValue={"Hello,\n\nPlease find attached our PACT Act report for {{month}} {{year}}.\n\nThank you."} />
            </label>
            <div>
              <button name="intent" value="save" className="btn btn-sm">
                Add (confirm it after checking)
              </button>
            </div>
          </form>
        </details>

        {lastScan && lastScan.unmatched.length > 0 && (
          <details className="mt-3 text-[12.5px]">
            <summary className="cursor-pointer text-[var(--muted)]">
              {lastScan.unmatched.length} past PACT-looking email(s) whose state could not be told - add those states by hand
            </summary>
            <ul className="mt-2 space-y-1">
              {lastScan.unmatched.map((u, i) => (
                <li key={i}>
                  {u.date.slice(0, 10)} to {u.to}: &quot;{u.subject}&quot;
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* 4. History */}
      <section className="panel overflow-x-auto">
        <div className="panel-head">
          4. Sent reports{" "}
          {thisMonth.length > 0 && (
            <span className="ml-2 text-[12px] font-normal text-[var(--muted)]">
              {period}: {thisMonth.filter((h) => h.status === "sent").length} sent
            </span>
          )}
        </div>
        {history.length === 0 ? (
          <div className="empty">Nothing sent yet.</div>
        ) : (
          <table className="qtable">
            <thead>
              <tr>
                <th>Period</th>
                <th>State</th>
                <th>Status</th>
                <th>To</th>
                <th>Subject / attachment</th>
                <th className="num">Shipments</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>
                    <Link href={`/months/${h.period}/${h.state}`} className="text-[var(--accent)]">
                      {h.period}
                    </Link>
                  </td>
                  <td>{h.state}</td>
                  <td>
                    <span
                      className={
                        h.status === "sent"
                          ? "badge badge-filed"
                          : h.status === "failed"
                            ? "badge badge-overdue"
                            : "badge badge-no_activity"
                      }
                    >
                      {h.status}
                    </span>
                    {h.detail && <div className="max-w-[260px] text-[11px] text-[var(--muted)]">{h.detail}</div>}
                  </td>
                  <td className="max-w-[220px] text-[12px]">{(h.toAddresses ?? []).join(", ")}</td>
                  <td className="max-w-[300px] text-[12px]">
                    {h.subject}
                    {h.attachmentName && <div className="text-[11px] text-[var(--muted)]">{h.attachmentName}</div>}
                  </td>
                  <td className="num">{h.shipmentCount ?? "—"}</td>
                  <td className="whitespace-nowrap text-[12px]">{(h.sentAt ?? h.updatedAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
