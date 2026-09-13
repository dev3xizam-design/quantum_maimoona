import Link from "next/link";
import { listMonths } from "@/lib/months";
import { fmtMoney } from "@/lib/money";
import { periodLabel, recentMonths } from "@/lib/periods";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Months" };

export default async function MonthsPage() {
  const months = await listMonths();
  const known = new Set(months.map((m) => m.month));
  const suggestions = recentMonths(6).filter((m) => !known.has(m));

  return (
    <div>
      <PageHeader
        title="Months"
        description="Everything is stored a month at a time. Open a month to see every state that had activity in it, each on its own tab."
      />

      <div className="panel overflow-hidden">
        <div className="panel-head">
          {months.length} month{months.length === 1 ? "" : "s"} with data
        </div>
        <table className="qtable">
          <thead>
            <tr>
              <th>Month</th>
              <th>Status</th>
              <th className="num">States</th>
              <th className="num">Gross sales</th>
              <th className="num">Total tax due</th>
              <th className="num">Under-collected</th>
              <th className="num">Action items</th>
              <th>Computed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td>
                  <Link href={`/months/${m.month}`} className="font-semibold text-[var(--accent)]">
                    {periodLabel(m.month)}
                  </Link>
                  <div className="text-[10.5px] text-[var(--muted)]">
                    {m.transactionRows.toLocaleString()} rows
                  </div>
                </td>
                <td>
                  {!m.stored ? (
                    <span className="badge badge-not_started">not computed</span>
                  ) : m.status === "closed" ? (
                    <span className="badge badge-filed">closed</span>
                  ) : (
                    <span className="badge badge-ready">open</span>
                  )}
                </td>
                <td className="num">{m.stored ? m.statesWithActivity : "—"}</td>
                <td className="num">{m.stored ? fmtMoney(m.gross) : "—"}</td>
                <td className="num font-semibold">{m.stored ? fmtMoney(m.totalTax) : "—"}</td>
                <td className={`num ${m.delta >= 0.01 ? "font-semibold text-[var(--danger)]" : ""}`}>
                  {m.stored ? fmtMoney(Math.max(0, m.delta)) : "—"}
                </td>
                <td className="num">
                  {m.stored && m.warnings > 0 ? (
                    <span className="badge badge-not_started">{m.warnings}</span>
                  ) : m.stored ? (
                    "0"
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap text-[11.5px] text-[var(--muted)]">
                  {m.computedAt ?? "—"}
                </td>
                <td>
                  <Link href={`/months/${m.month}`} className="btn btn-sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {months.length === 0 && (
          <div className="empty">
            <strong>No months yet.</strong>
            <span>Upload an Avalara export and the month it covers will appear here.</span>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="help mt-4">
          <strong>Nothing uploaded for</strong>{" "}
          {suggestions.map((m, i) => (
            <span key={m}>
              {i > 0 && ", "}
              <Link className="font-semibold text-[var(--accent)]" href={`/months/${m}`}>
                {periodLabel(m)}
              </Link>
            </span>
          ))}
          . A month with no transactions has nothing to file.
        </div>
      )}
    </div>
  );
}
