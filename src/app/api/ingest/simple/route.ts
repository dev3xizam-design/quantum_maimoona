import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  insertPurchases,
  insertShipments,
  upsertProducts,
  type ProductInput,
  type PurchaseInput,
  type ShipmentInput,
} from "@/lib/ingest/persist";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Product master, purchase import and PACT shipment feed.
 * The client sends the file in batches, so a large master neither exceeds the
 * request body limit nor runs past the function time limit.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind, filename, rows, uploadId, done, total } = await req.json();

  // Final call: mark the upload complete.
  if (done && uploadId) {
    await db
      .update(uploads)
      .set({ status: "complete", rowCount: Number(total ?? 0) })
      .where(eq(uploads.id, Number(uploadId)));
    return NextResponse.json({ ok: true, uploadId: Number(uploadId) });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows found in that file." }, { status: 400 });
  }
  if (!["products", "purchases", "shipments", "shopify_orders"].includes(String(kind))) {
    return NextResponse.json({ error: `Unknown upload kind "${kind}".` }, { status: 400 });
  }

  let id = Number(uploadId ?? 0);
  if (!id) {
    const [created] = await db
      .insert(uploads)
      .values({
        filename: String(filename ?? "upload"),
        kind: String(kind),
        uploadedBy: session.email,
        status: "pending",
      })
      .returning({ id: uploads.id });
    id = created.id;
  }

  try {
    let count = 0;
    if (kind === "products") count = await upsertProducts(rows as ProductInput[]);
    else if (kind === "purchases") count = await insertPurchases(id, rows as PurchaseInput[]);
    else count = await insertShipments(id, rows as ShipmentInput[]);

    return NextResponse.json({ ok: true, uploadId: id, count });
  } catch (e) {
    await db.update(uploads).set({ status: "failed" }).where(eq(uploads.id, id));
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
