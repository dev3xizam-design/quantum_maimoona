/**
 * Moving directory rows into jurisdiction_codes. Database code, but no Next
 * imports, so the integration test runs it against a real Postgres.
 */
import { and, eq, gte, inArray, isNull, like, or } from "drizzle-orm";
import { db } from "../../db";
import { changeLog, jurisdictionCodes, jurisdictionDirectory } from "../../db/schema";
import { DEFAULT_EFFECTIVE_FROM } from "../seed-data";
import { DIRECTORY_NOTE, PAIRED_ON_RETURN, engineRate, engineType, isPromotable } from "./directory";
import { planPromotion } from "./promote";

export type DirRow = typeof jurisdictionDirectory.$inferSelect;
export type NewCode = typeof jurisdictionCodes.$inferInsert;

export const today = () => new Date().toISOString().slice(0, 10);


export function toCode(r: DirRow, includeRate: boolean): NewCode {
  const rate = includeRate ? engineRate(r) : null;
  const effectiveFrom =
    r.effectiveFrom && r.effectiveFrom > DEFAULT_EFFECTIVE_FROM ? r.effectiveFrom : DEFAULT_EFFECTIVE_FROM;
  const notes = [
    `${DIRECTORY_NOTE}${r.codeSystem})`,
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
    // A published rate stops being true when its row ends; the code itself does not.
    effectiveTo: includeRate ? r.effectiveTo : null,
    updatedAt: new Date(),
  };
}

export async function currentCodes(state: string) {
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

export async function insertCodes(actor: string, values: NewCode[]) {
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

export type Summary = { added: number; already: number; noCode: number; ambiguous: string[] };

/**
 * Plans and inserts every current, promotable tax code for the given states
 * (all states when none are given). Per state, rows whose name is already
 * taken, or that share a name with another row in the batch (a city split
 * across counties), are skipped - those need a person to pick the right one.
 */
export async function promoteStates(actor: string, states: string[] | null, includeRates: boolean): Promise<Summary> {
  const dirFilters = [
    eq(jurisdictionDirectory.category, "tax"),
    or(isNull(jurisdictionDirectory.effectiveTo), gte(jurisdictionDirectory.effectiveTo, today())),
    states ? inArray(jurisdictionDirectory.state, states) : undefined,
  ];
  const codeFilters = [
    or(isNull(jurisdictionCodes.effectiveTo), gte(jurisdictionCodes.effectiveTo, today())),
    states ? inArray(jurisdictionCodes.state, states) : undefined,
  ];
  const [rows, existing] = await Promise.all([
    db.select().from(jurisdictionDirectory).where(and(...dirFilters)),
    db.select().from(jurisdictionCodes).where(and(...codeFilters)),
  ]);

  const byState = new Map<string, { rows: DirRow[]; existing: typeof existing }>();
  const slot = (st: string) => byState.get(st) ?? byState.set(st, { rows: [], existing: [] }).get(st)!;
  for (const r of rows) slot(r.state).rows.push(r);
  for (const c of existing) slot(c.state).existing.push(c);

  const summary: Summary = { added: 0, already: 0, noCode: 0, ambiguous: [] };
  const toAdd: NewCode[] = [];
  for (const [state, group] of byState) {
    const candidates = group.rows
      .filter((r) => r.jurisdictionType !== "state" && (r.officialCode === "" || isPromotable(r)))
      .map((r) => {
        const value = toCode(r, includeRates);
        return { ...value, jurisdictionType: value.jurisdictionType, codeSystem: r.codeSystem, value };
      });
    const plan = planPromotion(candidates, group.existing);
    toAdd.push(...plan.add.map((c) => c.value));
    summary.already += plan.alreadyPresent.length;
    summary.noCode += plan.noCode.length;
    summary.ambiguous.push(...new Set(plan.ambiguous.map((c) => `${state} ${c.jurisdictionName}`)));
  }
  await insertCodes(actor, toAdd);
  summary.added = toAdd.length;
  return summary;
}


/** Undo for the bulk add: only codes whose notes carry the directory marker. */
export async function removeDirectoryCreatedCodes(actor: string) {
  const removed = await db
    .delete(jurisdictionCodes)
    .where(like(jurisdictionCodes.notes, `${DIRECTORY_NOTE}%`))
    .returning();
  for (let i = 0; i < removed.length; i += 500) {
    await db.insert(changeLog).values(
      removed.slice(i, i + 500).map((r) => ({
        actor,
        tableName: "jurisdiction_codes",
        rowId: r.id,
        action: "delete",
        before: r as unknown as Record<string, unknown>,
        after: null,
        effectiveFrom: null,
      })),
    );
  }
  return removed.length;
}
