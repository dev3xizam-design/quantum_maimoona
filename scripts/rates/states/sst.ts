/**
 * Streamlined Sales Tax member states: rate file + boundary file published at
 * https://www.streamlinedsalestax.org/ratesandboundry/{Rates,Boundary}/ (format:
 * SST "Rate and Boundary Files" spec, Appendix C/D).
 *
 * Boundary record types: "A" address range (carries ZIP + plus4 + postal city),
 * "4" ZIP+4 range, "Z" ZIP5 range. Each record names a state, county FIPS, place
 * FIPS, an optional composite SER code (WA location code) and up to 20 special
 * districts as (class, code, type) triplets. The rate file gives a rate per
 * (jurisdiction type, code) with begin/end dates.
 *
 * Output per ZIP5:
 *  - ZIP5 rows: one per distinct rate area, weighted by Census 2020 population of
 *    the (ZIP, county, place) piece the record names (falling back to the number
 *    of plus4 codes the area covers), heaviest = is_primary.
 *  - ZIP+4 rows (plus4_low/high) only when the ZIP holds more than one rate,
 *    adjacent plus4 codes with the same rate merged into one range.
 */
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { createReadStream, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  AS_OF,
  AS_OF_NUM,
  isoDate,
  normCity,
  RATE_CHANGES,
  RAW,
  rawFile,
  round6,
  signature,
  STATE_NAMES,
  type Juris,
  type RateRow,
} from "../lib/common";
import { pieceWeight, rollUpZip, statePieces, type Piece } from "../lib/geo";
import { directoryNames } from "../lib/directory";

const PREV_NUM = 20260701; // the quarter the Avalara answer key mostly covers

type RateEntry = { rate: number; begin: number; end: number };

function sstFiles(state: string) {
  const dir = path.join(RAW, state, "sst");
  const ls = () => readdirSync(dir);
  // extract any zip whose csv is missing (the zips are what streamlinedsalestax.org serves)
  for (const z of ls().filter((f) => /\.zip$/i.test(f))) {
    const base = z.replace(/\.zip$/i, "");
    if (!ls().some((f) => f.toUpperCase().startsWith(base.toUpperCase()) && /\.(csv|txt)$/i.test(f)))
      execFileSync("unzip", ["-o", "-q", z, "-d", "."], { cwd: dir });
  }
  const pick = (kind: "R" | "B") => {
    const f = ls()
      .filter((x) => new RegExp(`^${state}${kind}\\d{4}Q\\d.*\\.(csv|txt)$`, "i").test(x))
      .sort()
      .pop();
    if (!f) throw new Error(`${state}: no SST ${kind === "R" ? "rate" : "boundary"} file in ${dir}`);
    return path.join(dir, f);
  };
  return { rate: pick("R"), boundary: pick("B") };
}

async function* lines(file: string) {
  const rl = readline.createInterface({ input: createReadStream(file, { encoding: "latin1" }), crlfDelay: Infinity });
  for await (const l of rl) yield l.replace(/^﻿/, "").replace(/^ï»¿/, "");
}

const typeKey = (t: string) => String(Number(t));

/** One rate area, by component identity (not by rate). */
type Area = { county: string; place: string; ser: string; specials: string[] /* "type|code" */ };
const areaKey = (a: Area) => `${a.county}/${a.place}/${a.ser}/${a.specials.join(",")}`;

export async function buildSst(state: string): Promise<{ rows: RateRow[]; source: string; notes: string[] }> {
  const files = sstFiles(state);
  const notes: string[] = [];
  const stateName = STATE_NAMES[state];

  // ---- rates
  const rates = new Map<string, RateEntry[]>();
  const byCode63 = new Map<string, string>(); // composite-SER lookups (WA: "L" + 4-digit location code)
  for await (const l of lines(files.rate)) {
    const f = l.split(",");
    if (f.length < 9 || !/^\d+$/.test(f[0])) continue;
    const key = `${typeKey(f[1])}|${f[2].trim()}`;
    const e = { rate: Number(f[4]), begin: Number(f[7]), end: Number(f[8]) };
    if (!rates.has(key)) rates.set(key, []);
    rates.get(key)!.push(e);
    byCode63.set(f[2].trim(), key);
  }
  const rateAt = (key: string, when: number) => rates.get(key)?.find((e) => e.begin <= when && when <= e.end);

  // ---- boundary
  const areas = new Map<string, Area>();
  const zRanges: { lo: number; hi: number; area: string }[] = [];
  const seg = new Map<string, { lo: number; hi: number; area: string; point: boolean }[]>(); // zip -> plus4 segments
  const zipNoPlus4 = new Map<string, Map<string, number>>(); // A records without plus4
  const postal = new Map<string, Map<string, number>>(); // `${zip}#${area}` -> postal city counts
  let n = 0, used = 0;
  for await (const l of lines(files.boundary)) {
    n++;
    const f = l.split(",");
    const t = f[0].toUpperCase();
    if (t !== "A" && t !== "4" && t !== "Z") continue;
    const begin = Number(f[1]), end = Number(f[2]);
    if (!(begin <= AS_OF_NUM && AS_OF_NUM <= end)) continue;
    used++;
    const specials: string[] = [];
    for (let i = 29; i + 2 < f.length && i < 29 + 60; i += 3) {
      const code = (f[i + 1] ?? "").trim(), type = (f[i + 2] ?? "").trim();
      if (code) specials.push(`${typeKey(type || "0")}|${code}`);
    }
    const area: Area = { county: (f[24] ?? "").trim(), place: (f[25] ?? "").trim(), ser: (f[21] ?? "").trim(), specials: specials.sort() };
    const ak = areaKey(area);
    areas.set(ak, area);
    if (t === "Z") {
      zRanges.push({ lo: Number(f[17]), hi: Number(f[19] || f[17]), area: ak });
    } else if (t === "4") {
      const zip = f[17].padStart(5, "0");
      const zipHi = (f[19] || f[17]).padStart(5, "0");
      if (zip !== zipHi) {
        // a 4 record spanning ZIPs: treat as whole-ZIP ranges
        for (let z = Number(zip); z <= Number(zipHi); z++) zRanges.push({ lo: z, hi: z, area: ak });
        continue;
      }
      const lo = Number(f[18] || 0), hi = Number(f[20] || 9999);
      if (!seg.has(zip)) seg.set(zip, []);
      seg.get(zip)!.push({ lo, hi, area: ak, point: false });
    } else {
      const zip = (f[15] ?? "").trim().padStart(5, "0");
      if (!/^\d{5}$/.test(zip) || zip === "00000") continue;
      const p4 = (f[16] ?? "").trim();
      const city = (f[14] ?? "").trim();
      if (city) {
        const pk = `${zip}#${ak}`;
        if (!postal.has(pk)) postal.set(pk, new Map());
        const m = postal.get(pk)!;
        m.set(city, (m.get(city) ?? 0) + 1);
      }
      if (/^\d{4}$/.test(p4)) {
        if (!seg.has(zip)) seg.set(zip, []);
        seg.get(zip)!.push({ lo: Number(p4), hi: Number(p4), area: ak, point: true });
      } else {
        if (!zipNoPlus4.has(zip)) zipNoPlus4.set(zip, new Map());
        const m = zipNoPlus4.get(zip)!;
        m.set(ak, (m.get(ak) ?? 0) + 1);
      }
    }
  }
  notes.push(`boundary ${path.basename(files.boundary)}: ${n.toLocaleString()} records, ${used.toLocaleString()} in force on ${AS_OF}`);

  // ---- names
  const pieces = statePieces(state);
  const placeNames = new Map<string, string>(), countyNames = new Map<string, string>();
  for (const p of pieces) {
    if (p.placeFips) placeNames.set(p.placeFips, p.placeName);
    countyNames.set(p.countyFips, p.countyName);
  }
  const dir = directoryNames(state);
  const missingRates = new Set<string>();
  const waRates = state === "WA" ? { now: await waRateTable("Q426"), prev: await waRateTable("Q326") } : null;
  if (waRates) notes.push(`local rates from WA DOR Q426_Excel_LSU-rates-alpha.xlsx (${waRates.now.size} location codes, effective 2026-10-01)`);

  const jurCache = new Map<string, { j: Juris[]; prev: number; from: string; to: string | null }>();
  const juris = (ak: string) => {
    const hit = jurCache.get(ak);
    if (hit) return hit;
    const a = areas.get(ak)!;
    const j: Juris[] = [];
    let prev = 0, from = "1900-01-01", to: string | null = null;
    const add = (type: Juris["type"], key: string, name: string, code: string) => {
      const e = rateAt(key, AS_OF_NUM);
      if (!e) {
        missingRates.add(key);
        return;
      }
      const p = rateAt(key, PREV_NUM);
      prev += p ? p.rate : 0;
      if (p?.rate !== e.rate && e.begin > PREV_NUM)
        RATE_CHANGES.push({ state, jurisdiction: `${name} (${key})`, from: p?.rate ?? null, to: e.rate, effective: isoDate(e.begin)! });
      const b = isoDate(e.begin)!;
      if (b > from) from = b;
      const en = isoDate(e.end);
      if (en && (!to || en < to)) to = en;
      j.push({ type, name, code, rate: round6(e.rate) });
    };
    const stateFips = [...rates.keys()].find((k) => k.startsWith("45|"));
    if (stateFips) add("State", stateFips, stateName, state);
    const serKey = a.ser ? (rates.has(`63|${a.ser}`) ? `63|${a.ser}` : byCode63.get(`L${a.ser.slice(-4)}`)) : undefined;
    const waLoc = waRates && a.ser ? waRates.now.get(Number(a.ser.slice(-4))) : undefined;
    if (waLoc) {
      // WA: the DOR's own rate table gives the whole local rate per location code. The SST rate
      // file's L-code entry does not (unincorporated PTBA codes carry only the PTBA increment).
      const was = waRates!.prev.get(Number(a.ser.slice(-4)));
      prev += was ? was.local : waLoc.local;
      if (was && was.local !== waLoc.local)
        RATE_CHANGES.push({ state, jurisdiction: `${waLoc.name} (${a.ser.slice(-4)})`, from: was.local, to: waLoc.local, effective: AS_OF });
      from = AS_OF;
      j.push({ type: a.place ? "City" : "County", name: waLoc.name, code: a.ser.slice(-4), rate: waLoc.local });
    } else if (serKey && rates.has(serKey)) {
      // composite SER code (WA location code) carries the whole local rate
      const code = serKey.split("|")[1];
      const nm = dir.get(code.replace(/^L/, "")) ?? dir.get(code) ?? `${placeNames.get(a.place) ?? countyNames.get(a.county) ?? "Location"} ${code}`;
      add(a.place ? "City" : "County", serKey, nm, code);
    } else {
      if (a.county) add("County", `0|${a.county}`, `${countyNames.get(a.county) ?? a.county} County`, a.county);
      if (a.place) add("City", `1|${a.place}`, placeNames.get(a.place) ?? dir.get(a.place) ?? a.place, a.place);
      for (const s of a.specials) {
        const [, code] = s.split("|");
        add("Special", s, dir.get(code) ?? `Special district ${s.replace("|", "-")}`, s.replace("|", "-"));
      }
    }
    const v = { j, prev: round6(prev), from, to };
    jurCache.set(ak, v);
    return v;
  };

  // ---- Census weights per (zip, county, place)
  const censusByZip = new Map<string, Piece[]>();
  for (const p of pieces) {
    if (!censusByZip.has(p.zip)) censusByZip.set(p.zip, []);
    censusByZip.get(p.zip)!.push(p);
  }
  // Counties where the boundary file codes places at all. Elsewhere (e.g. all of NV) an area
  // without a place covers the incorporated cities too, so their population must count.
  const placeCoded = [...areas.values()].filter((a) => a.place || a.ser);
  const countiesWithPlaces = new Set(placeCoded.map((a) => a.county));
  if (placeCoded.some((a) => !a.county)) for (const p of pieces) countiesWithPlaces.add(p.countyFips); // TN: city areas carry no county
  const censusWeight = (zip: string, a: Area) => {
    let w = 0;
    for (const p of censusByZip.get(zip) ?? []) {
      if (a.county && p.countyFips !== a.county) continue;
      if (a.place ? p.placeFips !== a.place : countiesWithPlaces.has(a.county) && p.placeType === "incorporated") continue;
      w += pieceWeight(p);
    }
    return w;
  };
  const cdpName = (zip: string, a: Area) => {
    let best: Piece | null = null;
    for (const p of censusByZip.get(zip) ?? [])
      if (p.placeType === "cdp" && (!a.county || p.countyFips === a.county) && (!best || p.pop > best.pop)) best = p;
    return best?.placeName ?? null;
  };
  const label = (zip: string, ak: string) => {
    const a = areas.get(ak)!;
    if (a.place) return cleanPlaceName(placeNames.get(a.place) ?? dir.get(a.place) ?? null);
    const pc = postal.get(`${zip}#${ak}`);
    if (pc) return [...pc].sort((x, y) => y[1] - x[1])[0][0];
    return cdpName(zip, a);
  };

  // ---- ZIP universe
  const zips = new Set<string>([...seg.keys(), ...zipNoPlus4.keys()]);
  const censusZips = new Set(pieces.map((p) => p.zip));
  const zFor = new Map<string, string>();
  for (const r of zRanges) {
    if (r.hi - r.lo > 50) {
      for (const z of censusZips) if (Number(z) >= r.lo && Number(z) <= r.hi && !zFor.has(z)) zFor.set(z, r.area);
    } else for (let z = r.lo; z <= r.hi; z++) if (!zFor.has(String(z).padStart(5, "0"))) zFor.set(String(z).padStart(5, "0"), r.area);
  }
  for (const z of zFor.keys()) zips.add(z);

  const source = `SST ${path.basename(files.rate)} + ${path.basename(files.boundary)}`;
  const rows: RateRow[] = [];
  let plus4Rows = 0;
  for (const zip of [...zips].sort()) {
    const counts = new Map<string, number>();
    for (const s of seg.get(zip) ?? []) counts.set(s.area, (counts.get(s.area) ?? 0) + (s.hi - s.lo + 1));
    for (const [ak, c] of zipNoPlus4.get(zip) ?? []) counts.set(ak, (counts.get(ak) ?? 0) + c);
    if (!counts.size && zFor.has(zip)) counts.set(zFor.get(zip)!, 1);
    if (!counts.size) continue;
    // census population split across areas sharing a (county, place), by plus4 share
    const groupTotal = new Map<string, number>();
    for (const [ak, c] of counts) {
      const a = areas.get(ak)!;
      const g = `${a.county}/${a.place}`;
      groupTotal.set(g, (groupTotal.get(g) ?? 0) + c);
    }
    const cands = [...counts].map(([ak, c]) => {
      const a = areas.get(ak)!;
      const g = `${a.county}/${a.place}`;
      const jr = juris(ak);
      return {
        weight: censusWeight(zip, a) * (c / groupTotal.get(g)!) + c * 1e-6,
        rate: { jurisdictions: jr.j, effectiveFrom: jr.from, effectiveTo: jr.to, prevTotal: jr.prev },
        city: label(zip, ak),
        county: a.county ? (countyNames.get(a.county) ?? null) : null,
      };
    });
    rows.push(...rollUpZip(state, zip, cands, source));

    // ZIP+4 rows only where the ZIP holds more than one rate
    const segs = seg.get(zip) ?? [];
    const sigs = new Set(segs.map((s) => signature(juris(s.area).j)));
    if (sigs.size > 1) {
      for (const kind of [false, true]) {
        const list = segs.filter((s) => s.point === kind).sort((a, b) => a.lo - b.lo || a.hi - b.hi);
        const merged: { lo: number; hi: number; area: string }[] = [];
        for (const s of list) {
          const last = merged[merged.length - 1];
          if (last && s.lo <= last.hi + 1 && signature(juris(last.area).j) === signature(juris(s.area).j)) last.hi = Math.max(last.hi, s.hi);
          else merged.push({ ...s });
        }
        for (const m of merged) {
          const jr = juris(m.area);
          const a = areas.get(m.area)!;
          rows.push({
            state,
            zip5: zip,
            plus4Low: String(m.lo).padStart(4, "0"),
            plus4High: String(m.hi).padStart(4, "0"),
            countyName: a.county ? (countyNames.get(a.county) ?? null) : null,
            cityName: label(zip, m.area),
            jurisdictions: jr.j,
            isPrimary: false,
            source,
            effectiveFrom: jr.from,
            effectiveTo: jr.to,
            prevTotal: jr.prev,
          });
          plus4Rows++;
        }
      }
    }
  }
  if (missingRates.size) notes.push(`codes in the boundary file with no rate in force on ${AS_OF} (treated as 0): ${[...missingRates].slice(0, 30).join(", ")}${missingRates.size > 30 ? ` (+${missingRates.size - 30})` : ""}`);
  notes.push(`${rows.length - plus4Rows} ZIP5 rows, ${plus4Rows} ZIP+4 range rows`);
  return { rows, source, notes };
}

/**
 * WA DOR "Local sales & use tax rates" quarterly workbook (dor.wa.gov, saved in
 * data/rates/raw/WA): location code -> location name + combined LOCAL rate.
 */
async function waRateTable(quarter: "Q326" | "Q426") {
  const file = rawFile("WA", `${quarter}_Excel_LSU-rates-alpha.xlsx`);
  if (!existsSync(file)) throw new Error(`WA: missing ${file} - download it from dor.wa.gov (see data/rates/sources/WA.md)`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const m = new Map<number, { name: string; local: number }>();
  wb.worksheets[0].eachRow((r) => {
    const code = r.getCell(3).value, local = r.getCell(4).value;
    if (typeof code === "number" && typeof local === "number") m.set(code, { name: String(r.getCell(2).value).trim(), local: round6(local) });
  });
  if (m.size < 350) throw new Error(`WA: only ${m.size} location codes read from ${file}`);
  return m;
}

/** "Nashville-Davidson metropolitan government (balance)" -> "Nashville". */
export function cleanPlaceName(s: string | null) {
  if (!s) return s;
  let n = s.replace(/\s*\(balance\)/i, "").trim();
  if (/government|county|urban/i.test(n)) n = n.split(/[-/]/)[0].replace(/\s+(metropolitan|consolidated|unified)\s+government.*$/i, "").trim();
  return n;
}

export { normCity };
