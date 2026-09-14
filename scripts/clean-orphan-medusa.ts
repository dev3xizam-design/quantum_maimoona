/**
 * Rows written before the catalog mirror was scoped per store have no
 * integration_id, so no store's sync can ever replace or remove them. Clear
 * them out; a fresh sync of each store rebuilds its own rows.
 */
import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);

async function main() {
  const before = rows(await db.execute(dsql`
    SELECT count(*) FILTER (WHERE integration_id IS NULL)::int orphans,
           count(*) FILTER (WHERE integration_id IS NOT NULL)::int owned
    FROM medusa_products`))[0];
  console.log("before:", before);

  if (process.argv.includes("--apply")) {
    await db.execute(dsql`DELETE FROM medusa_products WHERE integration_id IS NULL`);
    console.log("after :", rows(await db.execute(dsql`SELECT count(*)::int total FROM medusa_products`))[0]);
  } else {
    console.log("dry run — pass --apply");
  }
  await sql.end();
}
main();
