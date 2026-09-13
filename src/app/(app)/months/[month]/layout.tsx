import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthSnapshot, statesFromSnapshot } from "@/lib/months";
import { periodLabel } from "@/lib/periods";
import { fmtMoney, num } from "@/lib/money";
import { closeMonth, reopenMonth } from "@/app/actions/months";
import { StateTabs } from "./StateTabs";
import { ComputeMonthButton } from "./ComputeMonthButton";

export const dynamic = "force-dynamic";

export default async function MonthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const snapshot = await getMonthSnapshot(month);
  const states = snapshot ? statesFromSnapshot(snapshot) : [];
  const closed = snapshot?.status === "closed";

  return (
    <div>
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <Link href="/months" className="text-[11.5px] font-semibold text-[var(--accent)]">
              &larr; All months
            </Link>
            <h1 className="page-title mt-0.5">{periodLabel(month)}</h1>
            {snapshot ? (
              <p className="page-sub mt-0.5 tnum">
                {snapshot.statesWithActivity} states ·{" "}
                <strong>{fmtMoney(num(snapshot.totalTax))}</strong> total tax ·{" "}
                {fmtMoney(num(snapshot.gross))} gross
                {num(snapshot.delta) >= 0.01 && (
                  <>
                    {" "}
                    · <span className="text-[var(--danger)]">
                      {fmtMoney(num(snapshot.delta))} under-collected
                    </span>
                  </>
                )}
                {snapshot.computedAt && (
                  <> · computed {snapshot.computedAt.toISOString().slice(0, 16).replace("T", " ")}</>
                )}
              </p>
            ) : (
              <p className="page-sub mt-0.5">
                This month has not been computed yet. Compute it once and it is stored — every
                state, every return.
              </p>
            )}
          </div>

          <div className="pagehead-actions">
            {snapshot && (
              <>
                <span className={`badge ${closed ? "badge-filed" : "badge-ready"}`}>
                  {closed ? "closed" : "open"}
                </span>
                <a className="btn" href={`/api/period-workbook/${month}`}>
                  Workbook
                </a>
                <a className="btn" href={`/api/period-bundle/${month}`}>
                  ZIP
                </a>
                <form action={closed ? reopenMonth : closeMonth}>
                  <input type="hidden" name="month" value={month} />
                  <button className="btn btn-sm" type="submit">
                    {closed ? "Reopen month" : "Mark month closed"}
                  </button>
                </form>
              </>
            )}
            <ComputeMonthButton month={month} recompute={Boolean(snapshot)} />
          </div>
        </div>

        {snapshot && <StateTabs month={month} states={states} />}
      </div>

      {snapshot ? (
        children
      ) : (
        <div className="panel">
          <div className="empty">
            <strong>Nothing stored for {periodLabel(month)} yet.</strong>
            <span>
              Press <em>Compute this month</em> above. It runs every registered state in one pass —
              sales tax, vapor excise and PACT — stores each return, and stores the month itself.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
