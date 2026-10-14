/**
 * Loads the rate table built by build-rates.ts into the database, in one
 * transaction, so the real-time tax API never sees a half-loaded table.
 *
 *   npx tsx scripts/rates/load-rates.ts                # every state
 *   npx tsx scripts/rates/load-rates.ts --only CA,TX   # replace just these states
 *
 * Reads the per-state files in data/rates/build (the merged us-tax-rates.csv is
 * too big for one string). Storage, sized for Neon's 1 GB branch limit:
 *  - ZIP5 rows            -> tax_rates (with their jurisdictions)
 *  - ZIP+4 range rows     -> tax_rate_plus4, one row per ZIP holding flat
 *                            [low, high, areaId] triples
 *  - distinct range areas -> tax_rate_areas (~9k rows instead of 1.7M copies)
 */
import "../../src/lib/load-env";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import postgres from "postgres";

const BUILD = path.join(process.cwd(), "data/rates/build");
const RATE_COLS = [
  "state", "zip5", "plus4_low", "plus4_high", "county_name", "city_name",
  "state_rate", "county_rate", "city_rate", "special_rate", "total_rate",
  "jurisdictions", "is_primary", "source", "effective_from", "effective_to",
] as const;
const AREA_COLS = [
  "id", "state", "county_name", "city_name", "state_rate", "county_rate", "city_rate", "special_rate",
  "total_rate", "jurisdictions", "source", "effective_from", "effective_to",
] as const;
const CHUNK = 5000;

type Csv = Record<string, string>;
type Writable = { write: (s: string, cb: (e?: Error | null) => void) => boolean; end: () => void; on: (ev: string, f: (e?: Error) => void) => void };

async function copy(tx: postgres.TransactionSql, table: string, cols: readonly string[], rows: string[][]) {
  if (!rows.length) return;
  const w = (await tx.unsafe(`COPY ${table} (${cols.join(",")}) FROM STDIN WITH (FORMAT csv)`).writable()) as unknown as Writable;
  for (let i = 0; i < rows.length; i += CHUNK) {
    // an unquoted empty field is NULL in COPY csv; Papa leaves "" unquoted
    const text = Papa.unparse(rows.slice(i, i + CHUNK), { header: false, newline: "\n" }) + "\n";
    await new Promise<void>((res, rej) => w.write(text, (e) => (e ? rej(e) : res())));
  }
  await new Promise<void>((res, rej) => {
    w.on("finish", () => res());
    w.on("error", (e) => rej(e));
    w.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",").map((s) => s.trim().toUpperCase()) : null;
  const states = readdirSync(BUILD)
    .filter((f) => /^[A-Z]{2}\.csv$/.test(f))
    .map((f) => f.slice(0, 2))
    .filter((s) => !only || only.includes(s))
    .sort();
  if (!states.length) throw new Error(`no state files in ${BUILD}`);
  if (only && only.some((s) => !states.includes(s))) throw new Error(`no build file for ${only.filter((s) => !states.includes(s)).join(", ")}`);

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  console.log(`target: ${new URL(process.env.DATABASE_URL).host} (${states.length} states)`);
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      if (only) {
        await tx`DELETE FROM tax_rates WHERE state IN ${tx(states)}`;
        await tx`DELETE FROM tax_rate_plus4 WHERE state IN ${tx(states)}`;
        await tx`DELETE FROM tax_rate_areas WHERE state IN ${tx(states)}`;
      } else {
        await tx`DELETE FROM tax_rates`;
        await tx`DELETE FROM tax_rate_plus4`;
        await tx`DELETE FROM tax_rate_areas`;
      }
      const [{ max }] = await tx<{ max: number }[]>`SELECT coalesce(max(id), 0)::int max FROM tax_rate_areas`;
      let nextId = max + 1;
      let zipRows = 0, rangeRows = 0, areaRows = 0, packed = 0;

      for (const st of states) {
        const parsed = Papa.parse<Csv>(readFileSync(path.join(BUILD, `${st}.csv`), "utf8"), { header: true, skipEmptyLines: true });
        if (parsed.errors.length) throw new Error(`${st}.csv: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`);

        const zip5: string[][] = [];
        const areas = new Map<string, number>();
        const areaOut: string[][] = [];
        const ranges = new Map<string, number[]>();
        for (const r of parsed.data) {
          if (!r.plus4_low) {
            zip5.push(RATE_COLS.map((c) => r[c] ?? ""));
            continue;
          }
          const key = [r.county_name, r.city_name, r.jurisdictions, r.source, r.effective_from, r.effective_to].join("\u0001");
          let id = areas.get(key);
          if (id === undefined) {
            id = nextId++;
            areas.set(key, id);
            areaOut.push([String(id), ...AREA_COLS.slice(1).map((c) => r[c] ?? "")]);
          }
          let a = ranges.get(r.zip5);
          if (!a) ranges.set(r.zip5, (a = []));
          a.push(Number(r.plus4_low), Number(r.plus4_high), id);
          rangeRows++;
        }
        await copy(tx, "tax_rates", RATE_COLS, zip5);
        await copy(tx, "tax_rate_areas", AREA_COLS, areaOut);
        await copy(tx, "tax_rate_plus4", ["state", "zip5", "ranges"], [...ranges].map(([z, a]) => [st, z, `{${a.join(",")}}`]));
        zipRows += zip5.length;
        areaRows += areaOut.length;
        packed += ranges.size;
        console.log(`  ${st}: ${zip5.length.toLocaleString()} ZIP rows, ${rangeRows.toLocaleString()} ZIP+4 ranges so far, ${areaOut.length.toLocaleString()} areas`);
      }
      console.log(`loaded ${zipRows.toLocaleString()} ZIP rows, ${rangeRows.toLocaleString()} ZIP+4 ranges in ${packed.toLocaleString()} ZIPs, ${areaRows.toLocaleString()} areas`);
    });
    const [s] = await sql<{ db: string; rates: string; plus4: string; areas: string }[]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) db,
             pg_size_pretty(pg_total_relation_size('tax_rates')) rates,
             pg_size_pretty(pg_total_relation_size('tax_rate_plus4')) plus4,
             pg_size_pretty(pg_total_relation_size('tax_rate_areas')) areas`;
    console.log(`sizes: tax_rates ${s.rates}, tax_rate_plus4 ${s.plus4}, tax_rate_areas ${s.areas}; database ${s.db}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
