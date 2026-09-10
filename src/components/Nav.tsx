import Link from "next/link";
import { logout } from "@/app/actions/auth";

const LINKS = [
  { href: "/", label: "Calendar" },
  { href: "/returns", label: "Returns" },
  { href: "/products", label: "Products" },
  { href: "/upload", label: "Upload" },
  { href: "/config", label: "Config" },
  { href: "/audit", label: "Audit" },
];

export function Nav({ user }: { user: { name: string; email: string } }) {
  return (
    <header className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[13px] font-bold text-white">
            MV
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Tax Automation</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[12px] text-[var(--muted)]">{user.name}</span>
          <form action={logout}>
            <button className="btn btn-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
