"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/config", label: "Sales & PACT" },
  { href: "/config/excise", label: "Excise" },
  { href: "/config/jurisdictions", label: "Jurisdiction codes" },
  { href: "/config/accounts", label: "Accounts" },
  { href: "/config/nexus", label: "Nexus thresholds" },
  { href: "/config/stores", label: "Stores & Medusa" },
];

export function ConfigTabs() {
  const pathname = usePathname();
  return (
    <div className="pagehead">
      <div className="pagehead-row">
        <div>
          <h1 className="page-title">Configuration</h1>
          <p className="page-sub mt-0.5">
            Every rate, code and frequency the engine uses lives here. Give an edit an effective date
            and it applies going forward only — past returns keep the rate that applied then.
          </p>
        </div>
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="tab" data-active={pathname === t.href}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
