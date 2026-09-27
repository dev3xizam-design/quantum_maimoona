import { NextResponse } from "next/server";
import { connectionForPushKey } from "@/lib/connectors/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets a plugin show "Connected to Quantum as <store>" and detect a revoked key. */
export async function GET(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const conn = await connectionForPushKey(key);
  if (!conn) return NextResponse.json({ ok: false, error: "Unknown or revoked connection key." }, { status: 401 });
  return NextResponse.json({
    ok: true,
    store: conn.name,
    last_push_at: conn.lastPushAt?.toISOString() ?? null,
    api_version: 1,
  });
}
