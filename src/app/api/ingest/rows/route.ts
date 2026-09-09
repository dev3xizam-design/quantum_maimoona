import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { insertTransactions } from "@/lib/ingest/persist";
import type { NormalizedRow } from "@/lib/ingest/avalara";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId, rows } = (await req.json()) as { uploadId: number; rows: NormalizedRow[] };
  if (!uploadId || !Array.isArray(rows)) {
    return NextResponse.json({ error: "uploadId and rows are required" }, { status: 400 });
  }

  try {
    const inserted = await insertTransactions(uploadId, rows);
    return NextResponse.json({ received: rows.length, inserted, duplicates: rows.length - inserted });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
