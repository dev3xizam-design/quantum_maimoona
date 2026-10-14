import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { platform } from "@/lib/connectors/catalog";
import { marketplaceItem } from "@/lib/marketplace";
import { statusOf } from "@/lib/marketplace-status";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: marketplaceItem((await params).slug)?.name ?? "Marketplace" };
}

const EXAMPLE = (origin: string) => `curl -X POST ${origin}/api/plugin/v1/orders \\
  -H "Authorization: Bearer qk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
  "orders": [{
    "id": "10045",
    "number": "#10045",
    "created_at": "2026-09-14T15:02:00Z",
    "status": "completed",
    "email": "buyer@example.com",
    "ship_to": {
      "first_name": "Ana", "last_name": "Diaz",
      "address1": "12 Main St", "city": "Wichita",
      "state": "KS", "zip": "67202", "country": "US"
    },
    "lines": [
      { "id": "1", "name": "Naked 100 Lava Flow 60mL", "sku": "NK-LF-60", "brand": "Naked 100", "quantity": 2 }
    ]
  }]
}'`;

export default async function MarketplaceItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const m = marketplaceItem((await params).slug);
  if (!m) notFound();
  const p = platform(m.platformId);
  const s = statusOf(m);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <div className="space-y-5">
      <Link href="/marketplace" className="text-[12px] font-semibold text-[var(--accent)]">
        ← Marketplace
      </Link>

      <section className="panel p-6">
        <div className="flex flex-wrap items-start gap-4">
          <BrandLogo brand={m.platformId} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="page-title">{m.name}</h1>
            <p className="mt-1 text-[13px] text-[var(--ink-2)]">{m.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`badge ${s.tone}`}>{s.label}</span>
              <span className="badge badge-ready">{m.platform}</span>
              {m.version && <span className="badge badge-ready">{m.version}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {m.download && m.status === "available" && (
              <a className="btn btn-primary" href={`/api/marketplace/download/${m.slug}`}>
                Download plugin (.zip)
              </a>
            )}
            {m.status === "available" && !m.download && (
              <Link className="btn btn-primary" href={`/config/stores`}>
                {m.kind === "api" ? "Create a connection key" : `Connect ${m.platform}`}
              </Link>
            )}
          </div>
        </div>
      </section>

      {m.features.length > 0 && (
        <section className="panel p-5">
          <h2 className="mb-2 text-[14px] font-semibold">What it does</h2>
          <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-[var(--ink-2)]">
            {m.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {m.install.length > 0 && (
        <section className="panel p-5">
          <h2 className="mb-2 text-[14px] font-semibold">Install</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-[12.5px] text-[var(--ink-2)]">
            {m.install.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </section>
      )}

      {m.kind === "api" && (
        <section className="panel p-5">
          <h2 className="mb-2 text-[14px] font-semibold">Send orders</h2>
          <pre className="overflow-x-auto rounded-lg bg-[var(--nav-900)] p-4 text-[11.5px] leading-relaxed text-white">
            {EXAMPLE(origin)}
          </pre>
          <div className="help mt-3">
            <strong>Rules.</strong> <code>id</code> is your order id and must be stable — re-sending the
            same id updates the order. A <code>status</code> of cancelled, refunded, failed, pending or
            voided (or <code>&quot;cancelled&quot;: true</code>) removes the order from PACT. Orders with
            no US ship-to are counted and skipped. <code>GET /api/plugin/v1/ping</code> with the same key
            checks the connection.
          </div>
        </section>
      )}

      {m.sends && (
        <section className="panel p-5">
          <h2 className="mb-2 text-[14px] font-semibold">Data it shares with Quantum</h2>
          <p className="text-[12.5px] text-[var(--ink-2)]">{m.sends}</p>
        </section>
      )}

      {m.listing && (
        <div className="callout callout-note">
          <strong>{m.listing.store}:</strong> {m.listing.status === "live" ? "live" : m.listing.status === "submitted" ? "submitted, in review" : "listing planned"}.
          {m.status === "available" && " It works from this Quantum today; the public listing is for stores that find it there."}
        </div>
      )}
    </div>
  );
}
