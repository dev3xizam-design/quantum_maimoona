import { NextResponse } from "next/server";
import { storeFor, unauthorized } from "@/lib/tax/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tax/v1/ping - lets a store confirm its key before checkout depends on it. */
export async function GET(req: Request) {
  const conn = await storeFor(req);
  if (!conn) return unauthorized();
  return NextResponse.json({ ok: true, store: conn.name, api_version: 1 });
}
