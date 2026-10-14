"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { calculate, setTaxSetting } from "@/lib/tax/calculate";
import { quoteToWire } from "@/lib/tax/api";

export async function saveCostRatio(fd: FormData) {
  const session = await requireSession();
  const raw = String(fd.get("ratio") ?? "").trim();
  const pct = raw === "" ? null : Number(raw);
  if (pct !== null && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) return;
  await setTaxSetting("cost_estimate_ratio", pct === null ? null : pct / 100, session.email);
  revalidatePath("/config/realtime-tax");
}

export type TestQuoteState = { ok: boolean; message?: string; quote?: ReturnType<typeof quoteToWire> } | null;

/** Price one made-up line at an address, exactly as checkout would. */
export async function testQuote(_prev: TestQuoteState, fd: FormData): Promise<TestQuoteState> {
  await requireSession();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const storeId = Number(get("store"));
  const [store] = storeId ? await db.select().from(integrations).where(eq(integrations.id, storeId)).limit(1) : [];
  try {
    const quote = await calculate(store?.slug ?? "test", {
      address: { line1: get("line1"), city: get("city"), state: get("state"), zip: get("zip"), country: "US" },
      lines: [
        {
          id: "line-1",
          sku: get("sku") || null,
          title: get("title") || "Test product",
          variantTitle: get("variant") || null,
          description: get("description") || null,
          quantity: Number(get("quantity") || 1),
          unitPrice: Number(get("price") || 0),
        },
      ],
      shipping: get("shipping") ? [{ id: "shipping", amount: Number(get("shipping")) }] : [],
    });
    return { ok: true, quote: quoteToWire(quote) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
