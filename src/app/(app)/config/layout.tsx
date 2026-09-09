import Link from "next/link";

const TABS = [
  { href: "/config", label: "Sales & PACT" },
  { href: "/config/excise", label: "Excise" },
  { href: "/config/jurisdictions", label: "Jurisdiction codes" },
  { href: "/config/accounts", label: "Accounts" },
  { href: "/config/nexus", label: "Nexus thresholds" },
];

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Configuration</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Every rate, code and frequency the engine uses lives here. Give an edit an effective date
          and it applies going forward only - past returns keep the rate that applied then.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-[var(--line)] pb-2">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="callout callout-note">
        Never record portal passwords, PINs, card numbers or bank logins here. Account and license
        numbers are fine - returns need them. Credentials belong in a password manager.
      </div>

      {children}
    </div>
  );
}
