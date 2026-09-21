import { requireSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="shell">
      <Sidebar user={session} onSignOut={logout} />
      <div className="flex min-h-screen flex-col">
        <main className="mx-auto w-full max-w-[1760px] flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        <footer className="border-t border-[var(--line)] bg-white">
          <div className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-[11px] text-[var(--muted)] sm:px-6">
            <span>
              Quantum prepares returns; a person files them. Every figure is a formula or a lookup,
              never an estimate.
            </span>
            <span className="ml-auto">Never store portal passwords, PINs or card numbers here.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
