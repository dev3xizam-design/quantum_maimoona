import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId, rowCount, stats, status } = await req.json();
  await db
    .update(uploads)
    .set({
      rowCount: Number(rowCount ?? 0),
      stats: stats ?? null,
      status: status ?? "complete",
    })
    .where(eq(uploads.id, Number(uploadId)));

  return NextResponse.json({ ok: true });
}
