/**
 * Texas local sales/use tax from the Comptroller's own current publications,
 * saved under data/rates/raw/TX/ (see data/rates/sources/TX.md):
 *   city-rates-Oct26.xlsx  comptroller.texas.gov/taxes/sales/docs/city-rates.xlsx, sheet "Oct26":
 *                          one row per (place, county portion) with every tax that applies there -
 *                          city, county, up to 3 SPDs, 2 transit - and the total
 *   spd.html               /taxes/sales/spd.php  (SPD codes, rates, effective dates, boundary type)
 *   mta.html               /taxes/sales/mta.php  (transit authorities + the unincorporated areas they cover)
 *
 * Per Census piece:
 *  - a place (city or CDP) that has its own row in the rate file for the piece's
 *    county: that row, component by component;
 *  - anywhere else: State + the county's tax (as the rate file reports it for that
 *    county) + countywide SPDs + a transit authority that covers the county's
 *    unincorporated area.
 * "Other"-boundary SPDs (most ESDs) and combined areas ("City/ESD" rows) follow
 * lines Census geography doesn't carry, so they are not applied - those
 * addresses rate low. Local tax is capped at 2% (the file's totals already are).
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { AS_OF, AS_OF_NUM, rawFile, mustExist, round6, type Juris, type StateBuild } from "../lib/common";
import { zipRowsFromPieces, type Piece } from "../lib/geo";
import { nameKey } from "./_tx-az-nm-util";

const STATE_RATE = 0.0625;
const LOCAL_CAP = 0.02;
const RATE_FILE = "city-rates-Oct26.xlsx";

/** Unincorporated areas a transit authority covers only in part ("parts of ... Travis County") - included. */
const PARTIAL_UNINCORPORATED_INCLUDED = true;

type Part = { type: Juris["type"]; name: string; code: string | null; rate: number };
type FileRow = { place: string; county: string; isCity: boolean; parts: Part[]; total: number };

const clean = (v: unknown) => String(v ?? "").trim();
const isNa = (v: unknown) => /^n\/a$/i.test(clean(v)) || clean(v) === "";

async function readRateFile(): Promise<FileRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(mustExist(rawFile("TX", RATE_FILE)));
  const ws = wb.worksheets[0];
  const head = (ws.getRow(1).values as unknown[]).map(clean);
  const col = (n: string) => head.indexOf(n);
  const out: FileRow[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.values as unknown[];
    const get = (n: string) => v[col(n)];
    const place = clean(get("CityName"));
    if (!place || /^End of Worksheet/i.test(place)) return;
    const parts: Part[] = [];
    const add = (type: Part["type"], name: string, num: string, tax: string) => {
      const r = Number(get(tax)) || 0;
      if (r > 0) parts.push({ type, name: clean(get(name)), code: isNa(get(num)) ? null : clean(get(num)), rate: r });
    };
    const isCity = !isNa(get("CityNumber"));
    if (isCity) add("City", "CityName", "CityNumber", "CityTax");
    add("County", "CountyName", "CountyNumber", "CountyTax");
    add("Special", "SPDName", "SPDNumber", "SPDTax");
    add("Special", "SPD2Name", "SPD2Number", "SPD2Tax");
    add("Special", "SPD3Name", "SPD3Number", "SPD3Tax");
    add("Special", "TransitName", "TransitNumber", "TransitTax");
    add("Special", "Transit2Name", "Transit2Number", "Transit2Tax");
    for (const p of parts) if (p.type === "County") p.name = `${p.name} County`;
    out.push({ place, county: clean(get("CountyName")), isCity, parts, total: Number(get("TotalTax")) || 0 });
  });
  return out;
}

const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#039;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();
const mdy = (s: string) => {
  const m = s.match(/(\d\d)\/(\d\d)\/(\d\d)/);
  return m ? Number(`20${m[3]}${m[1]}${m[2]}`) : 0;
};

/** spd.php "listed by county" table: countywide SPDs in force on AS_OF, by county key. */
function countywideSpds(): Map<string, Part[]> {
  const html = readFileSync(mustExist(rawFile("TX", "spd.html")), "utf8");
  const m = new Map<string, Part[]>();
  const seen = new Set<string>();
  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const c = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(text);
    if (c.length < 6 || c[5] !== "Countywide" || !/^5\d{6}$/.test(c[2]) || mdy(c[4]) > AS_OF_NUM || seen.has(c[2])) continue;
    seen.add(c[2]);
    const k = nameKey(c[0].replace(/♦/g, ""));
    const a = m.get(k) ?? [];
    a.push({ type: "Special", name: c[1], code: c[2], rate: Number(c[3]) });
    m.set(k, a);
  }
  return m;
}

/** mta.php: each authority's rate and the counties whose unincorporated area it covers. */
function transitUnincorporated(): { part: Part; full: Set<string>; partial: Set<string> }[] {
  const html = readFileSync(mustExist(rawFile("TX", "mta.html")), "utf8");
  const out: { part: Part; full: Set<string>; partial: Set<string> }[] = [];
  for (const d of html.match(/<details>[\s\S]*?<\/details>/g) ?? []) {
    const name = text(d.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "");
    const code = d.match(/Local code<\/strong>\s*-\s*(\d{7})/)?.[1] ?? null;
    const rate = Number(d.match(/\(\.(\d+)\)/)?.[1] ? `0.${d.match(/\(\.(\d+)\)/)![1]}` : NaN);
    if (!code || !(rate > 0)) continue;
    const full = new Set<string>(), partial = new Set<string>();
    for (const item of (d.match(/<li>[\s\S]*?<\/li>/g) ?? []).map(text)) {
      // drop exclusion sentences ("The portion of the Woodlands Township ... is not in the Houston MTA.")
      const li = item.split(/(?<=\.)\s+/).filter((x) => !/not in the|withdr/i.test(x)).join(" ");
      if (!/unincorporated/i.test(li)) continue;
      const f = li.match(/^The unincorporated areas? of ([A-Z][a-z]+(?: [A-Z][a-z]+)?) County\.?$/);
      if (f) full.add(nameKey(f[1]));
      else for (const c of li.matchAll(/(\w+) County/g)) partial.add(nameKey(c[1]));
    }
    out.push({ part: { type: "Special", name, code, rate }, full, partial });
  }
  return out;
}

const better = (a: FileRow, b: FileRow) => (a.isCity !== b.isCity ? a.isCity : a.parts.length < b.parts.length);

export async function build(): Promise<StateBuild> {
  const file = await readRateFile();
  // place rows by (place, county); combined-area / sub-area rows ("City/ESD", "City (1)") are not places
  const places = new Map<string, FileRow>();
  /** a city's row from any county - for a Census county portion the file doesn't list (e.g. Garland in Rockwall) */
  const cityAnyCounty = new Map<string, FileRow>();
  const countyRate = new Map<string, Map<number, number>>();
  for (const r of file) {
    const ck = nameKey(r.county);
    const c = r.parts.find((p) => p.type === "County")?.rate ?? 0;
    const cm = countyRate.get(ck) ?? new Map<number, number>();
    cm.set(c, (cm.get(c) ?? 0) + 1);
    countyRate.set(ck, cm);
    if (/[/(]/.test(r.place)) continue;
    // several rows per (place, county): the base area first, then sub-areas inside "Other" SPDs, and
    // sometimes an unincorporated row of the same name. Keep the base: a city row over a non-city
    // row, then the fewest taxes (no partial-area SPD), then the first listed.
    const k = `${nameKey(r.place)}#${ck}`;
    const cur = places.get(k);
    if (!cur || better(r, cur)) places.set(k, r);
    const ak = nameKey(r.place);
    const ca = cityAnyCounty.get(ak);
    if (r.isCity && (!ca || better(r, ca))) cityAnyCounty.set(ak, r);
  }
  const countyPart = new Map<string, Part | null>();
  for (const [ck, cm] of countyRate) {
    const rate = [...cm].sort((a, b) => b[1] - a[1])[0][0];
    const name = file.find((r) => nameKey(r.county) === ck)!.county;
    const code = file.find((r) => nameKey(r.county) === ck && r.parts.some((p) => p.type === "County"))?.parts.find((p) => p.type === "County")?.code ?? null;
    countyPart.set(ck, rate > 0 ? { type: "County", name: `${name} County`, code, rate } : null);
  }
  const cwSpd = countywideSpds();
  const transit = transitUnincorporated();

  const notes: string[] = [];
  const cityNoRow = new Set<string>();
  const fromOtherCounty = new Set<string>();
  let fromFile = 0, fromCounty = 0, capped = 0;

  function cap(j: Juris[]) {
    let local = round6(j.filter((x) => x.type !== "State").reduce((s, x) => s + x.rate, 0));
    if (local <= LOCAL_CAP + 1e-9) return j;
    capped++;
    const out = [...j];
    for (let i = out.length - 1; i >= 0 && local > LOCAL_CAP + 1e-9; i--) {
      if (out[i].type !== "Special") continue;
      const cut = Math.min(out[i].rate, round6(local - LOCAL_CAP));
      out[i] = { ...out[i], rate: round6(out[i].rate - cut) };
      local = round6(local - cut);
    }
    return out.filter((x) => x.type === "State" || x.rate > 0);
  }

  function rate(p: Piece) {
    const ck = nameKey(p.countyName);
    const st: Juris = { type: "State", name: "Texas", code: "TX", rate: STATE_RATE };
    const row = p.placeType !== "none" ? places.get(`${nameKey(p.placeName)}#${ck}`) : undefined;
    // an incorporated city with its own row; a CDP row only when it carries no city tax
    if (row && (p.placeType === "incorporated" || !row.isCity)) {
      fromFile++;
      return { jurisdictions: cap([st, ...row.parts]), cityName: p.placeName, effectiveFrom: AS_OF };
    }
    // a city portion in a county the file doesn't list: the city's own taxes + this county's
    const other = p.placeType === "incorporated" ? cityAnyCounty.get(nameKey(p.placeName)) : undefined;
    if (other) {
      fromOtherCounty.add(`${p.placeName} (${p.countyName})`);
      const c = countyPart.get(ck);
      const own = other.parts.filter((x) => x.type !== "County" && !/county|co\b/i.test(x.name));
      return { jurisdictions: cap([st, ...(c ? [c] : []), ...own]), cityName: p.placeName, effectiveFrom: AS_OF };
    }
    if (p.placeType === "incorporated") cityNoRow.add(`${p.placeName} (${p.countyName})`);
    fromCounty++;
    const j: Juris[] = [st];
    const c = countyPart.get(ck);
    if (c) j.push(c);
    j.push(...(cwSpd.get(ck) ?? []));
    if (p.placeType !== "incorporated")
      for (const t of transit) if (t.full.has(ck) || (PARTIAL_UNINCORPORATED_INCLUDED && t.partial.has(ck))) j.push(t.part);
    return { jurisdictions: cap(j), cityName: p.placeType === "none" ? null : p.placeName, effectiveFrom: AS_OF };
  }

  const source = `TX Comptroller ${RATE_FILE} (Oct 2026) + spd.php + mta.php, Census 2020 ZCTA pieces`;
  const { rows, unrated } = zipRowsFromPieces("TX", source, rate);
  notes.push(`${fromFile} pieces rated from a place row, ${fromCounty} from county + countywide SPD + transit`);
  if (unrated.length) notes.push(`${unrated.length} pieces unrated`);
  if (fromOtherCounty.size) notes.push(`${fromOtherCounty.size} city portions in a county the file doesn't list (city taxes from its other county row): ${[...fromOtherCounty].slice(0, 10).join("; ")}`);
  if (cityNoRow.size) notes.push(`${cityNoRow.size} incorporated places with no row in the rate file (rated as unincorporated), e.g. ${[...cityNoRow].slice(0, 8).join("; ")}`);
  if (capped) notes.push(`${capped} pieces trimmed to the 2% local cap`);
  return { state: "TX", source, rows, notes };
}
