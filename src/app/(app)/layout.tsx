import { requireSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Sidebar } from "@/components/Sidebar";
import { getSidebarStats } from "@/lib/sidebar-stats";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const stats = await getSidebarStats();

  return (
    <div className="shell">
      <Sidebar user={session} stats={stats} onSignOut={logout} />
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <main className="mx-auto w-full max-w-[1760px] flex-1 px-5 py-6 sm:px-8 sm:py-8">{children}</main>

        {/* Mobbin.com style dramatic footer with giant brand watermark */}
        <footer className="mobbin-footer relative overflow-hidden bg-[#111418] text-[#8C9BAE] pt-12 pb-16 px-6 sm:px-12 border-t border-white/10 mt-12">
          <div className="mx-auto max-w-[1760px] relative z-10 flex flex-wrap items-center justify-between gap-6 text-[12px]">
            <div className="flex items-center gap-6">
              <span className="font-semibold text-white/90">© Quantum 2018–2026.</span>
              <span className="hidden sm:inline text-white/40">Multi-State Tax Automation Engine</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-white/70">
              <a href="/guide" className="hover:text-white transition-colors">Documentation</a>
              <a href="/portals" className="hover:text-white transition-colors">Portals</a>
              <a href="/config" className="hover:text-white transition-colors">Excise Rates</a>
              <a href="/audit" className="hover:text-white transition-colors">Audit Trail</a>
              <span className="text-white/20">|</span>
              <span className="text-white/40 text-[11px]">Maximum Vapor Inc.</span>
            </div>
          </div>

          {/* Giant Mobbin-style watermarked brand typography */}
          <div className="pointer-events-none select-none relative -mb-10 mt-8 flex justify-center overflow-hidden">
            <span className="mobbin-watermark font-black tracking-tighter uppercase">
              Quantum
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
