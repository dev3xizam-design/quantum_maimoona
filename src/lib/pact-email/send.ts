import "server-only";
import { and, eq, isNotNull, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, pactRecipients, pactSends, shipments } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { computeAndPersist } from "@/lib/compute";
import { getAccount } from "@/lib/config";
import { stateName } from "@/lib/states";
import { getTaxSetting } from "@/lib/tax/calculate";
import type { PactResult } from "@/lib/engine/types";
import { sendMail, type MailLogin } from "./gmail";
import { render } from "./learn";
import { buildPactSubmission } from "./submission";

/**
 * Monthly PACT emails, run from the 5-minute cron. On or after the send day it
 * reports LAST month: every confirmed state with shipments gets its report
 * from the reporting Gmail, with the subject and text learned from past
 * emails and a clean Excel of the month's delivery sales. Then a summary goes
 * to the reporting mailbox itself.
 *
 * Safety:
 * - Only CONFIRMED recipients are ever emailed.
 * - Each state is claimed in pact_sends before sending, so overlapping runs
 *   cannot both send it; only a failed send is retried (up to 5 attempts).
 * - If a data source that reported shipments last month has none this month
 *   (e.g. a Shopify export not uploaded yet), everything waits and the
 *   mailbox is told why, rather than filing a report with orders missing.
 */

/**
 * `startPeriod`: the first month Quantum reports on its own, fixed the first
 * time a state is confirmed. Months before it were filed by hand - sending
 * them automatically would file them twice.
 */
export type PactEmailSettings = { enabled: boolean; sendDay: number; startPeriod: string | null };
export const DEFAULT_PACT_EMAIL: PactEmailSettings = { enabled: true, sendDay: 5, startPeriod: null };
const DEADLINE_DAY = 10;
const MAX_ATTEMPTS = 5;
const TZ = "America/New_York";

export async function pactEmailSettings(): Promise<PactEmailSettings> {
  const s = await getTaxSetting<Partial<PactEmailSettings> | null>("pact_email", null);
  return { ...DEFAULT_PACT_EMAIL, ...(s ?? {}) };
}

/** Today in New York: the filing calendar's clock. */
function today(now: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return { y, m, d };
}

/** The month whose PACT deadline comes next: last month until the 10th, then this month. */
export function upcomingPeriod(now: Date): string {
  const { y, m, d } = today(now);
  return d <= DEADLINE_DAY ? previousPeriod(now) : `${y}-${String(m).padStart(2, "0")}`;
}

/** Fixes the first automatic month if it is not set yet (called when a state is confirmed). */
export async function ensureStartPeriod(actor: string): Promise<string> {
  const current = await pactEmailSettings();
  if (current.startPeriod) return current.startPeriod;
  const startPeriod = upcomingPeriod(new Date());
  const { setTaxSetting } = await import("@/lib/tax/calculate");
  await setTaxSetting("pact_email", { ...current, startPeriod }, actor);
  return startPeriod;
}

/** When the next automatic send happens and which month it covers. */
export function nextRun(now: Date, s: PactEmailSettings, settled: (period: string) => boolean) {
  const { y, m, d } = today(now);
  const last = previousPeriod(now);
  const start = s.startPeriod ?? upcomingPeriod(now);
  if (last >= start && !settled(last)) {
    return { period: last, date: d < s.sendDay ? new Date(Date.UTC(y, m - 1, s.sendDay)) : now };
  }
  const thisMonth = `${y}-${String(m).padStart(2, "0")}`;
  return { period: thisMonth >= start ? thisMonth : start, date: new Date(Date.UTC(y, m, s.sendDay)) };
}

export function previousPeriod(now: Date): string {
  const { y, m } = today(now);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return prev.toISOString().slice(0, 7);
}

const shiftPeriod = (period: string, months: number) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
};

export async function reportingLogin(): Promise<(MailLogin & { id: number }) | null> {
  const [acct] = await db.select().from(emailAccounts).orderBy(emailAccounts.id).limit(1);
  if (!acct) return null;
  const secret = decryptSecret(acct.secretCipher);
  return acct.provider === "google"
    ? { id: acct.id, kind: "google", address: acct.address, refreshToken: (JSON.parse(secret) as { refreshToken: string }).refreshToken }
    : { id: acct.id, kind: "app", address: acct.address, appPassword: secret };
}

/** Sources that shipped last-but-one month but have nothing in `period` yet. */
export async function missingSources(period: string): Promise<string[]> {
  const rows = await db
    .select({ period: shipments.period, source: dsql<string>`coalesce(${shipments.sourceLabel}, ${shipments.sourceSystem})` })
    .from(shipments)
    .where(dsql`${shipments.period} IN (${period}, ${shiftPeriod(period, -1)})`)
    .groupBy(shipments.period, dsql`coalesce(${shipments.sourceLabel}, ${shipments.sourceSystem})`);
  const now = new Set(rows.filter((r) => r.period === period).map((r) => r.source));
  return [...new Set(rows.filter((r) => r.period !== period).map((r) => r.source))].filter((s) => !now.has(s)).sort();
}

/** Claim a state's send for the month; false when it is done, in flight, or out of attempts. */
async function claim(period: string, state: string): Promise<boolean> {
  const rows = await db
    .insert(pactSends)
    .values({ period, state, status: "sending", attempts: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [pactSends.period, pactSends.state],
      set: { status: "sending", attempts: dsql`${pactSends.attempts} + 1`, updatedAt: new Date() },
      setWhere: dsql`(${pactSends.status} = 'failed' AND ${pactSends.attempts} < ${MAX_ATTEMPTS})
        OR (${pactSends.status} = 'sending' AND ${pactSends.updatedAt} < now() - interval '15 minutes')
        OR ${pactSends.status} = 'held'`,
    })
    .returning({ id: pactSends.id });
  return rows.length > 0;
}

async function record(period: string, state: string, patch: Partial<typeof pactSends.$inferInsert>) {
  await db
    .update(pactSends)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(pactSends.period, period), eq(pactSends.state, state)));
}

export type PactRunResult = {
  period: string;
  ran: boolean;
  reason?: string;
  sent: string[];
  skipped: string[];
  failed: { state: string; error: string }[];
  noRecipient: string[];
};

/**
 * `force`: run now for `period` regardless of the day or the enabled switch
 * (the "Send now" button). `onlyStates` limits a forced run.
 */
export async function runPactEmails(
  opts: {
    now?: Date;
    force?: { period: string; onlyStates?: string[] };
    /** Tests pass a fake; production sends through Gmail. */
    mailer?: typeof sendMail;
  } = {},
): Promise<PactRunResult> {
  const now = opts.now ?? new Date();
  const send = opts.mailer ?? sendMail;
  const period = opts.force?.period ?? previousPeriod(now);
  const out: PactRunResult = { period, ran: false, sent: [], skipped: [], failed: [], noRecipient: [] };

  const settings = await pactEmailSettings();
  if (!opts.force) {
    if (!settings.enabled) return { ...out, reason: "automation is switched off" };
    if (!settings.startPeriod) return { ...out, reason: "no state confirmed yet" };
    if (period < settings.startPeriod) return { ...out, reason: `${period} is before the first automatic month (${settings.startPeriod})` };
    if (today(now).d < settings.sendDay) return { ...out, reason: `waits until day ${settings.sendDay}` };
  }

  const recipients = (
    await db.select().from(pactRecipients).where(and(eq(pactRecipients.active, true), isNotNull(pactRecipients.confirmedAt)))
  ).filter((r) => !opts.force?.onlyStates || opts.force.onlyStates.includes(r.state));
  if (!recipients.length) return { ...out, reason: "no confirmed recipients" };

  // Cheap exit for the 5-minute cron: every state already settled this month.
  const done = await db.select({ state: pactSends.state, status: pactSends.status }).from(pactSends).where(eq(pactSends.period, period));
  const settled = new Set(done.filter((d) => d.status === "sent" || d.status === "skipped").map((d) => d.state));
  if (!opts.force && recipients.every((r) => settled.has(r.state))) return { ...out, reason: "already sent" };

  const login = await reportingLogin();
  if (!login) return { ...out, reason: "no reporting mailbox connected" };

  const missing = await missingSources(period);
  if (missing.length && !opts.force) {
    // Hold, and tell the mailbox once a day why.
    const lastHold = await getTaxSetting<{ period: string; at: string } | null>("pact_email_hold_notice", null);
    if (!lastHold || lastHold.period !== period || Date.now() - new Date(lastHold.at).getTime() > 86_400_000) {
      await send(login, {
        to: [login.address],
        subject: `Quantum: ${period} PACT reports are waiting for data`,
        text:
          `The ${period} PACT reports have not been sent yet.\n\n` +
          `These sources had shipments in ${shiftPeriod(period, -1)} but none in ${period} so far:\n` +
          missing.map((m) => `  - ${m}`).join("\n") +
          `\n\nUpload or sync them in Quantum. The reports go out automatically as soon as the data is there ` +
          `(PACT is due on the 10th). If a source really had no ${period} sales, use "Send now" on the PACT email page.\n`,
      });
      const { setTaxSetting } = await import("@/lib/tax/calculate");
      await setTaxSetting("pact_email_hold_notice", { period, at: new Date().toISOString() }, "pact email");
    }
    return { ...out, reason: `waiting for data: ${missing.join(", ")}` };
  }

  out.ran = true;
  for (const r of recipients) {
    if (!(await claim(period, r.state))) continue;
    try {
      const result = (await computeAndPersist(r.state, "pact", period)) as PactResult;
      if (!result.shipmentCount) {
        await record(period, r.state, { status: "skipped", shipmentCount: 0, detail: "No shipments into this state." });
        out.skipped.push(r.state);
        continue;
      }
      const account = await getAccount(r.state, "pact");
      const file = await buildPactSubmission(result, {
        company: process.env.COMPANY_NAME ?? "Maximum Vapor Inc.",
        fein: process.env.COMPANY_FEIN ?? "",
        licenseNumber: account?.licenseNumber ?? null,
        accountNumber: account?.accountNumber ?? null,
      });
      const attachmentName = `${render(r.attachmentTemplate || `${r.state}_PACT_{{year}}-{{mm}}`, period)}.xlsx`;
      const subject = render(r.subjectTemplate, period);
      const messageId = await send(login, {
        to: r.toAddresses,
        cc: r.ccAddresses,
        subject,
        text: render(r.bodyTemplate, period),
        attachments: [{ filename: attachmentName, content: file }],
      });
      await record(period, r.state, {
        status: "sent",
        toAddresses: [...r.toAddresses, ...r.ccAddresses],
        subject,
        attachmentName,
        shipmentCount: result.shipmentCount,
        messageId,
        detail: result.warnings.length ? result.warnings.join(" | ").slice(0, 1000) : null,
        sentAt: new Date(),
      });
      out.sent.push(r.state);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await record(period, r.state, { status: "failed", detail: error.slice(0, 1000) });
      out.failed.push({ state: r.state, error });
    }
  }

  // States with shipments this month but no learned recipient: still owed, so say so.
  const shippedStates = await db
    .selectDistinct({ state: shipments.state })
    .from(shipments)
    .where(eq(shipments.period, period));
  const known = new Set(
    (await db.select({ state: pactRecipients.state }).from(pactRecipients).where(isNotNull(pactRecipients.confirmedAt))).map((r) => r.state),
  );
  out.noRecipient = shippedStates.map((s) => s.state).filter((s) => !known.has(s)).sort();

  if (out.sent.length || out.failed.length) {
    const line = (s: string) => `  - ${s} ${stateName(s)}`;
    await send(login, {
      to: [login.address],
      subject: `Quantum: ${period} PACT reports - ${out.sent.length} sent${out.failed.length ? `, ${out.failed.length} FAILED` : ""}`,
      text: [
        `PACT reports for ${period}:`,
        "",
        `Sent (${out.sent.length}):`,
        ...out.sent.map(line),
        ...(out.failed.length ? ["", `FAILED (${out.failed.length}) - retried automatically, check Quantum:`, ...out.failed.map((f) => `  - ${f.state}: ${f.error}`)] : []),
        ...(out.skipped.length ? ["", `No shipments, nothing sent (${out.skipped.length}):`, ...out.skipped.map(line)] : []),
        ...(out.noRecipient.length
          ? ["", `Shipped into these states but no confirmed PACT address - file these yourself or add them in Quantum:`, ...out.noRecipient.map(line)]
          : []),
        "",
        "Each report is listed with its attachment on Quantum's PACT email page.",
      ].join("\n"),
    });
  }
  return out;
}
