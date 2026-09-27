import { NextResponse } from "next/server";
import { verifyState } from "@/lib/connectors/oauth";
import { saveProviderConnection } from "@/lib/connectors/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WooCommerce's /wc-auth/v1/authorize POSTs the new read-only keys here,
 * server-to-server, before sending the browser back. There is no session on
 * this request - the signed state echoed back as `user_id` is what proves a
 * Quantum user started it, and names the one site it may be saved for.
 *
 * The keys are saved untested: testing would call back into the same WordPress
 * that is waiting on this response, which deadlocks single-worker hosts. The
 * browser return (/api/connect/woocommerce/callback) tests them.
 */
export async function POST(req: Request) {
  let body: { user_id?: string; consumer_key?: string; consumer_secret?: string; key_permissions?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const state = await verifyState(String(body.user_id ?? ""));
  if (!state || state.provider !== "woocommerce" || !state.target) {
    return NextResponse.json({ error: "Unknown or expired connect request." }, { status: 403 });
  }
  if (!body.consumer_key?.startsWith("ck_") || !body.consumer_secret?.startsWith("cs_")) {
    return NextResponse.json({ error: "Missing keys." }, { status: 400 });
  }

  await saveProviderConnection({
    provider: "woocommerce",
    name: state.name,
    baseUrl: state.target,
    credentials: { consumerKey: body.consumer_key, consumerSecret: body.consumer_secret },
    config: { site: state.target, authMode: "basic", permissions: body.key_permissions ?? "read" },
    actor: state.actor,
    skipTest: true,
  });
  return NextResponse.json({ ok: true });
}
