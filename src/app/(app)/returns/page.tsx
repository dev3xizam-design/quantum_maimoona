import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { filings } from "@/db/schema";
import { fmtMoney, num } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const rows = await db.select().from(filings).orderBy(desc(filings.period), filings.state).limit(500);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Returns</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Every computed return, newest period first. Numbers refresh whenever a return is
          recomputed or the period is re-run.
        </p>
      </div>

      <div className="help">
        <strong>Delta is the column to watch.</strong> It is what the state&rsquo;s official rate
        assesses minus what Avalara actually collected. A positive number means you under-collected
        and the difference comes out of margin — open the return and check the Avalara rate config
        for that state. Click a state code to open its return, download its worksheet, or mark it
        filed.
      </div>

      <div className="panel overflow-hidden">
        <table className="grid">
          <thead>
            <tr>
              <th>State</th>
              <th>Type</th>
              <th>Period</th>
              <th>Due</th>
              <th>Status</th>
              <th className="num">Taxable</th>
              <th className="num">Tax due</th>
              <th className="num">Collected</th>
              <th className="num">Delta</th>
              <th>Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const delta = f.delta ? num(f.delta) : 0;
              const status =
                f.status === "filed"
                  ? "filed"
                  : f.dueDate && f.dueDate < today
                    ? "overdue"
                    : (f.status ?? "ready");
              return (
                <tr key={f.id}>
                  <td className="font-semibold">
                    <Link href={`/returns/${f.state}/${f.taxType}/${f.period}`} className="text-[var(--accent)]">
                      {f.state}
                    </Link>
                  </td>
                  <td>{f.taxType}</td>
                  <td>{f.period}</td>
                  <td>{f.dueDate ?? "-"}</td>
                  <td><StatusBadge status={status} /></td>
                  <td className="num">{f.taxable ? fmtMoney(num(f.taxable)) : "-"}</td>
                  <td className="num font-semibold">{f.taxComputed ? fmtMoney(num(f.taxComputed)) : "-"}</td>
                  <td className="num">{f.taxCollected ? fmtMoney(num(f.taxCollected)) : "-"}</td>
                  <td className={`num ${Math.abs(delta) >= 0.01 ? "font-semibold text-[var(--danger)]" : ""}`}>
                    {f.delta ? fmtMoney(delta) : "-"}
                  </td>
                  <td className="font-mono text-[11px]">{f.confirmationNumber ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[var(--muted)]">
            Nothing computed yet. Upload an Avalara export, then press &ldquo;Run this period&rdquo; on the
            calendar.
          </div>
        )}
      </div>
    </div>
  );
}
