import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { approvePairing } from "@/app/actions/connectors";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect a store" };

/**
 * Where a Quantum plugin's "Connect to Quantum" button lands. Outside the (app)
 * group on purpose: a signed-out user is sent to login and brought straight back
 * here, instead of losing the request on the dashboard.
 */
export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/connect/pair?${qs}`)}`);

  let site: URL | null = null;
  let back: URL | null = null;
  try {
    site = new URL(sp.site ?? "");
    back = new URL(sp.return ?? "");
  } catch {
    /* handled below */
  }
  const valid = Boolean(site && back && site.host === back.host && /^https?:$/.test(site.protocol) && sp.state);
  const platformName = sp.platform === "woocommerce" ? "WooCommerce" : sp.platform ?? "your store";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo size={40} />
          <span className="text-[13px] font-semibold text-[var(--muted)]">⇄</span>
          <span className="tile-icon font-bold text-white" style={{ background: "#7f54b3", width: 40, height: 40 }}>
            {platformName.slice(0, 1).toUpperCase()}
          </span>
        </div>

        {!valid ? (
          <div className="panel p-5">
            <h1 className="text-[15px] font-semibold">This connect link is incomplete</h1>
            <p className="mt-2 text-[12.5px] text-[var(--muted)]">
              Start again from the plugin&rsquo;s settings page and press <strong>Connect to Quantum</strong>.
            </p>
          </div>
        ) : (
          <form action={approvePairing} className="panel space-y-4 p-5">
            <div>
              <h1 className="text-[15px] font-semibold">Connect {site!.host} to Quantum?</h1>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                Signed in as {session!.email}. The {platformName} plugin on <strong>{site!.host}</strong> will
                be able to <strong>send its orders</strong> to Quantum&rsquo;s PACT feed. It cannot read
                anything back — not returns, not other stores, not settings.
              </p>
            </div>
            <input type="hidden" name="site" value={`${site!.protocol}//${site!.host}`} />
            <input type="hidden" name="return" value={back!.toString()} />
            <input type="hidden" name="state" value={sp.state} />
            <input type="hidden" name="platform" value={sp.platform ?? "woocommerce"} />
            <div>
              <label className="field">Name in Quantum</label>
              <input name="name" type="text" defaultValue={sp.name ?? site!.host} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" type="submit">
                Connect
              </button>
              <a className="btn" href={back!.toString()}>
                Cancel
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
