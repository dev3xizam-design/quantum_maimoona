import { notFound } from "next/navigation";
import { getMonthSnapshot, statesFromSnapshot } from "@/lib/months";
import { fmtMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function MonthOverviewPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const snapshot = await getMonthSnapshot(month);
  if (!snapshot) notFound();

  const states = statesFromSnapshot(snapshot).filter((s) => s.hasActivity);
  const failures = states.filter((s) => !s.reconciles);
  const underCollected = states.filter((s) => s.delta >= 0.01).sort((a, b) => b.delta - a.delta);
  const biggest = [...states].sort((a, b) => b.salesTax + (b.excise ?? 0) - (a.salesTax + (a.excise ?? 0)))[0];

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="text-[14px] font-semibold">Pick a state</h2>
        <p className="mt-1 text-[12.5px] text-[var(--muted)]">
          Open any state from the table to see its return, its jurisdiction breakdown and its filing
          steps here.
        </p>
        {biggest && (
          <div className="mt-3 text-[12.5px] text-[var(--muted)]">
            Largest this month: <strong className="text-[var(--ink)]">{biggest.state}</strong> at{" "}
            {fmtMoney(biggest.salesTax + (biggest.excise ?? 0))}.
          </div>
        )}
      </section>

      {failures.length > 0 && (
        <div className="callout callout-warn">
          <strong>{failures.map((s) => s.state).join(", ")} do not reconcile.</strong> Do not file
          those states until the upload is corrected.
        </div>
      )}

      {underCollected.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="panel-head">Under-collected</div>
          <div className="p-4">
            <p className="text-[12.5px] text-[var(--muted)]">
              {underCollected.length} state{underCollected.length === 1 ? "" : "s"} where the
              official rate assesses more than Avalara collected. The difference comes out of margin.
            </p>
            <div className="mt-3 space-y-1.5">
              {underCollected.slice(0, 8).map((s) => (
                <div key={s.state} className="flex items-baseline justify-between text-[13px]">
                  <span className="font-medium">{s.state}</span>
                  <span className="tnum font-semibold text-[var(--danger)]">{fmtMoney(s.delta)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-[var(--muted)]">
              Over-collection is not listed — it is not a margin hit and needs no action.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
