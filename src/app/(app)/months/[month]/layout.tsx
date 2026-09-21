import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthSnapshot, statesFromSnapshot } from "@/lib/months";
import { periodLabel } from "@/lib/periods";
import { fmtMoney, num } from "@/lib/money";
import { closeMonth, reopenMonth } from "@/app/actions/months";
import { MonthBreakdown } from "./MonthBreakdown";
import { ComputeMonthButton } from "./ComputeMonthButton";

export const dynamic = "force-dynamic";

function Card({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "ok" | "info" | "amber";
  icon: React.ReactNode;
}) {
  const skin =
    tone === "warn"
      ? { bg: "var(--danger-soft)", fg: "var(--danger)" }
      : tone === "amber"
        ? { bg: "var(--amber-soft)", fg: "var(--amber)" }
        : tone === "info"
          ? { bg: "var(--blue-soft)", fg: "var(--blue)" }
          : { bg: "var(--q-100)", fg: "var(--q-700)" };

  return (
    <div className="stat">
      <span className="tile-icon" style={{ background: skin.bg, color: skin.fg }}>
        {icon}
      </span>
      <div className="stat-label mt-3">{label}</div>
      <div className="stat-value" style={tone === "warn" ? { color: "var(--danger)" } : undefined}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

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
  const delta = snapshot ? num(snapshot.delta) : 0;

  if (!snapshot) {
    return (
      <div>
        <div className="pagehead">
          <div className="pagehead-row">
            <div>
              <Link href="/months" className="text-[11.5px] font-semibold text-[var(--accent)]">
                &larr; All months
              </Link>
              <h1 className="page-title mt-0.5">{periodLabel(month)}</h1>
              <p className="page-sub mt-0.5">
                Not computed yet. One pass covers every registered state and stores the result.
              </p>
            </div>
            <div className="pagehead-actions">
              <ComputeMonthButton month={month} recompute={false} />
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="empty">
            <strong>Nothing stored for {periodLabel(month)} yet.</strong>
            <span>Press Compute this month above — sales tax, vapor excise and PACT, all states.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <Link href="/months" className="text-[11.5px] font-semibold text-[var(--accent)]">
              &larr; All months
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="page-title">{periodLabel(month)}</h1>
              <span className={`badge ${closed ? "badge-filed" : "badge-ready"}`}>
                {closed ? "closed" : "open"}
              </span>
            </div>
            <p className="page-sub mt-0.5">
              {snapshot.statesWithActivity} states · {fmtMoney(num(snapshot.gross))} gross ·{" "}
              {snapshot.computedAt &&
                `computed ${snapshot.computedAt.toISOString().slice(0, 16).replace("T", " ")}`}
            </p>
          </div>

          <div className="pagehead-actions">
            <a className="btn" href={`/api/period-workbook/${month}`}>Workbook</a>
            <a className="btn" href={`/api/period-bundle/${month}`}>ZIP</a>
            <form action={closed ? reopenMonth : closeMonth}>
              <input type="hidden" name="month" value={month} />
              <button className="btn" type="submit">
                {closed ? "Reopen month" : "Mark closed"}
              </button>
            </form>
            <ComputeMonthButton month={month} recompute />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Total tax due"
          value={fmtMoney(num(snapshot.totalTax))}
          sub={`sales ${fmtMoney(num(snapshot.salesTax))} · excise ${fmtMoney(num(snapshot.exciseTax))}`}
          icon={iconCoins}
        />
        <Card
          label="Under-collected"
          value={fmtMoney(Math.max(0, delta))}
          tone={delta >= 0.01 ? "warn" : "ok"}
          sub={delta >= 0.01 ? "comes out of margin" : "nothing outstanding"}
          icon={iconAlert}
        />
        <Card
          label="To review"
          value={snapshot.warnings.toLocaleString()}
          tone="amber"
          sub="across all states"
          icon={iconList}
        />
        <Card
          label="PACT lines"
          value={snapshot.pactShipments.toLocaleString()}
          tone="info"
          sub="shipments to report"
          icon={iconTruck}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <MonthBreakdown month={month} states={states} />
        <div>{children}</div>
      </div>
    </div>
  );
}

const iconCoins = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </svg>
);
const iconAlert = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="9" />
  </svg>
);
const iconList = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const iconTruck = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" />
  </svg>
);
