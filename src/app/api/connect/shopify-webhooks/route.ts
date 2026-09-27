import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { verifyShopifyWebhook } from "@/lib/connectors/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify's mandatory compliance webhooks (required for an App Store listing)
 * plus app/uninstalled. Point all four topics at this one URL.
 *
 * customers/redact is acknowledged but does NOT delete shipment rows: the PACT
 * Act requires the seller to keep these shipment records for five years, which
 * is a legal retention obligation Shopify's policy allows for. shop/redact and
 * app/uninstalled stop the connection; its historic filings stay intact.
 */
export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const raw = await req.text();
  if (!secret || !verifyShopifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shop = req.headers.get("x-shopify-shop-domain") ?? "";

  if (topic === "app/uninstalled" || topic === "shop/redact") {
    await db
      .update(integrations)
      .set({
        active: false,
        status: "error",
        lastError: topic === "shop/redact" ? "Shop data redaction requested by Shopify." : "The Quantum app was uninstalled from this store.",
        secretCipher: null,
        updatedAt: new Date(),
      })
      .where(and(eq(integrations.provider, "shopify"), eq(integrations.baseUrl, `https://${shop}`)));
  }

  return NextResponse.json({ ok: true });
}
