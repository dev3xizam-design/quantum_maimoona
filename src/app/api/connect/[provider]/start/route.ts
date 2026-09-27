import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ConnectorError, normalizeSiteUrl } from "@/lib/connectors/http";
import { appUrl, oauthReady, signState, stateCookie } from "@/lib/connectors/oauth";
import { SCOPES, normalizeShopDomain } from "@/lib/connectors/providers/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The one button. Sends the browser to the platform's own approve screen with a
 * signed state; the platform sends it back to /api/connect/<provider>/callback.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { provider } = await params;
  const q = new URL(req.url).searchParams;
  const base = appUrl(req);
  const back = (msg: string) =>
    NextResponse.redirect(`${base}/config/stores?connect_error=${encodeURIComponent(msg)}&provider=${provider}`);

  if (!oauthReady(provider)) {
    return back(`One-button connect for ${provider} is not switched on yet — use the key form instead.`);
  }

  try {
    const name = q.get("name")?.trim() || undefined;

    if (provider === "shopify") {
      const shop = normalizeShopDomain(q.get("shop") ?? "");
      const state = await signState({ provider, target: shop, name, actor: session.email });
      const url = new URL(`https://${shop}/admin/oauth/authorize`);
      url.searchParams.set("client_id", process.env.SHOPIFY_CLIENT_ID!);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("redirect_uri", `${base}/api/connect/shopify/callback`);
      url.searchParams.set("state", state);
      const res = NextResponse.redirect(url);
      res.cookies.set(stateCookie(state));
      return res;
    }

    if (provider === "woocommerce") {
      const site = normalizeSiteUrl(q.get("site") ?? "");
      if (!site.startsWith("https://")) {
        return back("WooCommerce only hands keys to a store served over https://.");
      }
      // Woo POSTs the keys server-to-server with this user_id echoed back - it is the only
      // thing tying that POST to this flow, so it is the signed state itself.
      const state = await signState({ provider, target: site, name, actor: session.email });
      const url = new URL(`${site}/wc-auth/v1/authorize`);
      url.searchParams.set("app_name", "Quantum Tax");
      url.searchParams.set("scope", "read");
      url.searchParams.set("user_id", state);
      url.searchParams.set("return_url", `${base}/api/connect/woocommerce/callback`);
      url.searchParams.set("callback_url", `${base}/api/connect/woo-keys`);
      const res = NextResponse.redirect(url);
      res.cookies.set(stateCookie(state));
      return res;
    }

    if (provider === "wix") {
      const state = await signState({ provider, name, actor: session.email });
      const url = new URL("https://www.wix.com/installer/install");
      url.searchParams.set("appId", process.env.WIX_APP_ID!);
      url.searchParams.set("redirectUrl", `${base}/api/connect/wix/callback`);
      const res = NextResponse.redirect(url);
      res.cookies.set(stateCookie(state));
      return res;
    }

    if (provider === "bigcommerce") {
      // BigCommerce installs start in its own control panel; this is the app's install page.
      const state = await signState({ provider, name, actor: session.email });
      const res = NextResponse.redirect(
        `https://login.bigcommerce.com/app/${process.env.BIGCOMMERCE_CLIENT_ID}/install`,
      );
      res.cookies.set(stateCookie(state));
      return res;
    }

    return back(`${provider} has no one-button flow.`);
  } catch (e) {
    return back(e instanceof ConnectorError || e instanceof Error ? e.message : String(e));
  }
}
