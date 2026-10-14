"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, pactRecipients } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { computeAndPersist } from "@/lib/compute";
import { getAccount } from "@/lib/config";
import type { PactResult } from "@/lib/engine/types";
import { setTaxSetting } from "@/lib/tax/calculate";
import { sendMail, sentPactCandidates, testLogin } from "@/lib/pact-email/gmail";
import { learnRecipients, render } from "@/lib/pact-email/learn";
import { ensureStartPeriod, pactEmailSettings, previousPeriod, reportingLogin, runPactEmails } from "@/lib/pact-email/send";
import { buildPactSubmission } from "@/lib/pact-email/submission";

const PAGE = "/pact-email";
const back = (msg: string, tone: "ok" | "err" = "ok"): never =>
  redirect(`${PAGE}?${new URLSearchParams({ msg, tone }).toString()}`);
const list = (raw: FormDataEntryValue | null) =>
  String(raw ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));

export async function connectMailbox(fd: FormData) {
  const session = await requireSession();
  const address = String(fd.get("address") ?? "").trim().toLowerCase();
  const appPassword = String(fd.get("appPassword") ?? "").replace(/\s+/g, "");
  if (!address.includes("@") || appPassword.length < 16) back("Enter the Gmail address and its 16-letter app password.", "err");
  try {
    await testLogin({ kind: "app", address, appPassword });
  } catch (e) {
    back(e instanceof Error ? e.message : String(e), "err");
  }
  // One reporting mailbox: replace whatever was connected before.
  await db.delete(emailAccounts);
  await db.insert(emailAccounts).values({ address, provider: "gmail", secretCipher: encryptSecret(appPassword), connectedBy: session.email });
  revalidatePath(PAGE);
  back(`Connected ${address}. Now read its past PACT emails.`);
}

export async function disconnectMailbox() {
  await requireSession();
  await db.delete(emailAccounts);
  revalidatePath(PAGE);
  back("Mailbox disconnected. Nothing will be sent until one is connected again.");
}

/**
 * Reads the mailbox's sent PACT emails and (re)learns each state. A state whose
 * recipients or subject changed loses its confirmation and must be confirmed again.
 */
export async function scanMailbox() {
  await requireSession();
  const login = await reportingLogin();
  if (!login) back("Connect the reporting mailbox first.", "err");
  let found;
  try {
    // Stop well inside the page's 5-minute limit so a failure is saved and shown, not cut off.
    found = await Promise.race([
      sentPactCandidates(login!),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Reading the Sent folder took more than 4 minutes. Press the button once more.")), 240_000),
      ),
    ]);
  } catch (e) {
    await db.update(emailAccounts).set({ status: "error", lastError: e instanceof Error ? e.message : String(e) }).where(eq(emailAccounts.id, login!.id));
    back(`Could not read the Sent folder: ${e instanceof Error ? e.message : String(e)}`, "err");
  }
  const { learned, unmatched } = learnRecipients(found!, login!.address);
  const existing = new Map((await db.select().from(pactRecipients)).map((r) => [r.state, r]));
  for (const l of learned) {
    const prev = existing.get(l.state);
    const same =
      prev &&
      JSON.stringify([...prev.toAddresses].sort()) === JSON.stringify([...l.to].sort()) &&
      prev.subjectTemplate === l.subjectTemplate;
    const values = {
      state: l.state,
      toAddresses: l.to,
      ccAddresses: l.cc,
      subjectTemplate: l.subjectTemplate,
      bodyTemplate: l.bodyTemplate,
      attachmentTemplate: l.attachmentTemplate,
      pastAttachmentTypes: l.pastAttachmentTypes,
      learnedFrom: l.learnedFrom,
      learnedAt: new Date(),
      confirmedAt: same ? prev!.confirmedAt : null,
      confirmedBy: same ? prev!.confirmedBy : null,
      updatedAt: new Date(),
    };
    await db.insert(pactRecipients).values(values).onConflictDoUpdate({ target: pactRecipients.state, set: values });
  }
  await db.update(emailAccounts).set({ status: "ok", lastError: null, lastScanAt: new Date() }).where(eq(emailAccounts.id, login!.id));
  await setTaxSetting(
    "pact_email_last_scan",
    {
      at: new Date().toISOString(),
      read: found!.length,
      learned: learned.length,
      unmatched: unmatched.slice(0, 40).map((u) => ({ date: u.date, to: u.to.join(", "), subject: u.subject })),
    },
    "pact email",
  );
  revalidatePath(PAGE);
  back(
    learned.length
      ? `Read ${found!.length} sent emails with attachments: learned ${learned.length} state(s). Check each one and confirm.`
      : `Read ${found!.length} sent emails with attachments but none looked like a PACT report. Add states by hand below.`,
    learned.length ? "ok" : "err",
  );
}

export async function saveRecipient(fd: FormData) {
  const session = await requireSession();
  const state = String(fd.get("state") ?? "").toUpperCase();
  const intent = String(fd.get("intent") ?? "save");
  if (!/^[A-Z]{2}$/.test(state)) back("Pick a state.", "err");
  if (intent === "delete") {
    await db.delete(pactRecipients).where(eq(pactRecipients.state, state));
    revalidatePath(PAGE);
    back(`Removed ${state}. It will not be emailed.`);
  }
  const to = list(fd.get("to"));
  if (!to.length) back(`${state}: add at least one recipient address.`, "err");
  const values = {
    state,
    toAddresses: to,
    ccAddresses: list(fd.get("cc")),
    subjectTemplate: String(fd.get("subject") ?? "").trim() || "PACT Act Report - {{month}} {{year}}",
    bodyTemplate: String(fd.get("body") ?? "").trim() || "Please find attached our PACT Act report for {{month}} {{year}}.",
    attachmentTemplate: String(fd.get("attachment") ?? "").trim() || null,
    // The edit form says whether the box was ticked; the add-by-hand form has no box.
    active: fd.get("hasActive") ? fd.get("active") === "on" : true,
    confirmedAt: intent === "confirm" ? new Date() : null,
    confirmedBy: intent === "confirm" ? session.email : null,
    updatedAt: new Date(),
  };
  await db.insert(pactRecipients).values(values).onConflictDoUpdate({ target: pactRecipients.state, set: values });
  if (intent === "confirm") await ensureStartPeriod(session.email);
  revalidatePath(PAGE);
  back(intent === "confirm" ? `${state} confirmed - it is sent automatically from now on.` : `${state} saved (not confirmed - it is not sent until you confirm it).`);
}

export async function confirmAll() {
  const session = await requireSession();
  const rows = await db.select().from(pactRecipients);
  for (const r of rows.filter((x) => !x.confirmedAt && x.toAddresses.length)) {
    await db.update(pactRecipients).set({ confirmedAt: new Date(), confirmedBy: session.email }).where(eq(pactRecipients.id, r.id));
  }
  await ensureStartPeriod(session.email);
  revalidatePath(PAGE);
  back("All learned states confirmed.");
}

export async function saveSchedule(fd: FormData) {
  const session = await requireSession();
  const sendDay = Math.min(9, Math.max(1, Number(fd.get("sendDay") ?? 5) || 5));
  const current = await pactEmailSettings();
  await setTaxSetting("pact_email", { ...current, enabled: fd.get("enabled") === "on", sendDay }, session.email);
  revalidatePath(PAGE);
  back(fd.get("enabled") === "on" ? `Automatic sending is on - every month on day ${sendDay}.` : "Automatic sending is off.");
}

/** The real report for one state, sent to the reporting mailbox itself - never to the state. */
export async function sendTestToMe(fd: FormData) {
  await requireSession();
  const state = String(fd.get("state") ?? "").toUpperCase();
  const login = await reportingLogin();
  if (!login) back("Connect the reporting mailbox first.", "err");
  const [r] = await db.select().from(pactRecipients).where(eq(pactRecipients.state, state)).limit(1);
  if (!r) back(`No ${state} recipient yet.`, "err");
  const period = previousPeriod(new Date());
  try {
    const result = (await computeAndPersist(state, "pact", period)) as PactResult;
    const account = await getAccount(state, "pact");
    const file = await buildPactSubmission(result, {
      company: process.env.COMPANY_NAME ?? "Maximum Vapor Inc.",
      fein: process.env.COMPANY_FEIN ?? "",
      licenseNumber: account?.licenseNumber ?? null,
      accountNumber: account?.accountNumber ?? null,
    });
    await sendMail(login!, {
      to: [login!.address],
      subject: `[TEST - would go to ${r!.toAddresses.join(", ")}] ${render(r!.subjectTemplate, period)}`,
      text: render(r!.bodyTemplate, period),
      attachments: [{ filename: `${render(r!.attachmentTemplate || `${state}_PACT_{{year}}-{{mm}}`, period)}.xlsx`, content: file }],
    });
    back(`Test for ${state} (${period}, ${result.shipmentCount} shipments) sent to ${login!.address}. Nothing went to the state.`);
  } catch (e) {
    unstable_rethrow(e);
    back(`Test failed: ${e instanceof Error ? e.message : String(e)}`, "err");
  }
}

/** Send the month's reports now, ignoring the day and the data-wait (the user decided). */
export async function sendNow(fd: FormData) {
  await requireSession();
  const period = String(fd.get("period") ?? previousPeriod(new Date()));
  // A person pressed it for this month: allowed even before the first automatic
  // month (a late filing). Each state is still sent at most once per month.
  if (!/^\d{4}-\d{2}$/.test(period) || period > previousPeriod(new Date())) back("Pick a finished month.", "err");
  const r = await runPactEmails({ force: { period } });
  revalidatePath(PAGE);
  back(
    r.ran
      ? `${period}: ${r.sent.length} sent, ${r.skipped.length} without shipments${r.failed.length ? `, ${r.failed.length} failed` : ""}.`
      : `${period}: nothing sent - ${r.reason}.`,
    r.failed.length || !r.ran ? "err" : "ok",
  );
}

export async function currentSchedule() {
  return pactEmailSettings();
}
