"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/", label: "Calendar", hint: "What is due and what is overdue" },
  { href: "/period", label: "Close month", hint: "Compute every state at once" },
  { href: "/returns", label: "Returns", hint: "Every computed return" },
  { href: "/products", label: "Products", hint: "SKUs, prices, excise data" },
  { href: "/upload", label: "Upload", hint: "Avalara export and supporting files" },
  { href: "/config", label: "Config", hint: "Rates, codes, frequencies" },
  { href: "/audit", label: "Audit", hint: "Every change and every run" },
  { href: "/guide", label: "Guide", hint: "How the whole system works" },
];

export function Nav({
  user,
  onSignOut,
}: {
  user: { name: string; email: string };
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="topbar">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-white">Quantum</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/55">
              Tax Automation
            </span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-0.5">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="navlink" data-active={isActive(l.href)} title={l.hint}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-white/70">{user.name}</span>
          <form action={onSignOut}>
            <button
              className="rounded-lg border border-white/25 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/10"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
