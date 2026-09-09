"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { filings, runLog } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { buildCalendar } from "@/lib/calendar";
import { computeAndPersist } from "@/lib/compute";

export async function computeOne(state: string, taxType: string, period: string) {
  await requireSession();
  try {
    await computeAndPersist(state, taxType, period);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate every return that has activity and is not already filed. */
export async function runPeriod(month: string) {
  const session = await requireSession();
  const cells = await buildCalendar(month);
  const targets = cells.filter((c) => c.hasActivity && c.status !== "filed");

  const [run] = await db
    .insert(runLog)
    .values({ period: month, actor: session.email, status: "running" })
    .returning({ id: runLog.id });

  const results: { state: string; taxType: string; period: string; ok: boolean; error?: string }[] = [];
  for (const c of targets) {
    try {
      await computeAndPersist(c.state, c.taxType, c.period);
      results.push({ state: c.state, taxType: c.taxType, period: c.period, ok: true });
    } catch (e) {
      results.push({
        state: c.state,
        taxType: c.taxType,
        period: c.period,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await db
    .update(runLog)
    .set({
      status: "complete",
      finishedAt: new Date(),
      summary: {
        attempted: results.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok),
      },
    })
    .where(eq(runLog.id, run.id));

  revalidatePath("/", "layout");
  return {
    ok: true,
    attempted: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  };
}

export async function markFiled(formData: FormData) {
  const session = await requireSession();
  const state = String(formData.get("state"));
  const taxType = String(formData.get("taxType"));
  const period = String(formData.get("period"));
  const confirmationNumber = String(formData.get("confirmationNumber") ?? "").trim() || null;
  const amountPaidRaw = String(formData.get("amountPaid") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await db
    .update(filings)
    .set({
      status: "filed",
      filedAt: new Date(),
      filedBy: session.email,
      confirmationNumber,
      amountPaid: amountPaidRaw ? amountPaidRaw : null,
      notes,
      updatedAt: new Date(),
    })
    .where(and(eq(filings.state, state), eq(filings.taxType, taxType), eq(filings.period, period)));

  revalidatePath("/", "layout");
}

export async function unmarkFiled(formData: FormData) {
  await requireSession();
  const state = String(formData.get("state"));
  const taxType = String(formData.get("taxType"));
  const period = String(formData.get("period"));

  await db
    .update(filings)
    .set({
      status: "ready",
      filedAt: null,
      filedBy: null,
      confirmationNumber: null,
      updatedAt: new Date(),
    })
    .where(and(eq(filings.state, state), eq(filings.taxType, taxType), eq(filings.period, period)));

  revalidatePath("/", "layout");
}
