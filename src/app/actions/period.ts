"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { computePeriodEverything } from "@/lib/period";

/** Compute and store every return for a month, all states, all tax types. */
export async function runWholeMonth(month: string) {
  await requireSession();
  try {
    const comp = await computePeriodEverything(month, { persist: true });
    revalidatePath("/", "layout");
    return {
      ok: true as const,
      totals: comp.totals,
      states: comp.bundles
        .filter((b) => b.hasActivity)
        .map((b) => ({
          state: b.state,
          gross: b.sales?.gross ?? 0,
          taxable: b.sales?.taxable ?? 0,
          salesTax: b.sales?.taxComputed ?? 0,
          collected: b.sales?.taxCollected ?? 0,
          delta: b.sales?.delta ?? 0,
          excise: b.excise?.taxComputed ?? 0,
          pact: b.pact?.shipmentCount ?? 0,
          salesPeriod: b.salesPeriod,
          dueDate: b.sales?.dueDate ?? null,
          reconciles: b.sales?.reconciles ?? true,
          warnings:
            (b.sales?.warnings.length ?? 0) +
            (b.excise?.warnings.length ?? 0) +
            (b.pact?.warnings.length ?? 0),
        })),
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
