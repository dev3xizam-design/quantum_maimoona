"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { computeAndStoreMonth, setMonthStatus } from "@/lib/months";

/** Compute every state for a month, store each return, and store the month. */
export async function computeMonth(month: string) {
  const session = await requireSession();
  try {
    const { totals } = await computeAndStoreMonth(month, session.email);
    revalidatePath("/", "layout");
    return { ok: true as const, totals };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function closeMonth(formData: FormData) {
  const session = await requireSession();
  const month = String(formData.get("month"));
  await setMonthStatus(month, "closed", session.email);
  revalidatePath("/", "layout");
}

export async function reopenMonth(formData: FormData) {
  const session = await requireSession();
  const month = String(formData.get("month"));
  await setMonthStatus(month, "open", session.email);
  revalidatePath("/", "layout");
}
