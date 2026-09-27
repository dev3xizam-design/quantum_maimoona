import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { json, request } from "@/lib/connectors/http";
import { STATE_COOKIE, appUrl, verifyShopifyQuery, verifyState } from "@/lib/connectors/oauth";
import { normalizeShopDomain } from "@/lib/connectors/providers/shopify";
import { retestConnection, saveProviderConnection, syncStoreOrders } from "@/lib/connectors/store";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Where each platform sends the browser back after the owner approves.
 * Success lands on the Stores page with the new store highlighted, and a first
 * order sync is kicked off so the store is useful the moment it is connected.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const q = new URL(req.url).searchParams;
  const base = appUrl(req);
  const jar = await cookies();
  const cookieState = await verifyState(jar.get(STATE_COOKIE)?.value);
  const session = await getSession();

  const done = (id: number, extra = "") => {
    const res = NextResponse.redirect(`${base}/config/stores?connected=${id}${extra}`);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/connect" });
    return res;
  };
  const fail = (msg: string) => {
    const res = NextResponse.redirect(
      `${base}/config/stores?connect_error=${encodeURIComponent(msg)}&provider=${provider}`,
    );
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/connect" });
    return res;
  };

  /** Initial sync is best-effort: a failure shows on the store card, not as a failed connect. */
  const firstSync = async (id: number) => {
    try {
      await syncStoreOrders(id, { full: true });
    } catch {
      /* recorded on the connection */
    }
  };

  try {
    /* ---------------- Shopify ---------------- */
    if (provider === "shopify") {
      const secret = process.env.SHOPIFY_CLIENT_SECRET;
      if (!secret || !process.env.SHOPIFY_CLIENT_ID) return fail("Shopify app keys are not set on this Quantum.");
      if (!verifyShopifyQuery(q, secret)) return fail("Shopify's signature on that redirect did not verify.");
      const state = await verifyState(q.get("state"));
      if (!session || !state || state.provider !== "shopify" || q.get("state") !== jar.get(STATE_COOKIE)?.value) {
        return fail("That Shopify approval did not come from a connect you started here. Start again from Stores.");
      }
      const shop = normalizeShopDomain(q.get("shop") ?? "");
      if (state.target && state.target !== shop) return fail("Shopify returned a different store than the one requested.");

      const res = await request("Shopify", `https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: secret,
          code: q.get("code"),
        }),
      });
      const token = await json<{ access_token: string; scope: string }>("Shopify", res, "finishing the install");
      const saved = await saveProviderConnection({
        provider,
        name: state.name,
        baseUrl: `https://${shop}`,
        credentials: { accessToken: token.access_token },
        config: { shop, authMode: "oauth", scope: token.scope },
        actor: session.email,
      });
      if (!saved.ok) return fail(saved.error ?? "Shopify connected but the first test failed.");
      await firstSync(saved.id);
      return done(saved.id);
    }

    /* ---------------- WooCommerce (keys already arrived at /api/connect/woo-keys) ---------------- */
    if (provider === "woocommerce") {
      if (q.get("success") !== "1") return fail("The WooCommerce store owner did not approve access.");
      const state = await verifyState(q.get("user_id"));
      if (!session || !state?.target) return fail("That WooCommerce approval has expired. Start again from Stores.");
      const [row] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(and(eq(integrations.provider, "woocommerce"), eq(integrations.baseUrl, state.target)))
        .limit(1);
      if (!row) {
        return fail(
          "WooCommerce approved access but its keys never reached Quantum. The store's server probably could not call back over HTTPS — use the key form or the Quantum Connect plugin instead.",
        );
      }
      const test = await retestConnection(row.id);
      if (!test.ok) return fail(test.error);
      await firstSync(row.id);
      return done(row.id);
    }

    /* ---------------- Wix ---------------- */
    if (provider === "wix") {
      const instanceId = q.get("instanceId") ?? q.get("instance_id");
      if (!instanceId) return fail("Wix did not return an app instance id.");
      if (!session || cookieState?.provider !== "wix") {
        return fail("That Wix install did not come from a connect you started here. Start again from Stores.");
      }
      const saved = await saveProviderConnection({
        provider,
        name: cookieState.name ?? `Wix site ${instanceId.slice(0, 8)}`,
        baseUrl: `wix://${instanceId}`,
        credentials: {},
        config: { instanceId, authMode: "oauth" },
        actor: session.email,
      });
      if (!saved.ok) return fail(saved.error ?? "Wix connected but the first test failed.");
      await firstSync(saved.id);
      return done(saved.id);
    }

    /* ---------------- BigCommerce ---------------- */
    if (provider === "bigcommerce") {
      // Loaded inside BigCommerce's control panel (a third-party iframe), so the Quantum
      // session cookie is usually absent. Without it, the store is saved INACTIVE and has
      // to be approved on the Stores page - an install alone never feeds a filing.
      const res = await request("BigCommerce", "https://login.bigcommerce.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.BIGCOMMERCE_CLIENT_ID,
          client_secret: process.env.BIGCOMMERCE_CLIENT_SECRET,
          code: q.get("code"),
          scope: q.get("scope"),
          grant_type: "authorization_code",
          redirect_uri: `${base}/api/connect/bigcommerce/callback`,
          context: q.get("context"),
        }),
      });
      const token = await json<{ access_token: string; context: string; user?: { email?: string } }>(
        "BigCommerce",
        res,
        "finishing the install",
      );
      const storeHash = token.context.replace(/^stores\//, "");
      const trusted = Boolean(session && cookieState?.provider === "bigcommerce");
      const saved = await saveProviderConnection({
        provider,
        name: cookieState?.name,
        baseUrl: `https://store-${storeHash}.mybigcommerce.com`,
        credentials: { accessToken: token.access_token },
        config: { storeHash, authMode: "oauth", installedBy: token.user?.email ?? null },
        actor: session?.email ?? token.user?.email ?? "bigcommerce-install",
        active: trusted ? undefined : false,
      });
      if (!trusted) {
        return new NextResponse(
          `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:32px;max-width:520px">
           <h2>Almost there</h2><p>BigCommerce is connected. Open <a target="_top" href="${base}/config/stores">Quantum → Stores</a>
           and press <b>Approve</b> on this store to start syncing orders.</p></body>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
      if (saved.ok) await firstSync(saved.id);
      return done(saved.id);
    }

    return fail(`Unknown platform "${provider}".`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
