"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import type { SidebarStats } from "@/lib/sidebar-stats";
import {
  IconCalendar,
  IconDashboard,
  IconConfig,
  IconPortals,
  IconGuide,
  IconMonths,
  IconProducts,
  IconReturns,
  IconUpload,
  IconStores,
  IconMarketplace,
  IconOrders,
} from "./icons";

type Badge = "overdue" | "review" | "months" | null;

interface NavItem {
  href: string;
  label: string;
  icon: () => React.ReactElement;
  badge?: Badge;
}

const NAV_ITEMS: { category: string; items: NavItem[] }[] = [
  {
    category: "Core",
    items: [
      { href: "/", label: "Dashboard", icon: IconDashboard },
      { href: "/months", label: "Months", icon: IconMonths, badge: "months" },
      { href: "/calendar", label: "Calendar", icon: IconCalendar },
      { href: "/returns", label: "Returns", icon: IconReturns, badge: "overdue" },
    ],
  },
  {
    category: "Data",
    items: [
      { href: "/upload", label: "Upload Data", icon: IconUpload },
      { href: "/orders", label: "Orders", icon: IconOrders },
      { href: "/products", label: "Products", icon: IconProducts, badge: "review" },
      { href: "/config/stores", label: "Stores", icon: IconStores },
      { href: "/marketplace", label: "Marketplace", icon: IconMarketplace },
    ],
  },
  {
    category: "System",
    items: [
      { href: "/portals", label: "State Portals", icon: IconPortals },
      { href: "/config", label: "Tax Configuration", icon: IconConfig },
      { href: "/guide", label: "Knowledge Guide", icon: IconGuide },
    ],
  },
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

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/config"
        ? pathname.startsWith(href) && !pathname.startsWith("/config/stores")
        : pathname.startsWith(href);

  const getBadgeCount = (badge?: Badge) => {
    if (!badge) return 0;
    if (badge === "overdue") return stats.overdue;
    if (badge === "review") return stats.toReview;
    if (badge === "months") return stats.monthsUncomputed;
    return 0;
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="mobilebar">
        <Logo size={28} />
        <span className="text-[14px] font-bold tracking-tight">Quantum</span>
        {stats.overdue > 0 && (
          <span className="rounded-full bg-[var(--red-pop)] px-2 py-0.5 text-[10px] font-bold text-white">
            {stats.overdue} overdue
          </span>
        )}
        <form action={onSignOut} className="ml-auto">
          <button className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-white/75 hover:text-white" type="submit">
            Sign out
          </button>
        </form>
      </div>

      {/* Desktop Antigravity / Mobbin Style Minimalist Icon Dock */}
      <aside className="sidebar-dock group/dock">
        {/* Top: Pure Background-less Q Logo with Styled Dock Tooltip */}
        <div className="dock-brand pt-2 relative group/item flex items-center justify-center w-full">
          <Link
            href="/"
            className="group/logo relative flex items-center justify-center p-1 transition-transform duration-200 hover:scale-110 active:scale-95"
            aria-label="Quantum Home"
          >
            <Logo size={36} />
          </Link>
          <div className="dock-tooltip">
            <span className="font-semibold text-[#E3DFCE]">Quantum</span>
          </div>
        </div>

        {/* Middle: Navigation Icons with Floating Tooltips */}
        <nav className="dock-nav flex flex-col items-center gap-1.5 py-2 w-full">
          {NAV_ITEMS.map((group, groupIdx) => (
            <div key={group.category} className="flex flex-col items-center gap-1.5 w-full">
              {groupIdx > 0 && <div className="dock-divider" />}
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const badgeCount = getBadgeCount(item.badge);

                return (
                  <div key={item.href} className="relative group/item flex items-center justify-center w-full">
                    <Link
                      href={item.href}
                      className={`dock-btn ${active ? "dock-btn-active" : "dock-btn-inactive"}`}
                      aria-label={item.label}
                    >
                      <Icon />
                      {/* Red notification dot on icon if there's an alert */}
                      {badgeCount > 0 && (
                        <span className="dock-dot" />
                      )}
                    </Link>

                    {/* Floating Tooltip (Antigravity IDE & Mobbin style) */}
                    <div className="dock-tooltip">
                      <span className="font-semibold">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="dock-tooltip-badge">
                          {badgeCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: Profile & Sign out with pb-24 clearance to prevent Next.js dev overlay overlap */}
        <div className="dock-foot flex flex-col items-center gap-2 mt-auto pb-24 w-full">
          <div className="dock-divider" />
          
          {/* User Avatar with Tooltip */}
          <div className="relative group/item flex items-center justify-center">
            <div className="dock-avatar" title={user.name}>
              {initials(user.name || "Admin")}
            </div>
            <div className="dock-tooltip">
              <span className="font-semibold block">{user.name}</span>
              <span className="text-[10px] text-white/60 block">{user.email}</span>
            </div>
          </div>

          {/* Sign Out Button with Tooltip */}
          <div className="relative group/item flex items-center justify-center">
            <form action={onSignOut}>
              <button
                type="submit"
                className="dock-btn dock-btn-inactive text-white/50 hover:text-red-400 hover:bg-red-500/10"
                aria-label="Sign out"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </form>
            <div className="dock-tooltip">
              <span className="font-semibold">Sign out</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
