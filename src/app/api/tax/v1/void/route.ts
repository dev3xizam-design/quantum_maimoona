import { NextResponse } from "next/server";
import { z } from "zod";
import { voidOrder } from "@/lib/tax/commit";
import { errorResponse, readJson, storeFor, unauthorized } from "@/lib/tax/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ order_id: z.string().min(1), reason: z.string().max(200).default("canceled") });

/** POST /api/tax/v1/void - the order was cancelled or fully refunded. */
export async function POST(req: Request) {
  const conn = await storeFor(req);
  if (!conn) return unauthorized();
  const body = await readJson(req, schema);
  if ("response" in body) return body.response;
  try {
    return NextResponse.json(await voidOrder(conn, body.data.order_id, body.data.reason));
  } catch (e) {
    return errorResponse(e);
  }
}
