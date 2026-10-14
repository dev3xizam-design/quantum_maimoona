import Link from "next/link";
import { getDashboard } from "@/lib/dashboard";
import { fmtMoney } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import { stateName } from "@/lib/states";
import {
  IconCalendar,
  IconConfig,
  IconGuide,
  IconMonths,
  IconPortals,
  IconProducts,
  IconReturns,
  IconUpload,
  IconStores,
  IconOrders,
  IconMail,
} from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Quantum" };

// Pinterest & Mobbin-inspired Categorized Hub Tiles
function QuickNavTile({
  href,
  title,
  sub,
  icon,
  badge,
  category,
}: {
  href: string;
  title: string;
  sub: string;
  icon: React.ReactNode;
  badge?: string;
  category?: "core" | "data" | "system";
}) {
  const iconBg =
    category === "core"
      ? "bg-[#4C050C]/10 text-[#4C050C] group-hover:bg-[#4C050C] group-hover:text-white"
      : category === "data"
      ? "bg-[#94B1C8]/25 text-[#1D364A] group-hover:bg-[#3B6483] group-hover:text-white"
      : "bg-[rgba(26,9,5,0.06)] text-[#1A0905] group-hover:bg-[#1A0905] group-hover:text-white";

  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between p-4 rounded-2xl bg-[#EAE5D8] border border-[rgba(26,9,5,0.08)] shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg hover:border-[#4C050C]/40 hover:bg-[#F5F2EB]"
      style={{
        boxShadow: "0 2px 8px -2px rgba(26, 9, 5, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${iconBg}`}
        >
          {icon}
        </span>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#4C050C] text-white shadow-xs">
            {badge}
          </span>
        )}
      </div>
      <div>
        <div className="text-[13px] font-bold text-[#1A0905] group-hover:text-[#4C050C] transition-colors flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[11px] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-[#4C050C]">→</span>
        </div>
        <div className="text-[11px] text-[#4E5D6C] mt-0.5 line-clamp-1">{sub}</div>
      </div>
    </Link>
  );
}

function MetricCard({
  title,
  value,
  sub,
  tag,
  variant = "cream",
  href,
}: {
  title: string;
  value: string;
  sub: string;
  tag?: string;
  variant?: "cream" | "ice" | "alert";
  href: string;
}) {
  const bgStyles =
    variant === "ice"
      ? "bg-[#A4C0D4] hover:bg-[#B1CEE0] border-[rgba(20,37,51,0.15)] hover:border-[#142533]/30 text-[#142533]"
      : variant === "alert"
      ? "bg-[#FAF5ED] hover:bg-[#FFF9F0] border-[#4C050C]/25 hover:border-[#4C050C]/50 text-[#1A0905]"
      : "bg-[#EAE5D8] hover:bg-[#F5F1E8] border-[rgba(26,9,5,0.1)] hover:border-[#4C050C]/35 text-[#1A0905]";

  const subStyles =
    variant === "ice"
      ? "text-[#2D5270]"
      : variant === "alert"
      ? "text-[#8E0E1B]"
      : "text-[#5C5440]";

  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between p-5 rounded-2xl border shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl ${bgStyles}`}
      style={{
        boxShadow: "0 4px 16px -2px rgba(26, 9, 5, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-wider uppercase opacity-75">
          {title}
        </span>
        {tag && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/70 backdrop-blur-sm shadow-2xs group-hover:bg-white transition-colors">
            {tag}
          </span>
        )}
      </div>
      <div className="my-3">
        <div className="text-[28px] font-extrabold tracking-tight font-sans leading-none">
          {value}
        </div>
      </div>
      <div className={`text-[12px] font-medium flex items-center justify-between ${subStyles}`}>
        <span>{sub}</span>
        <span className="text-[14px] transition-transform duration-300 ease-out group-hover:translate-x-1.5">
          →
        </span>
      </div>
    </Link>
  );
}

function DeadlineRow({
  d,
}: {
  d: { state: string; taxType: string; period: string; dueDate: string; days: number; amount: number | null };
}) {
  const late = d.days < 0;
  return (
    <Link
      href={`/months/${d.period.length === 7 ? d.period : d.period.slice(0, 4) + "-01"}/${d.state}`}
      className="group flex items-center gap-3.5 px-4 py-3 border-b border-[rgba(26,9,5,0.06)] last:border-0 hover:bg-[#4C050C]/[0.06] hover:pl-5 transition-all duration-200"
    >
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-extrabold tracking-wide shadow-2xs transition-transform duration-200 group-hover:scale-105 ${
          late ? "bg-[#4C050C] text-white" : "bg-[#3B6483] text-white"
        }`}
      >
        {d.state}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-[#1A0905] group-hover:text-[#4C050C] transition-colors truncate">
          {stateName(d.state)} · <span className="font-medium text-[#4E5D6C]">{d.taxType}</span>
        </div>
        <div className="text-[11.5px] text-[#4E5D6C]">
          {d.period} · due {d.dueDate}
        </div>
      </div>
      <div className="text-right flex-none">
        <div
          className={`text-[13px] font-extrabold tnum ${
            late ? "text-[#4C050C]" : "text-[#1A0905]"
          }`}
        >
          {d.amount !== null ? fmtMoney(d.amount) : "—"}
        </div>
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
            late
              ? "bg-[#4C050C]/10 text-[#4C050C]"
              : d.days === 0
              ? "bg-[#E3DFCE] text-[#1A0905]"
              : "text-[#4E5D6C]"
          }`}
        >
          {late ? `${Math.abs(d.days)}d late` : d.days === 0 ? "due today" : `in ${d.days}d`}
        </span>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const d = await getDashboard();
  const latestMonth = d.latest?.month;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-[32px] font-black tracking-tight text-[#1A0905]">
            Dashboard
          </h1>
          <p className="text-[13.5px] text-[#4E5D6C] max-w-2xl mt-0.5">
            {d.latest
              ? `${periodLabel(d.latest.month)} is your most recent month. Everything below links straight to where the work is.`
              : "Upload your sales export to initialize calculations."}
          </p>
        </div>

        {latestMonth && (
          <div className="flex items-center gap-2.5 flex-none">
            <a
              href={`/api/period-workbook/${latestMonth}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-bold bg-[#EAE5D8] border border-[rgba(26,9,5,0.12)] text-[#1A0905] shadow-xs hover:bg-[#F5F2EB] hover:shadow-sm transition-all"
            >
              <span>Download Workbook</span>
            </a>
            <Link
              href={`/months/${latestMonth}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-extrabold shadow-sm hover:shadow-md transition-all active:scale-95"
              style={{
                backgroundColor: "#4C050C",
                color: "#FFFFFF",
              }}
            >
              <span style={{ color: "#FFFFFF" }}>Open {periodLabel(latestMonth)}</span>
              <span style={{ color: "#FFFFFF" }}>→</span>
            </Link>
          </div>
        )}
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Latest Month Tax"
          value={d.latest ? fmtMoney(d.latest.totalTax) : "—"}
          sub={d.latest ? `${periodLabel(d.latest.month)} · ${d.latest.states} States` : "No period ready"}
          tag={d.latest?.status || "Active"}
          variant="cream"
          href={latestMonth ? `/months/${latestMonth}` : "/months"}
        />
        <MetricCard
          title="Filing Months"
          value={`${d.monthsComputed} / ${d.monthsWithData}`}
          sub={
            d.monthsWithData > d.monthsComputed
              ? `${d.monthsWithData - d.monthsComputed} pending computation`
              : "All monthly returns computed"
          }
          variant="ice"
          href="/months"
        />
        <MetricCard
          title="Overdue Filings"
          value={d.overdueCount.toLocaleString()}
          sub={d.overdueCount ? "Past due state returns" : "Zero overdue filings"}
          tag={d.overdueCount > 0 ? "Attention Required" : "Compliant"}
          variant={d.overdueCount > 0 ? "alert" : "cream"}
          href="/returns?tab=overdue"
        />
        <MetricCard
          title="SKUs Missing Cost"
          value={d.gaps.noCost.toLocaleString()}
          sub={d.gaps.noCost ? "Excise basis understated" : "Full SKU compliance"}
          variant={d.gaps.noCost > 0 ? "alert" : "cream"}
          href="/products?tab=cost"
        />
      </div>

      {/* Primary Split View: Deadlines & Recent Months */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming State Deadlines */}
        <div
          className="flex flex-col rounded-2xl bg-[#EAE5D8] border border-[rgba(26,9,5,0.09)] shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-[#4C050C]/25"
          style={{
            boxShadow: "0 4px 16px -2px rgba(26, 9, 5, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(26,9,5,0.08)] bg-black/[0.02]">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[14px] text-[#1A0905]">
                {d.overdue.length ? "Action Required: Overdue & Upcoming" : "Upcoming Filing Deadlines"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#A4C0D4] text-[#142533]">
                {(d.overdue.length ? d.overdue : d.upcoming).length}
              </span>
            </div>
            <Link
              href="/returns"
              className="text-[12px] font-bold text-[#4C050C] hover:underline"
            >
              All returns →
            </Link>
          </div>

          <div className="divide-y divide-[rgba(26,9,5,0.06)] flex-1 overflow-y-auto max-h-[380px] pt-1">
            {(d.overdue.length ? d.overdue : d.upcoming).map((x, i) => (
              <DeadlineRow key={`${x.state}${x.taxType}${x.period}${i}`} d={x} />
            ))}
            {d.overdue.length === 0 && d.upcoming.length === 0 && (
              <div className="p-8 text-center text-[#4E5D6C]">
                <div className="font-bold text-[14px] text-[#1A0905]">All State Filings Current</div>
                <div className="text-[12px] mt-1">No pending state tax deadlines for computed periods.</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Monthly Calculations */}
        <div
          className="flex flex-col rounded-2xl bg-[#EAE5D8] border border-[rgba(26,9,5,0.09)] shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-[#4C050C]/25"
          style={{
            boxShadow: "0 4px 16px -2px rgba(26, 9, 5, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(26,9,5,0.08)] bg-black/[0.02]">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[14px] text-[#1A0905]">Recent Filing Months</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#A4C0D4] text-[#142533]">
                {d.months.length}
              </span>
            </div>
            <Link href="/months" className="text-[12px] font-bold text-[#4C050C] hover:underline">
              View all months →
            </Link>
          </div>

          <div className="divide-y divide-[rgba(26,9,5,0.06)] flex-1 overflow-y-auto max-h-[380px] pt-1">
            {d.months.map((m) => (
              <Link
                key={m.month}
                href={`/months/${m.month}`}
                className="group flex items-center justify-between px-5 py-3.5 hover:bg-[#4C050C]/[0.06] hover:pl-6 transition-all duration-200"
              >
                <div>
                  <div className="text-[13.5px] font-bold text-[#1A0905] group-hover:text-[#4C050C] transition-colors">
                    {periodLabel(m.month)}
                  </div>
                  <div className="text-[11.5px] text-[#4E5D6C] mt-0.5">
                    {m.states} States · <span className="capitalize">{m.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.warnings > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#4C050C]/10 text-[#4C050C]">
                      {m.warnings} warnings
                    </span>
                  )}
                  <span className="text-[13.5px] font-extrabold tnum text-[#1A0905]">
                    {fmtMoney(m.totalTax)}
                  </span>
                  <span className="text-[13px] text-[#4E5D6C] group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </Link>
            ))}
            {d.months.length === 0 && (
              <div className="p-8 text-center text-[#4E5D6C]">
                <div className="font-bold text-[14px] text-[#1A0905]">No Months Computed</div>
                <div className="text-[12px] mt-1">Upload an Avalara or Shopify report to generate calculations.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Stream: Data Gaps, PACT Stream & Upload History */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Missing Data Gaps */}
        <div
          className="p-5 rounded-2xl bg-[#EAE5D8] border border-[rgba(26,9,5,0.09)] shadow-sm flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-[#4C050C]/25 hover:bg-[#F5F2EB]"
          style={{
            boxShadow: "0 4px 16px -2px rgba(26, 9, 5, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13.5px] font-extrabold text-[#1A0905]">Data Gaps</span>
              <span className="text-[11px] font-bold text-[#4E5D6C]">Catalog Health</span>
            </div>
            <div className="space-y-2 text-[12.5px]">
              {[
                { n: d.gaps.noCost, label: "SKUs missing wholesale cost", href: "/products?tab=cost" },
                { n: d.gaps.noMl, label: "SKUs missing mL volume", href: "/products?tab=ml" },
                { n: d.gaps.noSystem, label: "SKUs missing open/closed classification", href: "/products?tab=system" },
              ].map((row) => (
                <Link
                  key={row.label}
                  href={row.href}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#4C050C]/[0.06] hover:pl-3 transition-all duration-200"
                >
                  <span className="text-[#4E5D6C]">{row.label}</span>
                  <span
                    className={`font-extrabold tnum ${
                      row.n > 0 ? "text-[#4C050C]" : "text-emerald-700"
                    }`}
                  >
                    {row.n.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          {d.gaps.noCost > 0 && (
            <div className="mt-4 pt-3 border-t border-[rgba(26,9,5,0.08)] text-[11px] text-[#4E5D6C]">
              Wholesale excise calculations remain estimated until costs are imported.
            </div>
          )}
        </div>

        {/* 2. PACT Compliance Feed */}
        <div
          className="p-5 rounded-2xl bg-[#EAE5D8] border border-[rgba(26,9,5,0.09)] shadow-sm flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-[#4C050C]/25 hover:bg-[#F5F2EB]"
          style={{
            boxShadow: "0 4px 16px -2px rgba(26, 9, 5, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13.5px] font-extrabold text-[#1A0905]">PACT Compliance Feed</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#A4C0D4] text-[#142533]">
                {d.stores.connected} Stores Active
              </span>
            </div>
            <div className="my-2">
              <div className="text-[28px] font-extrabold tnum text-[#1A0905]">
                {d.pactRows.toLocaleString()}
              </div>
              <div className="text-[11.5px] text-[#4E5D6C]">Compliant shipment records synced</div>
            </div>
            <p className="text-[11.5px] text-[#4E5D6C] mt-2 leading-relaxed">
              Customer identity and delivery verification records gathered directly from connected store APIs.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(26,9,5,0.08)]">
            <Link
              href="/config/stores"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold bg-[#A4C0D4] text-[#142533] hover:bg-[#92b0c6] shadow-2xs transition-colors"
            >
              <span>Configure Store Feeds</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* 3. Recent File Imports */}
        <div
          className="p-5 rounded-2xl bg-[#EAE5D8] border border-[rgba(26,9,5,0.09)] shadow-sm flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-[#4C050C]/25 hover:bg-[#F5F2EB]"
          style={{
            boxShadow: "0 4px 16px -2px rgba(26, 9, 5, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13.5px] font-extrabold text-[#1A0905]">Recent Data Imports</span>
              <Link href="/upload/history" className="text-[11px] font-bold text-[#4C050C] hover:underline">
                Audit history →
              </Link>
            </div>
            <div className="space-y-2 divide-y divide-[rgba(26,9,5,0.06)]">
              {d.uploads.slice(0, 3).map((u, i) => (
                <div key={i} className="pt-2 first:pt-0">
                  <div className="text-[12px] font-bold text-[#1A0905] truncate">{u.filename}</div>
                  <div className="text-[10.5px] text-[#4E5D6C] mt-0.5">
                    {u.kind} · {u.rows.toLocaleString()} rows · {u.when}
                  </div>
                </div>
              ))}
              {d.uploads.length === 0 && (
                <div className="text-[12px] text-[#4E5D6C] py-4 text-center">
                  No previous imports logged.
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(26,9,5,0.08)]">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold bg-[#E3DFCE] text-[#1A0905] border border-[rgba(26,9,5,0.12)] hover:bg-[#d8d3c0] shadow-2xs transition-colors"
            >
              <span>Upload CSV Report</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Categorized Quick Access Hub */}
      <section className="pt-2">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-wider text-[#1A0905]">
              Quick Access Command Hub
            </h2>
            <p className="text-[11.5px] text-[#4E5D6C]">Direct links into core calculations, data streams, and compliance tools.</p>
          </div>
          <span className="text-[11px] font-bold text-[#4C050C]">10 Modules</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <QuickNavTile
            href="/months"
            title="Tax Months"
            sub="State-by-state calculations"
            icon={<IconMonths />}
            badge={d.monthsWithData > d.monthsComputed ? `${d.monthsWithData - d.monthsComputed} pending` : undefined}
            category="core"
          />
          <QuickNavTile
            href="/calendar"
            title="Filing Calendar"
            sub="Deadlines & schedules"
            icon={<IconCalendar />}
            category="core"
          />
          <QuickNavTile
            href="/returns"
            title="State Returns"
            sub="Computed tax liabilities"
            icon={<IconReturns />}
            badge={d.overdueCount > 0 ? `${d.overdueCount} overdue` : undefined}
            category="core"
          />
          <QuickNavTile
            href="/upload"
            title="Upload Data"
            sub="Avalara, Shopify & CSVs"
            icon={<IconUpload />}
            category="data"
          />
          <QuickNavTile
            href="/products"
            title="Products & SKUs"
            sub={`${d.gaps.soldSkus.toLocaleString()} products active`}
            icon={<IconProducts />}
            badge={d.gaps.noCost > 0 ? `${d.gaps.noCost} uncosted` : undefined}
            category="data"
          />
          <QuickNavTile
            href="/orders"
            title="Orders Feed"
            sub="Transaction line items"
            icon={<IconOrders />}
            category="data"
          />
          <QuickNavTile
            href="/config/stores"
            title="Store Feeds"
            sub={`${d.stores.connected} of ${d.stores.total} connected`}
            icon={<IconStores />}
            category="data"
          />
          <QuickNavTile
            href="/pact-email"
            title="PACT Email"
            sub="Automated state return emails"
            icon={<IconMail />}
            category="data"
          />
          <QuickNavTile
            href="/portals"
            title="State Portals"
            sub={`${d.portals.withLink} official state logins`}
            icon={<IconPortals />}
            category="system"
          />
          <QuickNavTile
            href="/config"
            title="Rates & Rules"
            sub="Excise basis & effective dates"
            icon={<IconConfig />}
            category="system"
          />
          <QuickNavTile
            href="/guide"
            title="Knowledge Guide"
            sub="System rules & state nexus"
            icon={<IconGuide />}
            category="system"
          />
        </div>
      </section>
    </div>
  );
}
