import { NextResponse } from "next/server";
import { calculate } from "@/lib/tax/calculate";
import { calculateSchema, errorResponse, quoteToWire, readJson, storeFor, unauthorized } from "@/lib/tax/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tax/v1/calculate - price a cart. Nothing is stored.
 *
 *   Authorization: Bearer qk_live_...
 *   { address: {line1, city, state, zip, country}, lines: [{id, variant_id, sku, title,
 *     variant_title, product_type, description, quantity, unit_price, discount}],
 *     shipping: [{id, amount}] }
 */
export async function POST(req: Request) {
  const conn = await storeFor(req);
  if (!conn) return unauthorized();
  const body = await readJson(req, calculateSchema);
  if ("response" in body) return body.response;
  const { address, lines, shipping, date } = body.data;
  try {
    const quote = await calculate(
      conn.slug,
      {
        address,
        lines: lines.map((l) => ({
          id: l.id,
          variantId: l.variant_id,
          productId: l.product_id,
          sku: l.sku,
          barcode: l.barcode,
          title: l.title,
          variantTitle: l.variant_title,
          productType: l.product_type,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unit_price,
          discount: l.discount,
        })),
        shipping,
      },
      date,
    );
    return NextResponse.json(quoteToWire(quote));
  } catch (e) {
    return errorResponse(e);
  }
}
