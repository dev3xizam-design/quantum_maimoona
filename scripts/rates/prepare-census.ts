/**
 * Builds data/rates/derived/zcta-geo.csv: Census 2020 population for every
 * (ZCTA, county, place, county subdivision) piece of the country. It is the
 * ZIP -> county / city evidence every non-SST state builder uses, and the
 * population weights that decide which row of a split ZIP is `is_primary`.
 *
 * Inputs (download with data/rates/raw/census/fetch.sh, ~1.5 GB, gitignored):
 *   raw/census/pl/<st>geo2020.pl                    2020 PL 94-171 geo headers (block POP100/HU100,
 *                                                   county, place, county subdivision per block)
 *   raw/census/tab20_zcta520_tabblock20_natl.txt    2020 ZCTA <-> block relationship file
 *
 *   npx tsx scripts/rates/prepare-census.ts
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const RAW = path.join(process.cwd(), "data/rates/raw/census");
const TMP = path.join(RAW, "tmp-blocks");
const OUT = path.join(process.cwd(), "data/rates/derived/zcta-geo.csv");

/** 0-based field positions in the 2020 PL geo header (pipe-delimited). */
const F = { SUMLEV: 2, GEOCODE: 9, STATE: 12, COUNTY: 14, COUSUB: 17, PLACE: 29, PLACECC: 30, AREALAND: 84, BASENAME: 86, NAME: 87, POP: 90, HU: 91 };

async function splitBlockFile() {
  if (existsSync(path.join(TMP, "done"))) return;
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const rl = readline.createInterface({ input: createReadStream(path.join(RAW, "tab20_zcta520_tabblock20_natl.txt")) });
  let header: string[] | null = null;
  let iZ = -1, iB = -1;
  const buf = new Map<string, string[]>();
  const flush = () => {
    for (const [st, lines] of buf) appendFileSync(path.join(TMP, st), lines.join("\n") + "\n");
    buf.clear();
  };
  let n = 0;
  for await (const line of rl) {
    const f = line.split("|");
    if (!header) {
      header = f.map((h) => h.replace(/^﻿/, ""));
      iZ = header.indexOf("GEOID_ZCTA5_20");
      iB = header.indexOf("GEOID_TABBLOCK_20");
      continue;
    }
    const z = f[iZ], b = f[iB];
    if (!z || !b) continue;
    const st = b.slice(0, 2);
    let a = buf.get(st);
    if (!a) buf.set(st, (a = []));
    a.push(`${b}|${z}`);
    if (++n % 500000 === 0) flush();
  }
  flush();
  writeFileSync(path.join(TMP, "done"), String(n));
  console.log(`split ${n.toLocaleString()} block->ZCTA pairs`);
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

async function main() {
  await splitBlockFile();
  const geoFiles = readFileSync(path.join(RAW, "fetch.sh"), "utf8").match(/:([a-z]{2})\b/g)!.map((m) => m.slice(1));
  const out: string[] = ["zcta,state,county_fips,county_name,place_fips,place_name,place_type,cousub_fips,cousub_name,pop,hu,arealand"];
  for (const ab of geoFiles) {
    const geo = path.join(RAW, "pl", `${ab}geo2020.pl`);
    if (!existsSync(geo)) throw new Error(`missing ${geo} - run data/rates/raw/census/fetch.sh`);
    const ST = ab.toUpperCase();
    const counties = new Map<string, string>(), places = new Map<string, { name: string; cc: string }>(), cousubs = new Map<string, string>();
    const blocks: string[][] = [];
    const rl = readline.createInterface({ input: createReadStream(geo, { encoding: "latin1" }) });
    for await (const line of rl) {
      const f = line.split("|");
      const lev = f[F.SUMLEV];
      if (lev === "750") blocks.push(f);
      else if (lev === "050") counties.set(f[F.COUNTY], f[F.BASENAME]);
      else if (lev === "160") places.set(f[F.PLACE], { name: f[F.BASENAME], cc: f[F.PLACECC] });
      else if (lev === "060") cousubs.set(`${f[F.COUNTY]}${f[F.COUSUB]}`, f[F.BASENAME]);
    }
    const stFips = blocks[0][F.STATE];
    const b2z = new Map<string, string>();
    const tmp = path.join(TMP, stFips);
    if (existsSync(tmp)) for (const l of readFileSync(tmp, "utf8").split("\n")) if (l) b2z.set(l.slice(0, 15), l.slice(16));
    const agg = new Map<string, { pop: number; hu: number; area: number }>();
    for (const f of blocks) {
      const z = b2z.get(f[F.GEOCODE]);
      if (!z) continue; // blocks outside any ZCTA (water, unpopulated)
      const key = `${z}|${f[F.COUNTY]}|${f[F.PLACE]}|${f[F.COUSUB]}`;
      const a = agg.get(key) ?? { pop: 0, hu: 0, area: 0 };
      a.pop += Number(f[F.POP]) || 0;
      a.hu += Number(f[F.HU]) || 0;
      a.area += Number(f[F.AREALAND]) || 0;
      agg.set(key, a);
    }
    for (const [key, a] of [...agg].sort(([x], [y]) => (x < y ? -1 : 1))) {
      const [z, co, pl, cs] = key.split("|");
      const p = pl && pl !== "99999" ? places.get(pl) : undefined;
      const type = !p ? "none" : p.cc.startsWith("C") ? "incorporated" : "cdp";
      out.push(
        [z, ST, co, csvCell(counties.get(co) ?? ""), p ? pl : "", csvCell(p?.name ?? ""), type, cs === "99999" ? "" : cs, csvCell(cousubs.get(`${co}${cs}`) ?? ""), a.pop, a.hu, a.area].join(","),
      );
    }
    console.log(`${ST}: ${blocks.length.toLocaleString()} blocks, ${agg.size.toLocaleString()} pieces`);
    // a truncated block->ZCTA file shows up as states with (almost) no pieces
    if (agg.size < 10) throw new Error(`${ST}: only ${agg.size} ZIP pieces - is tab20_zcta520_tabblock20_natl.txt complete? delete it and re-run fetch.sh`);
  }
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, out.join("\n") + "\n");
  console.log(`wrote ${out.length - 1} rows -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
