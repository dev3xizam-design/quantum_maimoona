"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { fmtMoney } from "@/lib/money";
import { periodLabel } from "@/lib/periods";
import type { SidebarStats } from "@/lib/sidebar-stats";
import {
  IconAudit,
  IconCalendar,
  IconConfig,
  IconGuide,
  IconMonths,
  IconProducts,
  IconReturns,
  IconUpload,
} from "./icons";

type Badge = "overdue" | "review" | "months" | null;

const GROUPS: {
  label: string;
  links: { href: string; label: string; icon: () => React.ReactElement; badge?: Badge }[];
}[] = [
  {
    label: "Filing",
    links: [
      { href: "/months", label: "Months", icon: IconMonths, badge: "months" },
      { href: "/", label: "Calendar", icon: IconCalendar },
      { href: "/returns", label: "Returns", icon: IconReturns, badge: "overdue" },
    ],
  },
  {
    label: "Data",
    links: [
      { href: "/upload", label: "Upload", icon: IconUpload },
      { href: "/products", label: "Products", icon: IconProducts, badge: "review" },
    ],
  },
  {
    label: "Setup",
    links: [
      { href: "/config", label: "Config", icon: IconConfig },
      { href: "/audit", label: "Audit", icon: IconAudit },
      { href: "/guide", label: "Guide", icon: IconGuide },
    ],
  },
];

const PRIMARY = [
  { href: "/months", label: "Months", icon: IconMonths },
  { href: "/", label: "Calendar", icon: IconCalendar },
  { href: "/products", label: "Products", icon: IconProducts },
  { href: "/upload", label: "Upload", icon: IconUpload },
  { href: "/guide", label: "Guide", icon: IconGuide },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({
  user,
  stats,
  onSignOut,
}: {
  user: { name: string; email: string };
  stats: SidebarStats;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Remember the choice, but never block the first paint on it.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("q.sidebar") === "collapsed");
    } catch {
      /* private mode */
    }
  }, []);
  const toggle = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem("q.sidebar", v ? "open" : "collapsed");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const current = PRIMARY.find((l) => isActive(l.href))?.label ?? "Quantum";

  const badgeFor = (b: Badge) => {
    if (b === "overdue" && stats.overdue > 0) return { n: stats.overdue, tone: "danger" as const };
    if (b === "review" && stats.toReview > 0) return { n: stats.toReview, tone: "warn" as const };
    if (b === "months" && stats.monthsUncomputed > 0)
      return { n: stats.monthsUncomputed, tone: "warn" as const };
    return null;
  };

  return (
    <>
      <div className="mobilebar">
        <Logo size={24} />
        <span className="text-[15px] font-semibold">{current}</span>
        {stats.overdue > 0 && (
          <span className="rounded-full bg-[var(--danger)] px-2 py-0.5 text-[10.5px] font-bold text-white">
            {stats.overdue} overdue
          </span>
        )}
        <form action={onSignOut} className="ml-auto">
          <button className="rounded-lg px-2 py-1 text-[12px] font-semibold text-white/75" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <nav className="tabbar">
        {PRIMARY.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="tabitem" data-active={isActive(l.href)}>
              <Icon />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <aside className="sidebar" data-collapsed={collapsed}>
        <div className="sidebar-brand">
          <Logo size={30} />
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-white">Quantum</span>
              <span className="text-[9.5px] uppercase tracking-[0.15em] text-white/45">
                Sales Tax Calculator AI
              </span>
            </span>
          )}
          <button
            onClick={toggle}
            className="sidebar-toggle ml-auto"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={collapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
            </svg>
          </button>
        </div>

        {/* The number you are working toward, one click from anywhere. */}
        {!collapsed && stats.latest && (
          <Link href={`/months/${stats.latest.month}`} className="sidecard">
            <div className="sidecard-label">{periodLabel(stats.latest.month)}</div>
            <div className="sidecard-value">{fmtMoney(stats.latest.totalTax)}</div>
            <div className="sidecard-sub">
              {stats.latest.states} states · {stats.latest.status}
            </div>
          </Link>
        )}

        {!collapsed && stats.nextDue && (
          <div className="sidenext">
            <span className="sidenext-dot" data-soon={stats.nextDue.days <= 3} />
            <span>
              <strong>{stats.nextDue.state}</strong> {stats.nextDue.taxType} due{" "}
              {stats.nextDue.days === 0
                ? "today"
                : stats.nextDue.days === 1
                  ? "tomorrow"
                  : `in ${stats.nextDue.days} days`}
            </span>
          </div>
        )}

        <nav className="pb-3">
          {GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && <div className="sidebar-group">{group.label}</div>}
              {collapsed && <div className="sidebar-rule" />}
              {group.links.map((l) => {
                const Icon = l.icon;
                const badge = badgeFor(l.badge ?? null);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="navlink"
                    data-active={isActive(l.href)}
                    title={collapsed ? l.label : undefined}
                  >
                    <Icon />
                    {!collapsed && <span>{l.label}</span>}
                    {badge && (
                      <span className="navbadge" data-tone={badge.tone}>
                        {badge.n > 99 ? "99+" : badge.n}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="flex items-center gap-2.5">
            <span className="avatar">{initials(user.name)}</span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-white/90">
                  {user.name}
                </span>
                <span className="block truncate text-[10.5px] text-white/45">{user.email}</span>
              </span>
            )}
          </div>
          <form action={onSignOut} className="mt-2.5">
            <button
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/12 hover:text-white"
              type="submit"
            >
              {collapsed ? "↦" : "Sign out"}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
