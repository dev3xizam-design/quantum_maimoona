import { NextResponse } from "next/server";
import { commitOrder, commitSchema } from "@/lib/tax/commit";
import { errorResponse, readJson, storeFor, unauthorized } from "@/lib/tax/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tax/v1/commit - the order SHIPPED: record it for filing.
 * Idempotent on order_id; re-committing replaces the document unless its
 * month is already filed.
 */
export async function POST(req: Request) {
  const conn = await storeFor(req);
  if (!conn) return unauthorized();
  const body = await readJson(req, commitSchema);
  if ("response" in body) return body.response;
  try {
    return NextResponse.json(await commitOrder(conn, body.data));
  } catch (e) {
    return errorResponse(e);
  }
}
