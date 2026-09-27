import { z } from "zod";
import type { NormalizedOrder } from "./types";

/**
 * The public Connect API order format - what the Quantum plugins (and anyone
 * integrating a platform we have no connector for) POST to /api/plugin/v1/orders.
 * snake_case on the wire because that is what PHP and most webhooks produce.
 * Versioned in the URL: never change a field's meaning, only add.
 */

const str = z.union([z.string(), z.number()]).transform(String);
const optStr = z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v == null ? null : String(v)));

export const pushOrderSchema = z.object({
  id: str,
  number: optStr,
  created_at: z.string().min(10),
  /** Either flag works; any of these statuses means nothing shipped. */
  cancelled: z.boolean().optional(),
  status: optStr,
  email: optStr,
  ship_to: z
    .object({
      first_name: optStr,
      last_name: optStr,
      name: optStr,
      company: optStr,
      address1: optStr,
      address2: optStr,
      city: optStr,
      state: optStr,
      zip: optStr,
      country: optStr,
    })
    .nullable()
    .optional(),
  lines: z
    .array(
      z.object({
        id: str,
        name: optStr,
        sku: optStr,
        brand: optStr,
        quantity: z.union([z.number(), z.string()]).transform(Number),
      }),
    )
    .default([]),
});

export const pushBatchSchema = z.object({
  platform: z.string().max(40).optional(),
  orders: z.array(pushOrderSchema).max(250),
});

export type PushOrder = z.infer<typeof pushOrderSchema>;

const NOT_SHIPPED = new Set(["cancelled", "canceled", "refunded", "failed", "voided", "pending", "trash", "checkout-draft"]);

export function pushToNormalized(o: PushOrder): NormalizedOrder {
  return {
    id: o.id,
    number: o.number,
    createdAt: o.created_at,
    cancelled: Boolean(o.cancelled) || NOT_SHIPPED.has((o.status ?? "").toLowerCase()),
    email: o.email,
    shipTo: o.ship_to
      ? {
          firstName: o.ship_to.first_name,
          lastName: o.ship_to.last_name,
          name: o.ship_to.name,
          company: o.ship_to.company,
          address1: o.ship_to.address1,
          address2: o.ship_to.address2,
          city: o.ship_to.city,
          state: o.ship_to.state,
          zip: o.ship_to.zip,
          country: o.ship_to.country,
        }
      : null,
    lines: o.lines.map((l) => ({ id: l.id, name: l.name, sku: l.sku, brand: l.brand, quantity: l.quantity })),
  };
}
