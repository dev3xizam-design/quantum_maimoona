/**
 * Validates tax_rates against this store's own Avalara history (the answer key).
 *
 * For every (state, zip5, city) in Avalara SALES invoices since 2026-07-01, the
 * Avalara combined rate is SUM(rate) over the jurisdiction rows of a taxable
 * product line (shipping lines excluded; percentage-scaled rates normalised).
 * Our rate is looked up the way the API does: rows for state+zip5, then
 * pickRate({ city, zip4: null }). A second pass also hands pickRate the
 * address's ZIP+4 to show what ZIP+4 rows add.
 *
 *   source dev-db.env && npx tsx scripts/rates/validate-rates.ts            # reads tax_rates
 *   npx tsx scripts/rates/validate-rates.ts --csv                           # reads data/rates/us-tax-rates.csv
 *   npx tsx scripts/rates/validate-rates.ts --csv data/rates/build --only CA # per-state build files
 *
 * The answer key is read from the database in DATABASE_URL (dev branch copy of
 * production) and cached in data/rates/derived/.avalara-key.json (gitignored).
 * Writes data/rates/validation-report.md (unless --only is given, which prints only).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { pickRate, type RateCandidate } from "../../src/lib/tax/rate-lookup";
import { DERIVED, readCsv, ROOT, STATE_NAMES } from "./lib/common";

const SINCE = "2026-07-01";
const KEY_FILE = path.join(DERIVED, ".avalara-key.json");
const REPORT = path.join(ROOT, "data/rates/validation-report.md");
const TOL = 0.0001;

type KeyDoc = { doc: string; date: string; zip4: string | null; rate: number; stateRate: number; taxable: number; comps: { type: string; name: string; rate: number }[] };
type KeyGroup = { state: string; zip5: string; city: string; county: string; docs: KeyDoc[] };

type Row = { state: string; zip5: string; plus4Low: string | null; plus4High: string | null; cityName: string | null; countyName: string | null; isPrimary: boolean; total: number; stateRate: number; prev: number | null; source: string };

/**
 * Some exports store rates as percentages (6.25) and some as decimals (0.0625).
 * Decide per invoice line, not per component: no single jurisdiction exceeds
 * 20%, so a line with any component above 0.2 is in percent - and then its
 * small components (Hennepin 0.15) are percents too.
 */
const lineScale = (rates: number[]) => (rates.some((r) => Math.abs(r) > 0.2) ? 100 : 1);

async function loadKey(refresh: boolean): Promise<KeyGroup[]> {
  if (!refresh && existsSync(KEY_FILE)) return JSON.parse(readFileSync(KEY_FILE, "utf8"));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set (source the dev-db.env first)");
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const rows = await sql<{ document_id: string; line_no: string; state: string; dest_zip: string; dest_city: string; dest_county: string; jurisdiction_type: string; jurisdiction_description: string; rate: string; taxable_amount: string; document_date: Date }[]>`
    SELECT document_id, line_no, state, dest_zip, dest_city, dest_county, jurisdiction_type, jurisdiction_description,
           rate, taxable_amount, document_date
      FROM transactions
     WHERE doc_type = 'Sales Invoice' AND document_date >= ${SINCE}
       AND coalesce(item_code, '') <> 'SHIPPING' AND taxable_amount > 0`;
  await sql.end();
  const lines = new Map<string, (typeof rows)[number][]>();
  for (const r of rows) {
    const k = `${r.document_id}#${r.line_no}`;
    if (!lines.has(k)) lines.set(k, []);
    lines.get(k)!.push(r);
  }
  // per document: the most common line rate (lines of one order share an address)
  const docs = new Map<string, { head: (typeof rows)[number]; rates: Map<number, { n: number; comps: KeyDoc["comps"]; state: number }>; taxable: number }>();
  for (const ls of lines.values()) {
    const h = ls[0];
    const scale = lineScale(ls.map((x) => Number(x.rate)));
    const norm = (r: number) => r / scale;
    const total = Math.round(ls.reduce((s, x) => s + norm(Number(x.rate)), 0) * 1e6) / 1e6;
    const st = ls.filter((x) => x.jurisdiction_type === "State").reduce((s, x) => s + norm(Number(x.rate)), 0);
    const d = docs.get(h.document_id) ?? { head: h, rates: new Map(), taxable: 0 };
    const e = d.rates.get(total) ?? { n: 0, comps: ls.map((x) => ({ type: x.jurisdiction_type, name: x.jurisdiction_description, rate: norm(Number(x.rate)) })), state: st };
    e.n++;
    d.rates.set(total, e);
    d.taxable += Number(h.taxable_amount);
    docs.set(h.document_id, d);
  }
  const groups = new Map<string, KeyGroup>();
  for (const [doc, d] of docs) {
    const h = d.head;
    const zip5 = (h.dest_zip ?? "").slice(0, 5);
    const zip4 = (h.dest_zip ?? "").match(/^\d{5}-?(\d{4})$/)?.[1] ?? null;
    const [rate, best] = [...d.rates].sort((a, b) => b[1].n - a[1].n)[0];
    const k = `${h.state}|${zip5}|${(h.dest_city ?? "").toUpperCase()}`;
    const g = groups.get(k) ?? { state: h.state, zip5, city: (h.dest_city ?? "").toUpperCase(), county: h.dest_county ?? "", docs: [] };
    g.docs.push({ doc, date: new Date(h.document_date).toISOString().slice(0, 10), zip4, rate, stateRate: Math.round(best.state * 1e6) / 1e6, taxable: d.taxable, comps: best.comps });
    groups.set(k, g);
  }
  const out = [...groups.values()].sort((a, b) => (a.state + a.zip5 + a.city < b.state + b.zip5 + b.city ? -1 : 1));
  writeFileSync(KEY_FILE, JSON.stringify(out));
  return out;
}

async function loadOurs(csv: string | null, only: string[] | null): Promise<Map<string, Row[]>> {
  const m = new Map<string, Row[]>();
  const push = (r: Row) => {
    const k = `${r.state}|${r.zip5}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  };
  if (csv) {
    const files = existsSync(csv) && !csv.endsWith(".csv") ? readdirSync(csv).filter((f) => /^[A-Z]{2}\.csv$/.test(f)).map((f) => path.join(csv, f)) : [csv];
    for (const f of files) {
      if (only && !only.includes(path.basename(f, ".csv")) && f.endsWith(`${path.basename(f)}`) && /\/[A-Z]{2}\.csv$/.test(f)) continue;
      for (const r of readCsv(f)) {
        if (only && !only.includes(r.state)) continue;
        push({
          state: r.state, zip5: r.zip5, plus4Low: r.plus4_low || null, plus4High: r.plus4_high || null, cityName: r.city_name || null, countyName: r.county_name || null,
          isPrimary: r.is_primary === "true", total: Number(r.total_rate), stateRate: Number(r.state_rate), prev: r.prev_total_rate === "" || r.prev_total_rate == null ? null : Number(r.prev_total_rate), source: r.source,
        });
      }
    }
    return m;
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const rows = await sql<{ state: string; zip5: string; plus4_low: string | null; plus4_high: string | null; city_name: string | null; county_name: string | null; is_primary: boolean; total_rate: string; state_rate: string; source: string }[]>`
    SELECT state, zip5, plus4_low, plus4_high, city_name, county_name, is_primary, total_rate, state_rate, source FROM tax_rates`;
  await sql.end();
  for (const r of rows) {
    if (only && !only.includes(r.state)) continue;
    push({ state: r.state, zip5: r.zip5, plus4Low: r.plus4_low, plus4High: r.plus4_high, cityName: r.city_name, countyName: r.county_name, isPrimary: r.is_primary, total: Number(r.total_rate), stateRate: Number(r.state_rate), prev: null, source: r.source });
  }
  // prev_total_rate is not a table column; borrow it from the CSV when present
  const csvFile = path.join(ROOT, "data/rates/us-tax-rates.csv");
  if (existsSync(csvFile)) {
    const prev = new Map<string, number>();
    for (const r of readCsv(csvFile)) if (r.prev_total_rate) prev.set(`${r.state}|${r.zip5}|${r.plus4_low}|${r.city_name}|${r.county_name}`, Number(r.prev_total_rate));
    for (const rs of m.values()) for (const r of rs) r.prev = prev.get(`${r.state}|${r.zip5}|${r.plus4Low ?? ""}|${r.cityName ?? ""}|${r.countyName ?? ""}`) ?? null;
  }
  return m;
}

type Cls = "match" | "missing_zip" | "oct1_change" | "other_row_in_zip" | "state_rate_differs" | "unexplained";

async function main() {
  const args = process.argv.slice(2);
  const csvIdx = args.indexOf("--csv");
  const csv = csvIdx >= 0 ? (args[csvIdx + 1] && !args[csvIdx + 1].startsWith("--") ? path.resolve(args[csvIdx + 1]) : path.join(ROOT, "data/rates/us-tax-rates.csv")) : null;
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
  const key = (await loadKey(args.includes("--refresh-key"))).filter((g) => g.state in STATE_NAMES && (!only || only.includes(g.state)));
  const ours = await loadOurs(csv, only);

  type Res = { g: KeyGroup; avalara: number; ours: number | null; cls: Cls; impact: number; zip4Match: boolean; matchedBy: string; detail: string; varied: boolean };
  const results: Res[] = [];
  for (const g of key) {
    const latest = g.docs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const avalara = latest.rate;
    const varied = new Set(g.docs.map((d) => d.rate)).size > 1;
    const taxable = g.docs.reduce((s, d) => s + d.taxable, 0);
    const rows = ours.get(`${g.state}|${g.zip5}`) ?? [];
    const cands: RateCandidate<Row>[] = rows.map((r) => ({ zip5: r.zip5, plus4Low: r.plus4Low, plus4High: r.plus4High, cityName: r.cityName, countyName: r.countyName, isPrimary: r.isPrimary, row: r }));
    const pick = pickRate(cands, { city: g.city, zip4: null });
    // zip4-aware: every document with its own plus4
    let zip4Match = true;
    for (const d of g.docs) {
      const p = pickRate(cands, { city: g.city, zip4: d.zip4 });
      if (!p || Math.abs(p.row.row.total - d.rate) > TOL) zip4Match = false;
    }
    if (!pick) {
      results.push({ g, avalara, ours: null, cls: "missing_zip", impact: taxable * avalara, zip4Match: false, matchedBy: "-", detail: "", varied });
      continue;
    }
    const o = pick.row.row;
    const diff = o.total - avalara;
    let cls: Cls = "match";
    let detail = "";
    if (Math.abs(diff) > TOL) {
      if (o.prev != null && Math.abs(o.prev - avalara) <= TOL) cls = "oct1_change";
      else if (Math.abs(o.stateRate - latest.stateRate) > TOL) {
        cls = "state_rate_differs";
        detail = `state ${o.stateRate} vs Avalara ${latest.stateRate}`;
      } else if (rows.some((r) => Math.abs(r.total - avalara) <= TOL)) {
        cls = "other_row_in_zip";
        const r = rows.find((x) => Math.abs(x.total - avalara) <= TOL)!;
        detail = `row ${r.cityName ?? "(no city)"}/${r.countyName ?? ""}${r.plus4Low ? ` +4 ${r.plus4Low}-${r.plus4High}` : ""}`;
      } else cls = "unexplained";
    }
    results.push({ g, avalara, ours: o.total, cls, impact: taxable * Math.abs(diff), zip4Match, matchedBy: pick.matchedBy, detail, varied });
  }

  // ---- report
  const states = [...new Set(results.map((r) => r.g.state))].sort();
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");
  const L: string[] = [];
  const total = results.length, matched = results.filter((r) => r.cls === "match").length;
  const z4 = results.filter((r) => r.zip4Match).length;
  const explained = results.filter((r) => r.cls === "oct1_change").length;
  L.push("# tax_rates validation against Avalara history", "");
  L.push(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC from ${csv ? path.relative(ROOT, csv) : "the tax_rates table"}. Answer key: Avalara Sales Invoices since ${SINCE}, one (state, ZIP5, city) per line below, Avalara rate = latest invoice's combined rate on taxable product lines.`, "");
  L.push(`**Overall: ${matched} / ${total} (state, ZIP, city) keys match within ${TOL} (${pct(matched, total)}).** With the Oct-1 rate changes counted as expected: ${pct(matched + explained, total)}. With the invoice's ZIP+4 passed to pickRate: ${z4} / ${total} (${pct(z4, total)}).`, "");
  const byCls = (c: Cls) => results.filter((r) => r.cls === c);
  L.push("| class | keys | $ impact (taxable x rate diff) |", "|---|---:|---:|");
  for (const c of ["match", "oct1_change", "other_row_in_zip", "state_rate_differs", "unexplained", "missing_zip"] as Cls[])
    L.push(`| ${c} | ${byCls(c).length} | ${byCls(c).reduce((s, r) => s + r.impact, 0).toFixed(2)} |`);
  L.push("", "Classes: `oct1_change` = our row's 2026-07-01 rate equals Avalara (a rate changed on 2026-10-01, after these invoices); `other_row_in_zip` = another row of the same ZIP has Avalara's rate (address-level boundary vs our ZIP/city pick); `state_rate_differs` = the state component itself differs; `missing_zip` = no row for the ZIP.", "");
  L.push("## Per state", "", "| state | keys | match | match % | +ZIP4 | oct1 | other row | state differs | unexplained | missing | biggest $ miss | source |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|");
  for (const s of states) {
    const rs = results.filter((r) => r.g.state === s);
    const m = rs.filter((r) => r.cls === "match").length;
    const worst = rs.filter((r) => r.cls !== "match").sort((a, b) => b.impact - a.impact)[0];
    const src = [...new Set(rs.map((r) => (ours.get(`${r.g.state}|${r.g.zip5}`) ?? [])[0]?.source).filter(Boolean))][0] ?? "";
    const c = (k: Cls) => rs.filter((r) => r.cls === k).length;
    L.push(`| ${s} | ${rs.length} | ${m} | ${pct(m, rs.length)} | ${rs.filter((r) => r.zip4Match).length} | ${c("oct1_change")} | ${c("other_row_in_zip")} | ${c("state_rate_differs")} | ${c("unexplained")} | ${c("missing_zip")} | ${worst ? `${worst.g.zip5} ${worst.g.city} $${worst.impact.toFixed(2)}` : ""} | ${src.slice(0, 60)} |`);
  }
  L.push("", "## Every mismatch", "", "| state | zip | city | Avalara | ours | diff | class | picked by | invoices | $ impact | detail |", "|---|---|---|---:|---:|---:|---|---|---:|---:|---|");
  for (const r of results.filter((x) => x.cls !== "match").sort((a, b) => (a.g.state === b.g.state ? b.impact - a.impact : a.g.state < b.g.state ? -1 : 1)))
    L.push(`| ${r.g.state} | ${r.g.zip5} | ${r.g.city} | ${r.avalara.toFixed(5)} | ${r.ours == null ? "-" : r.ours.toFixed(5)} | ${r.ours == null ? "-" : (r.ours - r.avalara).toFixed(5)} | ${r.cls} | ${r.matchedBy} | ${r.g.docs.length}${r.varied ? " (Avalara rate varied)" : ""} | ${r.impact.toFixed(2)} | ${r.detail} |`);
  const text = L.join("\n") + "\n";
  if (only) console.log(text.split("## Every mismatch")[0] + (args.includes("--verbose") ? "## Every mismatch" + text.split("## Every mismatch")[1] : ""));
  else {
    const notesFile = path.join(ROOT, "data/rates/validation-notes.md");
    writeFileSync(REPORT, text + (existsSync(notesFile) ? "\n" + readFileSync(notesFile, "utf8") : ""));
    console.log(`overall ${matched}/${total} (${pct(matched, total)}), zip4-aware ${pct(z4, total)} -> ${path.relative(ROOT, REPORT)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
