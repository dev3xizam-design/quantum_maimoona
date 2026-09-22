/**
 * Import the "Active Multi State" tracker into the portal directory.
 *
 *   npx tsx --conditions=react-server scripts/import-portals.ts "<path to .xlsx>"
 *
 * The tracker keeps passwords, PINs and security-question answers next to the
 * useful columns. This reads ONLY the non-secret ones -- label, frequency,
 * purpose, license number, login id, portal link, notes -- and never touches
 * the password column or the free-text columns that carry the security
 * answers. Nothing secret is read, so nothing secret can be stored.
 */
import "../src/lib/load-env";
import ExcelJS from "exceljs";
import { db, sql } from "../src/db";
import { portals } from "../src/db/schema";
import { scrubSecrets } from "../src/lib/scrub-secrets";

/** Columns in the tracker, 1-indexed. Anything not listed is never read. */
const COL = { label: 4, blocked: 5, frequency: 6, purpose: 7, notes: 8, license: 9, loginId: 11 };
/** The link is usually col 13, but a few rows are shifted one to the right. */
const LINK_SEARCH = [13, 14, 15, 16];

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

function linkOf(row: ExcelJS.Row): { url: string | null; stray: string | null } {
  let stray: string | null = null;
  for (const n of LINK_SEARCH) {
    const c = row.getCell(n);
    const href = typeof c.hyperlink === "string" ? c.hyperlink : null;
    const text = cell(row, n);
    const url = href && /^https?:/i.test(href) ? href : /^https?:/i.test(text) ? text : null;
    if (url) return { url, stray };
    // Column 13 holding something that is not a link is still worth keeping.
    if (n === 13 && text && !stray) stray = text;
  }
  return { url: null, stray };
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

    const { url, stray } = linkOf(row);
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
  console.log(`unmapped state: ${rows.filter((r) => r.state === "--").map((r) => r.label).join(", ") || "none"}`);
  await sql.end();
}

main();
