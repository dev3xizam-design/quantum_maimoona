import { NextResponse } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename, kind } = await req.json();
  const [row] = await db
    .insert(uploads)
    .values({
      filename: String(filename ?? "upload"),
      kind: String(kind ?? "avalara"),
      uploadedBy: session.email,
      status: "pending",
    })
    .returning({ id: uploads.id });

  return NextResponse.json({ uploadId: row.id });
}
