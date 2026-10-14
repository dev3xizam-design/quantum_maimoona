import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pullAllStores } from "@/lib/tax/order-pull";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Every-5-minutes pull of each connected store's changed orders into the
 * monthly tax data (see lib/tax/order-pull). Called by the scheduler with
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set it refuses.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { results, recomputed } = await pullAllStores();
  const failed = results.some((r) => "error" in r || ("errors" in r && r.errors.length));
  return NextResponse.json({ ok: !failed, results, recomputed });
}
