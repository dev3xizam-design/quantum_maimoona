import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthSnapshot, statesFromSnapshot } from "@/lib/months";
import { fmtMoney, num } from "@/lib/money";
import { stateName } from "@/lib/states";
import { periodLabel } from "@/lib/periods";

export const dynamic = "force-dynamic";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div
        className={`stat-value ${tone === "warn" ? "text-[var(--danger)]" : tone === "ok" ? "text-[var(--ok)]" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

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
  const underCollected = states.filter((s) => s.delta >= 0.01);

  const totalTax = num(snapshot.totalTax);

  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <div className="hero">
          <div className="hero-label">{periodLabel(month)} · total tax due</div>
          <div className="hero-value">{fmtMoney(totalTax)}</div>
          <div className="hero-sub">
            {snapshot.statesWithActivity} states · {fmtMoney(num(snapshot.gross))} gross ·{" "}
            {snapshot.pactShipments.toLocaleString()} PACT lines
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Sales tax" value={fmtMoney(num(snapshot.salesTax))} />
          <Tile label="Vapor excise" value={fmtMoney(num(snapshot.exciseTax))} />
          <Tile label="Taxable sales" value={fmtMoney(num(snapshot.taxable))} />
          <Tile
            label="Under-collected"
            value={fmtMoney(Math.max(0, num(snapshot.delta)))}
            tone={num(snapshot.delta) >= 0.01 ? "warn" : "ok"}
            sub={num(snapshot.delta) >= 0.01 ? "comes out of margin" : "nothing outstanding"}
          />
        </div>

        {failures.length > 0 && (
          <div className="callout callout-warn mt-4">
            <strong>{failures.map((s2) => s2.state).join(", ")} do not reconcile.</strong> Do not
            file those states until the upload is corrected.
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head">
          Every state in this month
          <span className="ml-auto text-[11.5px] font-normal text-[var(--muted)]">
            click a state for its own tab
          </span>
        </div>
        <table className="qtable">
          <thead>
            <tr>
              <th>State</th>
              <th className="num">Gross</th>
              <th className="num">Taxable</th>
              <th className="num">Sales tax</th>
              <th className="num">Collected</th>
              <th className="num">Delta</th>
              <th className="num">Excise</th>
              <th className="num">PACT</th>
              <th>Sales due</th>
              <th className="num">Flags</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.state} className={s.delta >= 0.01 || !s.reconciles ? "flagged" : ""}>
                <td>
                  <Link
                    href={`/months/${month}/${s.state}`}
                    className="font-semibold text-[var(--accent)]"
                  >
                    {s.state}
                  </Link>
                  <div className="text-[10.5px] text-[var(--muted)]">{stateName(s.state)}</div>
                </td>
                <td className="num">{fmtMoney(s.gross)}</td>
                <td className="num">{fmtMoney(s.taxable)}</td>
                <td className="num font-semibold">{fmtMoney(s.salesTax)}</td>
                <td className="num">{fmtMoney(s.collected)}</td>
                <td
                  className={`num ${
                    s.delta >= 0.01
                      ? "font-semibold text-[var(--danger)]"
                      : s.delta <= -0.01
                        ? "text-[var(--muted)]"
                        : ""
                  }`}
                >
                  {fmtMoney(s.delta)}
                </td>
                <td className="num">{s.excise !== null ? fmtMoney(s.excise) : "—"}</td>
                <td className="num">{s.pactLines || "—"}</td>
                <td className="whitespace-nowrap text-[12px]">{s.salesDue ?? "—"}</td>
                <td className="num">
                  {!s.reconciles && <span className="badge badge-overdue">recon</span>}
                  {s.warnings > 0 && <span className="badge badge-not_started">{s.warnings}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {states.length === 0 && (
          <div className="empty">No state had transactions in this month.</div>
        )}
      </div>

      {underCollected.length > 0 && (
        <div className="help">
          <strong>
            {underCollected.length} state{underCollected.length === 1 ? "" : "s"} under-collected,{" "}
            {fmtMoney(underCollected.reduce((s, x) => s + x.delta, 0))} in total.
          </strong>{" "}
          Biggest:{" "}
          {[...underCollected]
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 4)
            .map((s) => `${s.state} ${fmtMoney(s.delta)}`)
            .join(", ")}
          . Over-collection is not listed — it is not a margin hit and needs no action.
        </div>
      )}
    </div>
  );
}
