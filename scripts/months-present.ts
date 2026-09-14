import "../src/lib/load-env";
import { db, sql } from "../src/db";
import { sql as dsql } from "drizzle-orm";
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);
async function main() {
  console.log("month     rows     states  min date     max date     full month?");
  for (const r of rows(await db.execute(dsql`
    SELECT period,
           count(*)::int rows,
           count(DISTINCT state)::int states,
           min(document_date)::text mind,
           max(document_date)::text maxd
    FROM transactions GROUP BY period ORDER BY period`))) {
    const mind = String(r.mind), maxd = String(r.maxd);
    const start = mind.endsWith("-01");
    const end = new Date(`${maxd}T00:00:00Z`);
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    const complete = start && end.getUTCDate() === lastDay;
    console.log(
      `${String(r.period).padEnd(9)} ${String(r.rows).padStart(6)} ${String(r.states).padStart(7)}  ${mind}   ${maxd}   ${complete ? "yes" : "NO - partial"}`,
    );
  }
  console.log("\nstored month snapshots:");
  for (const r of rows(await db.execute(dsql`SELECT month, status, states_with_activity, total_tax FROM monthly_snapshots ORDER BY month`))) {
    console.log(`  ${r.month}  ${r.status}  ${r.states_with_activity} states  $${r.total_tax}`);
  }
  await sql.end();
}
main();
