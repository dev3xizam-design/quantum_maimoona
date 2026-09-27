import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { syncAllStores } from "@/lib/connectors/store";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Daily pull of every connected store (vercel.json crons). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set, this refuses
 * rather than letting anyone on the internet trigger a sync.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { results, failures } = await syncAllStores();
  return NextResponse.json({
    ok: failures.length === 0,
    stores: results.map((r) => ({ store: r.store, orders: r.ordersRead, lines: r.shipmentRows })),
    failures,
  });
}
