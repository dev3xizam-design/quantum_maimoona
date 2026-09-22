import Link from "next/link";
import { getDashboard } from "@/lib/dashboard";
import { fmtMoney } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import { stateName } from "@/lib/states";
import {
  IconAudit,
  IconCalendar,
  IconConfig,
  IconGuide,
  IconMonths,
  IconPortals,
  IconProducts,
  IconReturns,
  IconUpload,
} from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const TONES = {
  violet: { bg: "var(--violet-soft)", fg: "var(--violet)" },
  green: { bg: "var(--green-soft)", fg: "var(--green)" },
  blue: { bg: "var(--blue-soft)", fg: "var(--blue)" },
  amber: { bg: "var(--amber-soft)", fg: "var(--amber)" },
  rose: { bg: "var(--rose-soft)", fg: "var(--rose)" },
  teal: { bg: "var(--teal-soft)", fg: "var(--teal)" },
} as const;

function QuickLink({
  href,
  title,
  sub,
  tone,
  icon,
  delay,
  badge,
}: {
  href: string;
  title: string;
  sub: string;
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  delay: number;
  badge?: string;
}) {
  const skin = TONES[tone];
  return (
    <Link
      href={href}
      className="tile anim-up"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <span className="flex items-center gap-2">
        <span className="tile-icon" style={{ background: skin.bg, color: skin.fg }}>
          {icon}
        </span>
        {badge && <span className="badge badge-overdue ml-auto">{badge}</span>}
      </span>
      <span>
        <span className="tile-title block">{title}</span>
        <span className="tile-sub">{sub}</span>
      </span>
    </Link>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  href,
  delay,
}: {
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof TONES | "warn";
  href: string;
  delay: number;
}) {
  const skin = tone === "warn" ? { bg: "var(--danger-soft)", fg: "var(--danger)" } : TONES[tone];
  return (
    <Link href={href} className="stat anim-up" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      <span className="tile-icon" style={{ background: skin.bg, color: skin.fg }}>
        {label === "Overdue" ? <IconReturns /> : <IconMonths />}
      </span>
      <div className="stat-label mt-2.5">{label}</div>
      <div className="stat-value" style={tone === "warn" ? { color: "var(--danger)" } : undefined}>
        {value}
      </div>
      <div className="stat-sub">{sub}</div>
    </Link>
  );
}

function Deadline({ d }: { d: { state: string; taxType: string; period: string; dueDate: string; days: number; amount: number | null } }) {
  const late = d.days < 0;
  return (
    <Link
      href={`/months/${d.period.length === 7 ? d.period : d.period.slice(0, 4) + "-01"}/${d.state}`}
      className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-0 hover:bg-[#f9fafd]"
    >
      <span className={`badge ${late ? "badge-overdue" : "badge-ready"}`}>{d.state}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium">
          {stateName(d.state)} · {d.taxType}
        </span>
        <span className="block text-[11px] text-[var(--muted)]">
          {d.period} · due {d.dueDate}
        </span>
      </span>
      <span className="ml-auto text-right">
        <span
          className={`block text-[12.5px] font-semibold tnum ${late ? "text-[var(--danger)]" : ""}`}
        >
          {d.amount !== null ? fmtMoney(d.amount) : "—"}
        </span>
        <span className="block text-[11px] text-[var(--muted)]">
          {late ? `${Math.abs(d.days)}d late` : d.days === 0 ? "today" : `in ${d.days}d`}
        </span>
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const d = await getDashboard();
  const latestMonth = d.latest?.month;

  return (
    <div className="space-y-5">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub mt-0.5">
              {d.latest
                ? `${periodLabel(d.latest.month)} is your most recent month. Everything below links straight to where the work is.`
                : "Upload an Avalara export to get started — everything else follows from it."}
            </p>
          </div>
          {latestMonth && (
            <div className="pagehead-actions">
              <a className="btn" href={`/api/period-workbook/${latestMonth}`}>
                Download workbook
              </a>
              <Link className="btn btn-primary" href={`/months/${latestMonth}`}>
                Open {periodLabel(latestMonth)}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ---- headline numbers ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Latest month"
          value={d.latest ? fmtMoney(d.latest.totalTax) : "—"}
          sub={d.latest ? `${periodLabel(d.latest.month)} · ${d.latest.states} states` : "nothing computed"}
          tone="violet"
          href={latestMonth ? `/months/${latestMonth}` : "/months"}
          delay={0}
        />
        <Stat
          label="Overdue"
          value={d.overdueCount.toLocaleString()}
          sub={d.overdueCount ? "returns past their due date" : "nothing outstanding"}
          tone={d.overdueCount ? "warn" : "green"}
          href="/returns?tab=overdue"
          delay={60}
        />
        <Stat
          label="Months stored"
          value={`${d.monthsComputed} / ${d.monthsWithData}`}
          sub={
            d.monthsWithData > d.monthsComputed
              ? `${d.monthsWithData - d.monthsComputed} not computed yet`
              : "all months computed"
          }
          tone="blue"
          href="/months"
          delay={120}
        />
        <Stat
          label="SKUs missing cost"
          value={d.gaps.noCost.toLocaleString()}
          sub={d.gaps.noCost ? "excise is understated" : "nothing outstanding"}
          tone={d.gaps.noCost ? "amber" : "green"}
          href="/products?tab=cost"
          delay={180}
        />
      </div>

      {/* ---- quick links ---- */}
      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
          Jump to
        </h2>
        <div className="tilegrid">
          <QuickLink
            href="/months"
            title="Months"
            sub="Every month, state by state"
            tone="violet"
            icon={<IconMonths />}
            delay={0}
            badge={d.monthsWithData > d.monthsComputed ? `${d.monthsWithData - d.monthsComputed} to compute` : undefined}
          />
          <QuickLink
            href="/upload"
            title="Upload"
            sub="Avalara export, purchases, Shopify"
            tone="blue"
            icon={<IconUpload />}
            delay={50}
          />
          <QuickLink
            href="/products"
            title="Products"
            sub={`${d.gaps.soldSkus.toLocaleString()} SKUs have sold`}
            tone="teal"
            icon={<IconProducts />}
            delay={100}
            badge={d.gaps.noCost ? `${d.gaps.noCost} need cost` : undefined}
          />
          <QuickLink
            href="/returns"
            title="Returns"
            sub="Every computed return"
            tone="rose"
            icon={<IconReturns />}
            delay={150}
            badge={d.overdueCount ? `${d.overdueCount} overdue` : undefined}
          />
          <QuickLink
            href="/calendar"
            title="Calendar"
            sub="What is due, and when"
            tone="amber"
            icon={<IconCalendar />}
            delay={200}
          />
          <QuickLink
            href="/portals"
            title="Portals"
            sub={`${d.portals.withLink} state logins, one click away`}
            tone="teal"
            icon={<IconPortals />}
            delay={250}
          />
          <QuickLink
            href="/config/stores"
            title="Stores"
            sub={`${d.stores.connected} of ${d.stores.total} connected`}
            tone="violet"
            icon={<IconConfig />}
            delay={300}
          />
          <QuickLink
            href="/config"
            title="Rates & rules"
            sub="Editable, effective-dated"
            tone="green"
            icon={<IconConfig />}
            delay={350}
          />
          <QuickLink
            href="/guide"
            title="Guide"
            sub="How the whole system works"
            tone="blue"
            icon={<IconGuide />}
            delay={400}
          />
        </div>
      </section>

      {/* ---- deadlines + months ---- */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="panel overflow-hidden">
          <div className="panel-head">
            {d.overdue.length ? "Overdue" : "Coming up"}
            <Link href="/returns" className="ml-auto text-[12px] font-normal text-[var(--accent)]">
              all returns →
            </Link>
          </div>
          {(d.overdue.length ? d.overdue : d.upcoming).map((x, i) => (
            <Deadline key={`${x.state}${x.taxType}${x.period}${i}`} d={x} />
          ))}
          {d.overdue.length === 0 && d.upcoming.length === 0 && (
            <div className="empty">
              <strong>Nothing due.</strong>
              <span>Every computed return has been filed.</span>
            </div>
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="panel-head">
            Recent months
            <Link href="/months" className="ml-auto text-[12px] font-normal text-[var(--accent)]">
              all months →
            </Link>
          </div>
          {d.months.map((m) => (
            <Link
              key={m.month}
              href={`/months/${m.month}`}
              className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-0 hover:bg-[#f9fafd]"
            >
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold">{periodLabel(m.month)}</span>
                <span className="block text-[11px] text-[var(--muted)]">
                  {m.states} states · {m.status}
                </span>
              </span>
              <span className="ml-auto flex items-center gap-2.5">
                {m.warnings > 0 && <span className="badge badge-not_started">{m.warnings}</span>}
                <span className="text-[13px] font-semibold tnum">{fmtMoney(m.totalTax)}</span>
              </span>
            </Link>
          ))}
          {d.months.length === 0 && (
            <div className="empty">
              <strong>No months computed yet.</strong>
              <span>Upload an export, then open the month.</span>
            </div>
          )}
        </section>
      </div>

      {/* ---- what is holding things up ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-5">
          <h3 className="text-[13.5px] font-semibold">Data still needed</h3>
          <div className="mt-3 space-y-2 text-[12.5px]">
            {[
              { n: d.gaps.noCost, label: "SKUs with no wholesale cost", href: "/products?tab=cost" },
              { n: d.gaps.noMl, label: "SKUs with no mL", href: "/products?tab=ml" },
              { n: d.gaps.noSystem, label: "SKUs with no open/closed", href: "/products?tab=system" },
            ].map((row) => (
              <Link key={row.label} href={row.href} className="flex items-center justify-between hover:opacity-80">
                <span className="text-[var(--muted)]">{row.label}</span>
                <span className={`font-semibold tnum ${row.n ? "text-[var(--danger)]" : "text-[var(--ok)]"}`}>
                  {row.n.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
          {d.gaps.noCost > 0 && (
            <p className="mt-3 text-[11.5px] text-[var(--muted)]">
              Percentage-of-wholesale excise stays understated until cost is loaded.
            </p>
          )}
        </section>

        <section className="panel p-5">
          <h3 className="text-[13.5px] font-semibold">PACT feed</h3>
          <div className="mt-2 text-[26px] font-bold tnum">{d.pactRows.toLocaleString()}</div>
          <p className="text-[12px] text-[var(--muted)]">shipment lines stored</p>
          <p className="mt-3 text-[11.5px] text-[var(--muted)]">
            PACT needs the customer name and address, which a sales-tax export does not carry. It
            comes from your stores&rsquo; orders.
          </p>
          <Link className="btn btn-sm mt-3" href="/config/stores">
            Sync orders
          </Link>
        </section>

        <section className="panel overflow-hidden">
          <div className="panel-head">
            Recent uploads
            <Link href="/upload/history" className="ml-auto text-[12px] font-normal text-[var(--accent)]">
              history →
            </Link>
          </div>
          {d.uploads.map((u, i) => (
            <div key={i} className="border-b border-[var(--line)] px-4 py-2.5 last:border-0">
              <div className="truncate text-[12.5px] font-medium">{u.filename}</div>
              <div className="text-[11px] text-[var(--muted)]">
                {u.kind} · {u.rows.toLocaleString()} rows · {u.when}
              </div>
            </div>
          ))}
          {d.uploads.length === 0 && <div className="empty">Nothing uploaded yet.</div>}
        </section>
      </div>
    </div>
  );
}
