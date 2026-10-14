/**
 * Learning a state's PACT email from the mailbox's past sent mail: is this a
 * PACT report, which state was it for, and what do its subject, text and
 * attachment name look like with the reported month taken out. Pure functions -
 * the mailbox access is in ./gmail.
 */
import { STATE_NAMES } from "../states";

export type SentEmail = {
  messageId: string;
  date: string; // ISO
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachments: string[]; // file names
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Government mail domains -> state. Matched on the address's domain or any
 * parent of it (pact@dor.wa.gov -> wa.gov). "<xx>.gov" and "state.<xx>.us"
 * are handled generically below; these are the ones that do not follow it.
 */
const STATE_DOMAINS: Record<string, string> = {
  "alabama.gov": "AL", "revenue.alabama.gov": "AL", "alaska.gov": "AK", "azdor.gov": "AZ", "az.gov": "AZ",
  "arkansas.gov": "AR", "dfa.arkansas.gov": "AR", "cdtfa.ca.gov": "CA", "ca.gov": "CA", "colorado.gov": "CO",
  "state.co.us": "CO", "ct.gov": "CT", "delaware.gov": "DE", "dc.gov": "DC", "floridarevenue.com": "FL",
  "myfloridalicense.com": "FL", "myflorida.com": "FL", "georgia.gov": "GA", "dor.ga.gov": "GA", "hawaii.gov": "HI",
  "idaho.gov": "ID", "tax.idaho.gov": "ID", "illinois.gov": "IL", "in.gov": "IN", "iowa.gov": "IA",
  "kansas.gov": "KS", "ks.gov": "KS", "ky.gov": "KY", "la.gov": "LA", "louisiana.gov": "LA", "maine.gov": "ME",
  "maryland.gov": "MD", "marylandtaxes.gov": "MD", "comp.state.md.us": "MD", "mass.gov": "MA",
  "michigan.gov": "MI", "mn.gov": "MN", "state.mn.us": "MN", "ms.gov": "MS", "dor.ms.gov": "MS",
  "mo.gov": "MO", "dor.mo.gov": "MO", "mt.gov": "MT", "nebraska.gov": "NE", "nv.gov": "NV", "nevada.gov": "NV",
  "tax.nv.gov": "NV", "nh.gov": "NH", "nj.gov": "NJ", "treas.nj.gov": "NJ", "nm.gov": "NM", "state.nm.us": "NM",
  "ny.gov": "NY", "tax.ny.gov": "NY", "ncdor.gov": "NC", "nc.gov": "NC", "nd.gov": "ND", "ohio.gov": "OH",
  "tax.ohio.gov": "OH", "ok.gov": "OK", "tax.ok.gov": "OK", "oregon.gov": "OR", "pa.gov": "PA", "ri.gov": "RI",
  "tax.ri.gov": "RI", "sc.gov": "SC", "dor.sc.gov": "SC", "sd.gov": "SD", "state.sd.us": "SD", "tn.gov": "TN",
  "texas.gov": "TX", "cpa.texas.gov": "TX", "utah.gov": "UT", "vermont.gov": "VT", "virginia.gov": "VA",
  "tax.virginia.gov": "VA", "wa.gov": "WA", "dor.wa.gov": "WA", "lcb.wa.gov": "WA", "wv.gov": "WV",
  "wisconsin.gov": "WI", "revenue.wi.gov": "WI", "wyo.gov": "WY",
};

const PACT_WORDS = /\bpact\b|jenkins act|delivery sales?\b|\bends\b.*\breport|vapor (product )?shipments?|e-?cigarette shipments?|tobacco (product )?shipments?/i;

/** A sent email that looks like a PACT / Jenkins Act shipment report with a file attached. */
export function isPactEmail(e: SentEmail): boolean {
  if (!e.attachments.length) return false;
  const hay = `${e.subject}\n${e.attachments.join(" ")}\n${e.text.slice(0, 3000)}`;
  return PACT_WORDS.test(hay);
}

function stateFromDomain(address: string): string | null {
  const domain = address.toLowerCase().split("@")[1]?.trim();
  if (!domain) return null;
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    if (STATE_DOMAINS[d]) return STATE_DOMAINS[d];
    const gov = /^([a-z]{2})\.gov$/.exec(d);
    if (gov && STATE_NAMES[gov[1].toUpperCase()]) return gov[1].toUpperCase();
    const us = /^state\.([a-z]{2})\.us$/.exec(d);
    if (us && STATE_NAMES[us[1].toUpperCase()]) return us[1].toUpperCase();
  }
  return null;
}

/** State names, longest first so "West Virginia" wins over "Virginia". */
const NAMES = Object.entries(STATE_NAMES).sort((a, b) => b[1].length - a[1].length);

function stateFromText(text: string): string | null {
  for (const [code, name] of NAMES) {
    if (new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(text)) return code;
  }
  // Two-letter code as its own token in a subject or file name ("PACT_TX_2026-09").
  const m = /(?:^|[\s_\-(\[])([A-Z]{2})(?=$|[\s_\-)\].,])/.exec(text);
  if (m && STATE_NAMES[m[1]] && !["ON", "OR", "IN", "ME", "OK", "HI", "DE"].includes(m[1])) return m[1];
  return null;
}

export type StateMatch = { state: string; by: "recipient domain" | "subject" | "attachment name" | "message text" };

/** Which state the report went to: the agency's mail domain first, then the words used. */
export function detectState(e: SentEmail): StateMatch | null {
  const fromDomains = [...new Set([...e.to, ...e.cc].map(stateFromDomain).filter((s): s is string => !!s))];
  if (fromDomains.length === 1) return { state: fromDomains[0], by: "recipient domain" };
  const s = stateFromText(e.subject);
  if (s) return { state: s, by: "subject" };
  const a = stateFromText(e.attachments.join(" "));
  if (a) return { state: a, by: "attachment name" };
  const t = stateFromText(e.text.slice(0, 1500));
  if (t) return { state: t, by: "message text" };
  return null;
}

/** The month a report covers: a month named in the subject/attachment, else the month before it was sent. */
export function reportedPeriod(e: SentEmail): string {
  const hay = `${e.subject} ${e.attachments.join(" ")}`.toLowerCase();
  const sent = new Date(e.date);
  const named = MONTHS.findIndex((m) => new RegExp(`\\b(${m}|${m.slice(0, 3)})\\b`).test(hay));
  const iso = /(?<!\d)(20\d\d)[-_/.](0[1-9]|1[0-2])(?!\d)/.exec(hay) ?? null;
  if (iso) return `${iso[1]}-${iso[2]}`;
  const us = /(?<!\d)(0?[1-9]|1[0-2])[-_/.](20\d\d)(?!\d)/.exec(hay);
  if (us) return `${us[2]}-${us[1].padStart(2, "0")}`;
  if (named >= 0) {
    const yearInText = /\b(20\d\d)\b/.exec(hay)?.[1];
    let year = yearInText ? Number(yearInText) : sent.getUTCFullYear();
    if (!yearInText && named > sent.getUTCMonth()) year -= 1; // "December" report sent in January
    return `${year}-${String(named + 1).padStart(2, "0")}`;
  }
  const prev = new Date(Date.UTC(sent.getUTCFullYear(), sent.getUTCMonth() - 1, 1));
  return prev.toISOString().slice(0, 7);
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * Replace the reported month inside a past subject/body/file name with tokens:
 * "September 2026" -> "{{month}} {{year}}", "2026-09" -> "{{year}}-{{mm}}",
 * "09/2026" -> "{{mm}}/{{year}}", "SEP" -> "{{MON}}".
 *
 * `loose` (subjects, file names) also replaces a month name standing alone. In
 * a message body a month only counts next to the year: "may" and "mar" are
 * ordinary words there ("you may contact us").
 */
export function templatize(text: string, period: string, { loose = false }: { loose?: boolean } = {}): string {
  const [y, m] = period.split("-");
  const full = MONTHS[Number(m) - 1];
  const short = full.slice(0, 3);
  const name = `(${full}|${short}\\.?)`;
  const token = (word: string) => {
    // "May" is both names: a word equal to the full name is the full name.
    const isFull = word.replace(".", "").toLowerCase() === full || word.replace(".", "").length > 4;
    const upper = word === word.toUpperCase();
    return isFull ? (upper ? "{{MONTH}}" : "{{month}}") : upper ? "{{MON}}" : "{{mon}}";
  };
  let out = text;
  // Numeric forms first: 2026-09, 2026_09, 09/2026, 9-2026.
  // Digit boundaries, not \\b: in "PACT_TX_2026-08" the underscore is a word character.
  out = out.replace(new RegExp(`(?<!\\d)${y}([-_/.])${m}(?!\\d)`, "g"), (_s, sep) => `{{year}}${sep}{{mm}}`);
  out = out.replace(new RegExp(`(?<!\\d)0?${Number(m)}([-_/.])${y}(?!\\d)`, "g"), (_s, sep) => `{{mm}}${sep}{{year}}`);
  // Month name next to the year: "September 2026", "Sep. 2026", "SEP-2026", "Sept 2026".
  out = out.replace(new RegExp(`\\b(${full}|${short}t?\\.?)([\\s,_\\-]*)${y}\\b`, "gi"), (_s, word, sep) => `${token(word)}${sep}{{year}}`);
  if (loose) {
    out = out.replace(new RegExp(`\\b${name}(?=$|[^a-z])`, "gi"), (word) => token(word));
    out = out.replace(new RegExp(`(?<!\\d)${y}(?!\\d)`, "g"), "{{year}}");
  }
  return out;
}

/** Fill a template for a period ("2026-10"). */
export function render(template: string, period: string): string {
  const [y, m] = period.split("-");
  const full = MONTHS[Number(m) - 1];
  return template
    .replace(/\{\{period\}\}/g, period)
    .replace(/\{\{year\}\}/g, y)
    .replace(/\{\{mm\}\}/g, m)
    .replace(/\{\{MONTH\}\}/g, full.toUpperCase())
    .replace(/\{\{month\}\}/g, cap(full))
    .replace(/\{\{MON\}\}/g, full.slice(0, 3).toUpperCase())
    .replace(/\{\{mon\}\}/g, cap(full.slice(0, 3)));
}

/** The message's own text: quoted replies and forwarded history removed. */
export function ownText(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/.test(line) || /^-{2,}\s*(Original|Forwarded) Message/i.test(line) || /^From: .+/.test(line)) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type LearnedRecipient = {
  state: string;
  matchedBy: StateMatch["by"];
  to: string[];
  cc: string[];
  subjectTemplate: string;
  bodyTemplate: string;
  attachmentTemplate: string | null;
  pastAttachmentTypes: string[];
  learnedFrom: { messageId: string; date: string; subject: string }[];
};

/**
 * Group the mailbox's sent PACT emails by state; each state's template is its
 * most recent email, its recipients that email's To/Cc (minus our own address).
 */
export function learnRecipients(emails: SentEmail[], ownAddress: string): { learned: LearnedRecipient[]; unmatched: SentEmail[] } {
  const own = ownAddress.toLowerCase();
  const byState = new Map<string, { e: SentEmail; by: StateMatch["by"] }[]>();
  const unmatched: SentEmail[] = [];
  for (const e of emails.filter(isPactEmail)) {
    const match = detectState(e);
    if (!match) {
      unmatched.push(e);
      continue;
    }
    if (!byState.has(match.state)) byState.set(match.state, []);
    byState.get(match.state)!.push({ e, by: match.by });
  }

  const learned: LearnedRecipient[] = [];
  for (const [state, list] of byState) {
    list.sort((a, b) => b.e.date.localeCompare(a.e.date));
    const latest = list[0];
    const period = reportedPeriod(latest.e);
    const attachment = latest.e.attachments.find((a) => /\.(xlsx?|csv|pdf|txt)$/i.test(a)) ?? latest.e.attachments[0] ?? null;
    learned.push({
      state,
      matchedBy: latest.by,
      to: latest.e.to.filter((a) => a.toLowerCase() !== own),
      cc: latest.e.cc.filter((a) => a.toLowerCase() !== own),
      subjectTemplate: templatize(latest.e.subject, period, { loose: true }),
      bodyTemplate: templatize(ownText(latest.e.text), period),
      attachmentTemplate: attachment ? templatize(attachment.replace(/\.[a-z0-9]+$/i, ""), period, { loose: true }) : null,
      pastAttachmentTypes: [
        ...new Set(list.flatMap((x) => x.e.attachments.map((a) => a.split(".").pop()?.toLowerCase() ?? ""))),
      ].filter(Boolean),
      learnedFrom: list.slice(0, 6).map((x) => ({ messageId: x.e.messageId, date: x.e.date, subject: x.e.subject })),
    });
  }
  learned.sort((a, b) => a.state.localeCompare(b.state));
  return { learned, unmatched };
}
