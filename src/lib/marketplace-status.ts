import "server-only";
import { oauthReady } from "@/lib/connectors/oauth";
import type { MarketplaceItem } from "@/lib/marketplace";

/** Badge for a marketplace item - depends on which OAuth apps this Quantum has keys for. */
export function statusOf(m: MarketplaceItem): { label: string; tone: string } {
  if (m.status === "coming-soon") return { label: "coming soon", tone: "badge-no_activity" };
  if (m.download) return { label: "download", tone: "badge-filed" };
  if (m.oauthProvider) {
    return oauthReady(m.oauthProvider)
      ? { label: "one-click install", tone: "badge-filed" }
      : { label: "connect with a key", tone: "badge-ready" };
  }
  return { label: "available", tone: "badge-filed" };
}
