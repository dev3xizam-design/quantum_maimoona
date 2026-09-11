import { redirect } from "next/navigation";
import { countUsers, getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  let firstRun = false;
  let dbError: string | null = null;
  try {
    firstRun = (await countUsers()) === 0;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, #dcf5e5 0%, transparent 60%), var(--bg)",
      }}
    >
      <div className="w-full max-w-[380px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size={54} />
          <div className="mt-3 text-[20px] font-semibold tracking-tight">Quantum</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Tax Automation
          </div>
          <div className="mt-1 text-[12px] text-[var(--muted)]">Maximum Vapor Inc.</div>
        </div>

        {dbError ? (
          <div className="callout callout-warn">
            <strong>Database not reachable.</strong>
            <div className="mt-1 font-mono text-[11px] break-all">{dbError}</div>
            <div className="mt-2">
              Set <code>DATABASE_URL</code>, then run <code>npm run db:push</code> and{" "}
              <code>npm run db:seed</code>.
            </div>
          </div>
        ) : (
          <LoginForm firstRun={firstRun} />
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-[var(--muted)]">
          This system never stores state-portal passwords, PINs, card numbers or bank credentials.
          Keep those in a password manager.
        </p>
      </div>
    </div>
  );
}
