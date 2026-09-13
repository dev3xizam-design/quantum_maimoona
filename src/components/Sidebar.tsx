"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import {
  IconAudit,
  IconCalendar,
  IconMonths,
  IconConfig,
  IconGuide,
  IconMenu,
  IconProducts,
  IconReturns,
  IconUpload,
  IconX,
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
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const current =
    GROUPS.flatMap((g) => g.links).find((l) => isActive(l.href))?.label ?? "Quantum";

  return (
    <>
      {/* Mobile header - the sidebar becomes a drawer below 1024px. */}
      <div className="mobilebar">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-white/85 hover:bg-white/10"
        >
          <IconMenu />
        </button>
        <Logo size={22} />
        <span className="text-[14px] font-semibold">{current}</span>
      </div>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <aside className="sidebar" data-open={open}>
        <div className="sidebar-brand">
          <Logo size={30} />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-white">Quantum</span>
            <span className="text-[9.5px] uppercase tracking-[0.15em] text-white/50">
              Tax Automation
            </span>
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden"
          >
            <IconX />
          </button>
        </div>

        <nav className="pb-3">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sidebar-group">{group.label}</div>
              {group.links.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="navlink"
                    data-active={isActive(l.href)}
                    onClick={() => setOpen(false)}
                  >
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
              className="w-full rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/10"
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
