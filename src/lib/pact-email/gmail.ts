import "server-only";
import { ImapFlow, type MessageStructureObject } from "imapflow";
import nodemailer from "nodemailer";
import type { SentEmail } from "./learn";
import { googleAccessToken } from "./google";

/**
 * The reporting Gmail over IMAP (read the Sent folder) and SMTP (send), signed
 * in either with Google (an OAuth access token, see ./google) or with an app
 * password (Google account > Security > 2-Step Verification > App passwords).
 * Gmail saves what SMTP sends into Sent by itself.
 */
export type AppPasswordLogin = { kind?: "app"; address: string; appPassword: string };
export type GoogleLogin = { kind: "google"; address: string; refreshToken: string };
export type MailLogin = AppPasswordLogin | GoogleLogin;

const clean = (p: string) => p.replace(/\s+/g, "");

async function imap(login: MailLogin) {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth:
      login.kind === "google"
        ? { user: login.address, accessToken: await googleAccessToken(login.refreshToken) }
        : { user: login.address, pass: clean(login.appPassword) },
    logger: false,
    socketTimeout: 60_000,
  });
}

async function smtp(login: MailLogin) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth:
      login.kind === "google"
        ? { type: "OAuth2", user: login.address, accessToken: await googleAccessToken(login.refreshToken) }
        : { user: login.address, pass: clean(login.appPassword) },
  });
}

/** Signs in to both IMAP and SMTP; throws a readable message when either refuses. */
export async function testLogin(login: MailLogin): Promise<void> {
  const client = await imap(login);
  try {
    await client.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      /auth|credentials|invalid/i.test(msg)
        ? "Gmail refused the sign-in. Use a 16-letter app password (not your normal password), and make sure IMAP is on in Gmail settings."
        : `Could not reach Gmail: ${msg}`,
    );
  } finally {
    await client.logout().catch(() => {});
  }
  await (await smtp(login)).verify();
}

function walk(node: MessageStructureObject, visit: (n: MessageStructureObject) => void) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

function filenameOf(n: MessageStructureObject): string | null {
  return (n.dispositionParameters?.filename as string | undefined) ?? (n.parameters?.name as string | undefined) ?? null;
}

async function readPart(client: ImapFlow, uid: number, part: string): Promise<string> {
  const { content } = await client.download(String(uid), part, { uid: true, maxBytes: 200_000 });
  if (!content) return "";
  const chunks: Buffer[] = [];
  for await (const c of content) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The Sent folder's likely PACT emails from the last `months`: Gmail's own
 * search narrows it, then only each message's headers, attachment names and
 * plain-text part are read - never the attachments themselves.
 */
export async function sentPactCandidates(login: MailLogin, months = 24, limit = 400): Promise<SentEmail[]> {
  const client = await imap(login);
  await client.connect();
  try {
    const folders = await client.list();
    const sent = folders.find((f) => f.specialUse === "\\Sent")?.path ?? "[Gmail]/Sent Mail";
    const lock = await client.getMailboxLock(sent);
    try {
      const query = `has:attachment newer_than:${months}m (PACT OR "Jenkins Act" OR "delivery sale" OR "delivery sales" OR "ENDS report" OR "vapor shipments" OR "tobacco shipments" OR "e-cigarette shipments" OR filename:pact)`;
      const uids = ((await client.search({ gmraw: query }, { uid: true })) || []).slice(-limit);
      if (!uids.length) return [];

      // Collect first: imapflow deadlocks if another command runs inside a fetch loop.
      const found: { uid: number; email: Omit<SentEmail, "text">; textPart: string | null }[] = [];
      for await (const msg of client.fetch(uids, { uid: true, envelope: true, bodyStructure: true, internalDate: true }, { uid: true })) {
        const env = msg.envelope;
        if (!env || !msg.bodyStructure) continue;
        const attachments: string[] = [];
        let textPart: string | null = null;
        walk(msg.bodyStructure, (n) => {
          const name = filenameOf(n);
          if (name && (n.disposition === "attachment" || !n.type.startsWith("text/"))) attachments.push(name);
          else if (!textPart && n.type === "text/plain" && n.part) textPart = n.part;
        });
        if (!attachments.length) continue;
        const addr = (list?: { address?: string }[]) => (list ?? []).map((a) => a.address ?? "").filter(Boolean);
        found.push({
          uid: msg.uid,
          textPart,
          email: {
            messageId: env.messageId ?? `uid:${msg.uid}`,
            date: new Date(env.date ?? msg.internalDate ?? Date.now()).toISOString(),
            to: addr(env.to),
            cc: addr(env.cc),
            subject: env.subject ?? "",
            attachments,
          },
        });
      }

      const out: SentEmail[] = [];
      for (const f of found) {
        const text = f.textPart ? await readPart(client, f.uid, f.textPart).catch(() => "") : "";
        out.push({ ...f.email, text });
      }
      return out;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export type OutgoingMail = {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
};

/** Sends from the reporting mailbox; returns the Message-ID. */
export async function sendMail(login: MailLogin, mail: OutgoingMail): Promise<string> {
  const info = await (await smtp(login)).sendMail({
    from: login.address,
    to: mail.to,
    cc: mail.cc?.length ? mail.cc : undefined,
    subject: mail.subject,
    text: mail.text,
    attachments: mail.attachments,
  });
  return info.messageId;
}
