import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { platform } from "@/lib/connectors/catalog";
import { statusOf } from "@/lib/marketplace-status";
import { MARKETPLACE, type MarketplaceItem } from "@/lib/marketplace";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketplace" };

const KIND: Record<MarketplaceItem["kind"], string> = {
  plugin: "Plugin",
  app: "App",
  api: "API",
  connector: "Built-in",
};

export default function MarketplacePage() {
  const available = MARKETPLACE.filter((m) => m.status === "available");
  const soon = MARKETPLACE.filter((m) => m.status !== "available");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketplace"
        description="Plugins and apps that put a store's orders into Quantum. Install one on the store, press Connect, and its orders flow into the PACT feed from then on."
        actions={
          <Link className="btn btn-primary" href="/config/stores">
            Connect a store
          </Link>
        }
      />

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {available.map((m) => (
          <Card key={m.slug} m={m} />
        ))}
      </div>

      {soon.length > 0 && (
        <>
          <h2 className="pt-2 text-[13px] font-semibold text-[var(--muted)] uppercase tracking-[0.08em]">Coming soon</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {soon.map((m) => (
              <Card key={m.slug} m={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ m }: { m: MarketplaceItem }) {
  const s = statusOf(m);
  return (
    <Link href={`/marketplace/${m.slug}`} className="tile" style={m.status !== "available" ? { opacity: 0.72 } : undefined}>
      <div className="flex items-start gap-3">
        <BrandLogo brand={m.platformId} size={42} />
        <div className="min-w-0">
          <div className="tile-title leading-snug">{m.name}</div>
          <div className="tile-sub">
            {m.platform} · {KIND[m.kind]}
            {m.version && ` · ${m.version}`}
          </div>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">{m.summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <span className={`badge ${s.tone}`}>{s.label}</span>
        {m.listing && (
          <span className="badge badge-not_started">
            {m.listing.store}: {m.listing.status}
          </span>
        )}
      </div>
    </Link>
  );
}
