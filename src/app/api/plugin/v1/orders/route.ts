import { NextResponse } from "next/server";
import { normalizeOrders } from "@/lib/connectors/normalize";
import { pushBatchSchema, pushToNormalized } from "@/lib/connectors/push";
import { connectionForPushKey, recordPush, writeShipments } from "@/lib/connectors/store";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Connect API: a store pushes its orders here.
 *
 *   POST /api/plugin/v1/orders
 *   Authorization: Bearer qk_live_...
 *   { "orders": [ { id, number, created_at, status, email, ship_to: {...}, lines: [...] } ] }
 *
 * Idempotent - re-sending an order updates it; sending it with status
 * "cancelled" removes it from the PACT feed. Max 250 orders per request.
 */
export async function POST(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const conn = await connectionForPushKey(key);
  if (!conn) return NextResponse.json({ error: "Unknown or revoked connection key." }, { status: 401 });

  let parsed;
  try {
    parsed = pushBatchSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order batch.", issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 422 },
    );
  }

  const result = normalizeOrders(parsed.data.orders.map(pushToNormalized), conn.provider, conn.slug);
  const stats = await writeShipments(conn, result);
  await recordPush(conn.id, stats);

  return NextResponse.json({
    ok: true,
    store: conn.name,
    received: stats.ordersRead,
    shipment_lines: stats.shipmentRows,
    skipped: {
      cancelled: stats.skippedCancelled,
      non_us: stats.skippedNonUs,
      no_address: stats.skippedNoAddress,
    },
    removed_cancelled_lines: stats.removedCancelled,
  });
}
