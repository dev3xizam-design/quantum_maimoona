"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { changeLog, jurisdictionCodes, jurisdictionDirectory } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { PAIRED_ON_RETURN, engineRate, engineType, isPromotable } from "@/lib/jurisdictions/directory";
import { planPromotion, type Candidate } from "@/lib/jurisdictions/promote";
import { DEFAULT_EFFECTIVE_FROM } from "@/lib/seed-data";

type DirRow = typeof jurisdictionDirectory.$inferSelect;
type NewCode = typeof jurisdictionCodes.$inferInsert;

const today = () => new Date().toISOString().slice(0, 10);

function toCode(r: DirRow, includeRate: boolean): NewCode {
  const rate = includeRate ? engineRate(r) : null;
  const effectiveFrom =
    r.effectiveFrom && r.effectiveFrom > DEFAULT_EFFECTIVE_FROM ? r.effectiveFrom : DEFAULT_EFFECTIVE_FROM;
  const notes = [
    `From directory (${r.codeSystem})`,
    r.countyName && engineType(r.jurisdictionType) !== "county" ? `county: ${r.countyName}` : null,
    r.pairedCode && !PAIRED_ON_RETURN.has(r.state) ? `related code ${r.pairedCode} (${r.pairedName ?? ""})` : null,
    r.notes,
  ]
    .filter(Boolean)
    .join(" - ");
  return {
    state: r.state,
    jurisdictionName: r.jurisdictionName,
    jurisdictionType: engineType(r.jurisdictionType),
    officialCode: r.officialCode,
    pairedCode: PAIRED_ON_RETURN.has(r.state) ? r.pairedCode : null,
    pairedName: PAIRED_ON_RETURN.has(r.state) ? r.pairedName : null,
    rate,
    rateIncludesState: r.rateIncludesState,
    notes,
    effectiveFrom,
    updatedAt: new Date(),
  };
}

async function currentCodes(state: string) {
  return db
    .select()
    .from(jurisdictionCodes)
    .where(
      and(
        eq(jurisdictionCodes.state, state),
        or(isNull(jurisdictionCodes.effectiveTo), gte(jurisdictionCodes.effectiveTo, today())),
      ),
    );
}

async function insertCodes(actor: string, values: NewCode[]) {
  for (let i = 0; i < values.length; i += 500) {
    const chunk = values.slice(i, i + 500);
    const created = await db.insert(jurisdictionCodes).values(chunk).returning({ id: jurisdictionCodes.id });
    await db.insert(changeLog).values(
      created.map((c, j) => ({
        actor,
        tableName: "jurisdiction_codes",
        rowId: c.id,
        action: "create",
        before: null,
        after: chunk[j] as unknown as Record<string, unknown>,
        effectiveFrom: chunk[j].effectiveFrom,
      })),
    );
  }
}

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

/**
 * Every current tax code for one state. Rows whose name is already taken, or
 * that share a name with another row in the batch (a city split across
 * counties), are skipped and listed - those need a person to pick the right one.
 */
export async function promoteStateTaxCodes(formData: FormData) {
  const session = await requireSession();
  const returnTo = String(formData.get("returnTo") ?? "/config/directory");
  const state = String(formData.get("state") ?? "").toUpperCase();
  const includeRates = formData.get("includeRates") === "on";
  if (!/^[A-Z]{2}$/.test(state)) return back(returnTo, { msg: "Pick a state first." });

  const rows = await db
    .select()
    .from(jurisdictionDirectory)
    .where(
      and(
        eq(jurisdictionDirectory.state, state),
        eq(jurisdictionDirectory.category, "tax"),
        or(isNull(jurisdictionDirectory.effectiveTo), gte(jurisdictionDirectory.effectiveTo, today())),
      ),
    );
  const candidates = rows
    .filter((r) => r.jurisdictionType !== "state" && (r.officialCode === "" || isPromotable(r)))
    .map((r) => toCode(r, includeRates));

  const plan = planPromotion(candidates as (NewCode & Candidate)[], await currentCodes(state));
  const toAdd = plan.add;
  const already = plan.alreadyPresent;
  const amb = [...new Set(plan.ambiguous.map((c) => c.jurisdictionName))];

  await insertCodes(session.email, toAdd);
  return back(returnTo, {
    msg:
      `${state}: added ${toAdd.length} filing code(s)${includeRates ? " with published rates" : " (codes only, no rates)"}; ` +
      `${already.length} already present` +
      (plan.noCode.length ? `, ${plan.noCode.length} have no published code. ` : ". ") +
      (amb.length
        ? `${amb.length} name(s) appear more than once and were skipped - add the right one by hand: ${amb.slice(0, 12).join(", ")}${amb.length > 12 ? "..." : ""}`
        : ""),
  });
}
