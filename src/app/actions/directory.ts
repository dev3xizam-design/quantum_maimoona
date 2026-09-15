"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jurisdictionDirectory } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { isPromotable } from "@/lib/jurisdictions/directory";
import { planPromotion, type Candidate } from "@/lib/jurisdictions/promote";
import {
  currentCodes,
  insertCodes,
  promoteStates,
  removeDirectoryCreatedCodes,
  toCode,
  type NewCode,
  type Summary,
} from "@/lib/jurisdictions/promote-db";

function back(returnTo: string, params: Record<string, string | number>) {
  const url = new URL(returnTo.startsWith("/config/directory") ? returnTo : "/config/directory", "http://x");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  revalidatePath("/config/jurisdictions");
  revalidatePath("/config/directory");
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

/** One row, picked by hand: its published rate comes with it. */
export async function promoteDirectoryRow(formData: FormData) {
  const session = await requireSession();
  const returnTo = String(formData.get("returnTo") ?? "/config/directory");
  const id = Number(formData.get("id"));
  const [row] = await db.select().from(jurisdictionDirectory).where(eq(jurisdictionDirectory.id, id)).limit(1);
  if (!row || !isPromotable(row)) {
    return back(returnTo, { msg: "Only sales/use tax rows with a published code can be added." });
  }

  const value = toCode(row, true);
  const plan = planPromotion([value as NewCode & Candidate], await currentCodes(row.state));
  if (!plan.add.length) {
    return back(returnTo, {
      msg: `${row.state} already has a ${value.jurisdictionType} filing code named "${row.jurisdictionName}" or numbered ${row.officialCode}. Adding a second would replace it in the engine - edit the existing row in Jurisdiction codes instead.`,
    });
  }
  await insertCodes(session.email, [value]);
  return back(returnTo, { msg: `Added ${row.state} ${row.jurisdictionName} (${row.officialCode}) to the filing codes.` });
}

function describe(scope: string, s: Summary, includeRates: boolean) {
  return (
    `${scope}: added ${s.added.toLocaleString()} filing code(s)${includeRates ? " with published rates" : " (codes only, no rates)"}; ` +
    `${s.already.toLocaleString()} already present` +
    (s.noCode ? `, ${s.noCode.toLocaleString()} have no published code. ` : ". ") +
    (s.ambiguous.length
      ? `${s.ambiguous.length.toLocaleString()} name(s) appear more than once and were skipped - add the right one by hand: ${s.ambiguous.slice(0, 12).join(", ")}${s.ambiguous.length > 12 ? "..." : ""}`
      : "")
  );
}

export async function promoteStateTaxCodes(formData: FormData) {
  const session = await requireSession();
  const returnTo = String(formData.get("returnTo") ?? "/config/directory");
  const state = String(formData.get("state") ?? "").toUpperCase();
  const includeRates = formData.get("includeRates") === "on";
  if (!/^[A-Z]{2}$/.test(state)) return back(returnTo, { msg: "Pick a state first." });
  const summary = await promoteStates(session.email, [state], includeRates);
  return back(returnTo, { msg: describe(state, summary, includeRates) });
}

/** Every state at once. Safe to press twice: a second run finds everything already present. */
export async function promoteAllTaxCodes(formData: FormData) {
  const session = await requireSession();
  const returnTo = String(formData.get("returnTo") ?? "/config/directory");
  const includeRates = formData.get("includeRates") === "on";
  const summary = await promoteStates(session.email, null, includeRates);
  return back(returnTo, { msg: describe("All states", summary, includeRates) });
}

/**
 * Undo for the bulk add: removes every filing code the directory created
 * (their notes start "From directory ("), leaving hand-entered and seeded
 * codes alone. Each removal is written to the change log.
 */
export async function removeDirectoryCodes(formData: FormData) {
  const session = await requireSession();
  const returnTo = String(formData.get("returnTo") ?? "/config/directory");
  const removed = await removeDirectoryCreatedCodes(session.email);
  return back(returnTo, {
    msg: `Removed ${removed.toLocaleString()} filing code(s) the directory had added. Hand-entered codes were not touched.`,
  });
}
