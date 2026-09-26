import Link from "next/link";
import { fmtMoney } from "@/lib/money";
import { loadPeriodic, type PeriodicRow, type PeriodicStatus } from "@/lib/periodic";
import { stateName } from "@/lib/states";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quarterly & Annual" };

const STATUS: Record<PeriodicStatus, { label: string; badge: string }> = {
  filed: { label: "Filed", badge: "filed" },
  overdue: { label: "Overdue", badge: "overdue" },
  due_soon: { label: "Due soon", badge: "ready" },
  ready: { label: "Ready to file", badge: "ready" },
  in_progress: { label: "Period still open", badge: "not_started" },
  not_computed: { label: "Run the months", badge: "not_started" },
  no_data: { label: "No data yet", badge: "no_activity" },
};

const TAX_LABEL = { sales: "Sales / use tax", excise: "Vapor excise" } as const;

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function monthsCovered(r: PeriodicRow) {
  const have = new Set(r.monthsWithData);
  return (
    <span className="inline-flex gap-[3px]" title={`${r.monthsWithData.length} of ${r.months.length} months have data`}>
      {r.months.map((m) => (
        <span
          key={m}
          className="inline-block h-[9px] w-[9px] rounded-[2px]"
          style={{ background: have.has(m) ? "var(--accent)" : "var(--line)" }}
        />
      ))}
    </span>
  );
}

function Table({ rows }: { rows: PeriodicRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="qtable">
        <thead>
          <tr>
            <th>State</th>
            <th>Tax</th>
            <th>Period</th>
            <th>Months in</th>
            <th>Due</th>
            <th>Status</th>
            <th className="num">Tax due</th>
            <th className="num">Collected</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = STATUS[r.status];
            const href = `/returns/${r.state}/${r.taxType}/${r.period}`;
            return (
              <tr key={`${r.state}-${r.taxType}-${r.period}`} className={r.status === "overdue" ? "flagged" : ""}>
                <td>
                  <strong>{r.state}</strong>{" "}
                  <span className="text-[var(--muted)]">{stateName(r.state)}</span>
                </td>
                <td>{TAX_LABEL[r.taxType]}</td>
                <td>{r.label}</td>
                <td>
                  {monthsCovered(r)}
                  <span className="ml-1.5 text-[11px] text-[var(--muted)]">
                    {r.monthsWithData.length}/{r.months.length}
                  </span>
                </td>
                <td className="tnum">{fmtDate(r.dueDate)}</td>
                <td>
                  <span className={`badge badge-${s.badge}`}>{s.label}</span>
                </td>
                <td className="num font-semibold">
                  {r.taxComputed === null ? "—" : fmtMoney(r.taxComputed)}
                  {r.warnings.length > 0 && (
                    <div
                      className="max-w-[260px] whitespace-normal text-left text-[11px] font-normal text-[var(--danger)]"
                      title={r.warnings.join("\n\n")}
                    >
                      {r.warnings[0].length > 70 ? `${r.warnings[0].slice(0, 70)}…` : r.warnings[0]}
                      {r.warnings.length > 1 && ` (+${r.warnings.length - 1} more)`}
                    </div>
                  )}
                </td>
                <td className="num">{r.taxCollected === null ? "—" : fmtMoney(r.taxCollected)}</td>
                <td>
                  {r.status !== "no_data" && (
                    <Link href={href} className="text-[12px] text-[var(--accent)]">
                      Open &rarr;
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function QuarterlyAnnualPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const thisYear = new Date().getUTCFullYear();
  const { year: yearParam } = await searchParams;
  const year = /^\d{4}$/.test(yearParam ?? "") ? Number(yearParam) : thisYear;

  const rows = await loadPeriodic(year);
  const quarterly = rows.filter((r) => r.frequency === "QUARTERLY");
  const annual = rows.filter((r) => r.frequency === "ANNUAL");

  const overdue = rows.filter((r) => r.status === "overdue");
  const next = rows.find((r) => r.status !== "filed" && !["overdue", "no_data"].includes(r.status));
  const nextGroup = next ? rows.filter((r) => r.dueDate === next.dueDate && r.status !== "filed") : [];
  const yearTotal = rows.reduce((s, r) => s + (r.taxComputed ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Quarterly &amp; Annual</h1>
            <p className="page-sub mt-0.5">
              Every return that is not filed monthly, with the amount to pay and when. States
              move on or off this list when their filing frequency is changed in Config.
            </p>
          </div>
          <div className="pagehead-actions">
            {[year - 1, year, year + 1].map((y) => (
              <Link
                key={y}
                href={`/quarterly-annual?year=${y}`}
                className="tab"
                data-active={y === year}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="stat">
          <div className="stat-label">Overdue</div>
          <div className={`stat-value ${overdue.length ? "text-[var(--danger)]" : ""}`}>
            {overdue.length ? fmtMoney(overdue.reduce((s, r) => s + (r.taxComputed ?? 0), 0)) : "None"}
          </div>
          <div className="text-[11.5px] text-[var(--muted)]">
            {overdue.length
              ? `${overdue.length} return${overdue.length === 1 ? "" : "s"} past due and not marked filed`
              : "Nothing past due"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Next due</div>
          <div className="stat-value">
            {next ? fmtMoney(nextGroup.reduce((s, r) => s + (r.taxComputed ?? 0), 0)) : "—"}
          </div>
          <div className="text-[11.5px] text-[var(--muted)]">
            {next
              ? `${fmtDate(next.dueDate)} · ${nextGroup.map((r) => `${r.state} ${r.label}`).join(", ")}${
                  nextGroup.some((r) => !r.closed) ? " · running total, period still open" : ""
                }`
              : "Nothing scheduled"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">{year} so far</div>
          <div className="stat-value">{fmtMoney(yearTotal)}</div>
          <div className="text-[11.5px] text-[var(--muted)]">
            Quarterly and annual returns combined
          </div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="callout callout-warn">
          <strong>Overdue means the due date has passed and the return is not marked filed here.</strong>{" "}
          If you already filed and paid it on the state portal, open it and record the confirmation
          number — it moves to Filed and stops counting as overdue.
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="panel-head">Quarterly · {quarterly.length} returns</div>
        {quarterly.length ? <Table rows={quarterly} /> : <p className="p-4 text-[13px] text-[var(--muted)]">No state files quarterly in {year}.</p>}
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head">Annual · {annual.length} returns</div>
        {annual.length ? <Table rows={annual} /> : <p className="p-4 text-[13px] text-[var(--muted)]">No state files annually in {year}.</p>}
      </div>

      <div className="help space-y-2">
        <p>
          <strong>How the amount is worked out.</strong> A quarterly or annual return uses exactly
          the same calculation as a monthly one: every sale shipped into that state is added up,
          the state&rsquo;s rate (and each city or county rate) is applied, and the total is
          rounded the way that state&rsquo;s form rounds. The only difference is the window — Q1
          adds January, February and March together; an annual return adds all twelve months.
        </p>
        <p>
          <strong>When it updates.</strong> The figure is recalculated every time you run one of
          the months inside it on the Months page. Until the period ends it is a running total —
          the small squares show which months have data in so far. Opening a return recalculates
          it live and shows the line-by-line breakdown and the worksheet to file from.
        </p>
        <p>
          <strong>Due dates</strong> come from each state&rsquo;s rule in Config: the due day of
          the month after the period ends (quarterly returns in April, July, October and January;
          annual returns in January of the next year).
        </p>
      </div>
    </div>
  );
}
