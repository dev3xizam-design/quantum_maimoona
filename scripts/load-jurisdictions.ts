/**
 * Replaces jurisdiction_directory with data/jurisdictions/us-jurisdictions.csv
 * and rebuilds the full-country downloads in public/downloads.
 *
 *   npm run db:jurisdictions            # load the database + rebuild files
 *   npm run db:jurisdictions -- --files # rebuild the download files only
 *
 * Never touches jurisdiction_codes - the table the engine files returns from.
 */
import "../src/lib/load-env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildDirectoryWorkbook,
  directoryToCsv,
  parseDirectoryCsv,
} from "../src/lib/jurisdictions/directory";

const SOURCE = path.join(process.cwd(), "data/jurisdictions/us-jurisdictions.csv");
const OUT = path.join(process.cwd(), "public/downloads");
const BATCH = 1000;

async function main() {
  const rows = parseDirectoryCsv(readFileSync(SOURCE, "utf8"));
  const tax = rows.filter((r) => r.category === "tax").length;
  console.log(`${rows.length.toLocaleString()} rows validated (${tax.toLocaleString()} tax, ${(rows.length - tax).toLocaleString()} government)`);

  mkdirSync(OUT, { recursive: true });
  const builtOn = new Date().toISOString().slice(0, 10);
  writeFileSync(path.join(OUT, "us-jurisdictions.csv"), directoryToCsv(rows));
  writeFileSync(path.join(OUT, "us-tax-jurisdiction-codes.csv"), directoryToCsv(rows.filter((r) => r.category === "tax")));
  writeFileSync(
    path.join(OUT, "us-jurisdictions.xlsx"),
    await buildDirectoryWorkbook(rows, { title: "US jurisdictions - Quantum", builtOn }),
  );
  console.log(`Download files written to ${OUT}`);

  if (process.argv.includes("--files")) return;

  const { db, sql } = await import("../src/db");
  const { jurisdictionDirectory } = await import("../src/db/schema");
  try {
    await db.transaction(async (tx) => {
      await tx.delete(jurisdictionDirectory);
      for (let i = 0; i < rows.length; i += BATCH) {
        await tx.insert(jurisdictionDirectory).values(rows.slice(i, i + BATCH));
        process.stdout.write(`\r  loaded ${Math.min(i + BATCH, rows.length).toLocaleString()}`);
      }
    });
    console.log("\nDirectory table replaced.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
