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

/** Product master, purchase import and PACT shipment feed - small files. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind, filename, rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows found in the file." }, { status: 400 });
  }

  const [upload] = await db
    .insert(uploads)
    .values({
      filename: String(filename ?? "upload"),
      kind: String(kind),
      uploadedBy: session.email,
      status: "pending",
      rowCount: rows.length,
    })
    .returning({ id: uploads.id });

  try {
    let count = 0;
    if (kind === "products") count = await upsertProducts(rows as ProductInput[]);
    else if (kind === "purchases") count = await insertPurchases(upload.id, rows as PurchaseInput[]);
    else if (kind === "shipments") count = await insertShipments(upload.id, rows as ShipmentInput[]);
    else return NextResponse.json({ error: `Unknown upload kind "${kind}".` }, { status: 400 });

    await db.update(uploads).set({ status: "complete", rowCount: count }).where(eq(uploads.id, upload.id));
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    await db.update(uploads).set({ status: "failed" }).where(eq(uploads.id, upload.id));
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
