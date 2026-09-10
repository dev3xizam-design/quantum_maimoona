import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { refreshProductCatalog } from "@/lib/products/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  /**
   * Rebuild the product master from what was just ingested. Every sale line
   * carries the item code, name, quantity and amount, so the SKU list and the
   * real selling prices maintain themselves - the user never types them.
   */
  let catalog = null;
  try {
    catalog = await refreshProductCatalog();
  } catch (e) {
    console.error("Product catalog refresh failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, catalog });
}
