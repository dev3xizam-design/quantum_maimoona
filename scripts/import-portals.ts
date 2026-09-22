/**
 * Import the "Active Multi State" tracker into the portal directory.
 *
 *   npx tsx --conditions=react-server scripts/import-portals.ts "<path to .xlsx>"
 *
 * The tracker mixes two kinds of column. The identifying ones -- label,
 * frequency, purpose, licence number, login id, portal link, notes -- are
 * stored as plain text. The password, PIN, security answers and portal codes
 * are encrypted into a single AES-256-GCM blob and never written anywhere
 * else: not to a plaintext column, not to the notes, and not to this
 * script's own output, which prints counts and never a value.
 *
 * Re-running replaces every field from the tracker, so hand edits made in
 * the app are overwritten. That is the point -- the tracker is the source.
 */
import "../src/lib/load-env";
import ExcelJS from "exceljs";
import { db, sql } from "../src/db";
import { portals } from "../src/db/schema";
import { scrubSecrets } from "../src/lib/scrub-secrets";
import { packSecrets, type PortalSecrets } from "../src/lib/portal-secrets";

/** Columns in the tracker, 1-indexed. */
const COL = {
  label: 4, blocked: 5, frequency: 6, purpose: 7, notes: 8, license: 9,
  loginId: 11, password: 12,
};
/** The link is usually col 13, but a few rows are shifted one to the right. */
const LINK_SEARCH = [13, 14, 15, 16];
/** Free-text columns holding PINs, security answers and portal codes. */
const EXTRA_SEARCH = [14, 15, 16, 17];

const NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", conneticut: "CT", delaware: "DE",
  "district of columbia": "DC", "district of colmbia": "DC", florida: "FL",
  georgia: "GA", hawaii: "HI", hawali: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", massachutes: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "rhode islands": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", tenessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

/** West Virginia must win over Virginia, so try the longest names first. */
const BY_LENGTH = Object.keys(NAMES).sort((a, b) => b.length - a.length);

function stateOf(label: string): string {
  const hay = label.toLowerCase();
  for (const name of BY_LENGTH) if (hay.includes(name)) return NAMES[name];
  return "--";
}

function cell(row: ExcelJS.Row, n: number): string {
  let v: unknown = row.getCell(n).value;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") v = o.text;
    else if (Array.isArray(o.richText)) v = (o.richText as { text: string }[]).map((r) => r.text).join("");
    else if (o.result !== undefined) v = o.result;
    else v = "";
  }
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function linkOf(row: ExcelJS.Row): { url: string | null; stray: string | null; urlCol: number } {
  let stray: string | null = null;
  for (const n of LINK_SEARCH) {
    const c = row.getCell(n);
    const href = typeof c.hyperlink === "string" ? c.hyperlink : null;
    const text = cell(row, n);
    const url = href && /^https?:/i.test(href) ? href : /^https?:/i.test(text) ? text : null;
    if (url) return { url, stray, urlCol: n };
    // Column 13 holding something that is not a link is still worth keeping.
    if (n === 13 && text && !stray) stray = text;
  }
  return { url: null, stray, urlCol: -1 };
}

/** Status scribbles that share a column with the codes but are not secrets. */
const NOT_A_SECRET = /^(done|0|n\/a|na|yes|no|ok|login page error|this site.*|`)$/i;

/**
 * Pulls the password, PIN, security answers and portal codes out of a row.
 * The password has its own column; everything else is scattered across the
 * free-text columns to the right of the link, so it is sorted by keyword and
 * anything unrecognised is kept rather than guessed away.
 */
function secretsOf(row: ExcelJS.Row, urlCol: number): PortalSecrets {
  const answers: string[] = [];
  const codes: string[] = [];
  const pins: string[] = [];

  for (const n of EXTRA_SEARCH) {
    if (n === urlCol) continue;
    const text = cell(row, n);
    if (!text || NOT_A_SECRET.test(text)) continue;
    if (/\bpins?\b/i.test(text)) pins.push(text);
    else if (/activation|authoriz|access\s*code|token/i.test(text)) codes.push(text);
    else answers.push(text);
  }

  return {
    password: cell(row, COL.password),
    pin: pins.join("\n"),
    securityAnswers: answers.join("\n"),
    codes: codes.join("\n"),
  };
}

function statusOf(f: { blocked: string; frequency: string; notes: string; loginId: string; url: string | null }) {
  if (/need license/i.test(f.notes)) return "needs_license";
  if (f.blocked.toUpperCase() === "B" || /blocked/i.test(f.frequency)) return "blocked";
  if (!f.loginId && !f.url) return "no_login";
  return "active";
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: import-portals.ts <path to the tracker .xlsx>");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const rows: (typeof portals.$inferInsert)[] = [];
  const seen = new Set<string>();

  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n < 3) return; // two header rows
    const label = cell(row, COL.label);
    if (!label || /^state$/i.test(label)) return;

    const { url, stray, urlCol } = linkOf(row);
    const notes = cell(row, COL.notes);
    const frequency = cell(row, COL.frequency);

    // A few login cells hold a sentence instead of a username, e.g. Alaska's
    // "there is no online sales tax req'd". Three or more words is prose;
    // real logins here are one word, or two like "Maximum vapor".
    const loginRaw = cell(row, COL.loginId);
    const isProse = loginRaw.split(/\s+/).length >= 3;
    const loginId = isProse ? "" : loginRaw;

    // A label repeats when a state has several accounts; keep them distinct.
    let key = label;
    for (let i = 2; seen.has(key); i++) key = `${label} (${i})`;
    seen.add(key);

    rows.push({
      state: stateOf(label),
      label: key,
      purpose: scrubSecrets(cell(row, COL.purpose)) || null,
      portalUrl: url,
      loginId: loginId || null,
      licenseNumber: cell(row, COL.license) || null,
      frequency: frequency || null,
      status: statusOf({ blocked: cell(row, COL.blocked), frequency, notes, loginId, url }),
      secretCipher: packSecrets(secretsOf(row, urlCol)),
      notes: scrubSecrets([notes, stray, isProse ? loginRaw : ""].filter(Boolean).join(" - ")),
      sortOrder: n,
    });
  });

  for (const r of rows) {
    await db
      .insert(portals)
      .values(r)
      .onConflictDoUpdate({
        target: portals.label,
        set: { ...r, updatedAt: new Date() },
      });
  }

  const byStatus = rows.reduce<Record<string, number>>((a, r) => {
    a[r.status!] = (a[r.status!] ?? 0) + 1;
    return a;
  }, {});
  console.log(`imported ${rows.length} portal rows`, byStatus);
  console.log(`with a link: ${rows.filter((r) => r.portalUrl).length}`);
  // Counts only - a value from this column must never reach a terminal or a log.
  console.log(`with saved credentials: ${rows.filter((r) => r.secretCipher).length}`);
  console.log(`unmapped state: ${rows.filter((r) => r.state === "--").map((r) => r.label).join(", ") || "none"}`);
  await sql.end();
}

main();
