import { requireSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Sidebar } from "@/components/Sidebar";
import { MobbinFooter } from "@/components/MobbinFooter";
import { getSidebarStats } from "@/lib/sidebar-stats";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const stats = await getSidebarStats();

  return (
    <div className="shell">
      <Sidebar user={session} stats={stats} onSignOut={logout} />
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <main className="mx-auto w-full max-w-[1760px] flex-1 px-5 py-6 sm:px-8 sm:py-8">{children}</main>
        <MobbinFooter />
      </div>
    </div>
  );
}
