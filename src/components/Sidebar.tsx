"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import {
  IconAudit,
  IconCalendar,
  IconMonths,
  IconConfig,
  IconGuide,
  IconProducts,
  IconReturns,
  IconUpload,
} from "./icons";

const GROUPS: {
  label: string;
  links: { href: string; label: string; icon: () => React.ReactElement }[];
}[] = [
  {
    label: "Filing",
    links: [
      { href: "/months", label: "Months", icon: IconMonths },
      { href: "/", label: "Calendar", icon: IconCalendar },
      { href: "/returns", label: "Returns", icon: IconReturns },
    ],
  },
  {
    label: "Data",
    links: [
      { href: "/upload", label: "Upload", icon: IconUpload },
      { href: "/products", label: "Products", icon: IconProducts },
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

export function Sidebar({
  user,
  onSignOut,
}: {
  user: { name: string; email: string };
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const current =
    GROUPS.flatMap((g) => g.links).find((l) => isActive(l.href))?.label ?? "Quantum";

  const primary = [
    { href: "/months", label: "Months", icon: IconMonths },
    { href: "/", label: "Calendar", icon: IconCalendar },
    { href: "/products", label: "Products", icon: IconProducts },
    { href: "/upload", label: "Upload", icon: IconUpload },
    { href: "/guide", label: "Guide", icon: IconGuide },
  ];

  return (
    <>
      {/* Phone: a title bar plus a bottom tab bar, the way an app works. */}
      <div className="mobilebar">
        <Logo size={24} />
        <span className="text-[15px] font-semibold">{current}</span>
        <form action={onSignOut} className="ml-auto">
          <button className="rounded-lg px-2 py-1 text-[12px] font-semibold text-white/75" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <nav className="tabbar">
        {primary.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="tabitem" data-active={isActive(l.href)}>
              <Icon />
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Laptop and up: the full sidebar. */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={30} />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-white">Quantum</span>
            <span className="text-[9.5px] uppercase tracking-[0.15em] text-white/50">
              Tax Automation
            </span>
          </span>
        </div>

        <nav className="pb-3">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sidebar-group">{group.label}</div>
              {group.links.map((l) => {
                const Icon = l.icon;
                return (
                  <Link key={l.href} href={l.href} className="navlink" data-active={isActive(l.href)}>
                    <Icon />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="px-2 pb-2">
            <div className="truncate text-[12px] font-medium text-white/90">{user.name}</div>
            <div className="truncate text-[10.5px] text-white/45">{user.email}</div>
          </div>
          <form action={onSignOut}>
            <button
              className="w-full rounded-xl border border-white/20 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/10"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
