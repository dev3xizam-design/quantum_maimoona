/**
 * Applying one state's freshly downloaded jurisdiction data.
 *
 * The refresh runs on the OpenClaw server, downloads each state revenue
 * department's own file, and posts the parsed rows here. This module decides
 * whether to trust them, replaces that state's directory rows, and brings the
 * filing codes the engine uses along with it.
 *
 * What it will not do:
 * - touch a hand-entered or seeded code (only rows the directory created);
 * - switch on a rate (codes go in without one, as the bulk add does);
 * - accept a delivery that looks broken - a state that loses most of its rows,
 *   or arrives empty, keeps the data it already had and the run is recorded as
 *   rejected. "Automatic" has to mean "automatic and still right".
 */
import { and, eq, inArray, isNull, like, or, gte, sql as dsql } from "drizzle-orm";
import { db } from "../../db";
import { changeLog, jurisdictionCodes, jurisdictionDirectory, jurisdictionRefreshRuns } from "../../db/schema";
import { indexKey } from "../engine/sales";
import { DIRECTORY_NOTE, isPromotable, type DirectoryRow } from "./directory";
import { planPromotion } from "./promote";
import { toCode, today } from "./promote-db";

/** A state whose delivery holds fewer than this share of the rows it had is not trusted. */
export const MIN_ROW_RATIO = 0.7;

export type RefreshInput = {
  state: string;
  rows: DirectoryRow[];
  source?: string | null;
  sourceUrls?: string[];
  fetchedAt?: string | null;
  /** Set only by a person who has looked at why the gate tripped. */
  force?: boolean;
};

export type RefreshOutcome = {
  state: string;
  status: "applied" | "rejected";
  rowsReceived: number;
  rowsBefore: number;
  codesAdded: number;
  codesClosed: number;
  message: string;
  changes: { added: string[]; closed: string[] };
};

function describeCode(c: { jurisdictionName: string; officialCode: string; countyName?: string | null }) {
  return `${c.jurisdictionName} (${c.officialCode}${c.countyName ? `, ${c.countyName}` : ""})`;
}

/**
 * Replaces one state's slice of the directory and syncs the filing codes that
 * came from it. All or nothing: a failure anywhere leaves the state as it was.
 */
export async function applyStateRefresh(input: RefreshInput, actor: string): Promise<RefreshOutcome> {
  const state = input.state.toUpperCase();
  const rows = input.rows.filter((r) => r.state.toUpperCase() === state);
  if (rows.length !== input.rows.length) {
    throw new Error(`refresh for ${state} carried rows for another state`);
  }

  const [[before]] = await Promise.all([
    db
      .select({ n: dsql<number>`count(*)::int` })
      .from(jurisdictionDirectory)
      .where(and(eq(jurisdictionDirectory.state, state), eq(jurisdictionDirectory.category, "tax"))),
  ]);
  const rowsBefore = Number(before.n);
  const rowsReceived = rows.length;

  const reject = async (message: string): Promise<RefreshOutcome> => {
    const outcome: RefreshOutcome = {
      state, status: "rejected", rowsReceived, rowsBefore, codesAdded: 0, codesClosed: 0,
      message, changes: { added: [], closed: [] },
    };
    await recordRun(input, outcome);
    return outcome;
  };

  if (!rowsReceived) return reject("no rows received - keeping the data already loaded");
  if (!input.force && rowsBefore > 0 && rowsReceived < rowsBefore * MIN_ROW_RATIO) {
    return reject(
      `${rowsReceived} rows is under ${Math.round(MIN_ROW_RATIO * 100)}% of the ${rowsBefore} already loaded - ` +
        `this usually means the state changed its file, not that the jurisdictions went away. Keeping the old data.`,
    );
  }

  const added: string[] = [];
  const closed: string[] = [];

  await db.transaction(async (tx) => {
    /* ---- the directory: this state's rows are replaced wholesale ---- */
    await tx
      .delete(jurisdictionDirectory)
      .where(and(eq(jurisdictionDirectory.state, state), eq(jurisdictionDirectory.category, "tax")));
    for (let i = 0; i < rows.length; i += 1000) {
      await tx.insert(jurisdictionDirectory).values(rows.slice(i, i + 1000));
    }

    /* ---- filing codes: add what is new, close what the state dropped ---- */
    const existing = await tx
      .select()
      .from(jurisdictionCodes)
      .where(
        and(
          eq(jurisdictionCodes.state, state),
          or(isNull(jurisdictionCodes.effectiveTo), gte(jurisdictionCodes.effectiveTo, today())),
        ),
      );

    const candidates = rows
      .filter((r) => r.jurisdictionType !== "state" && isPromotable({ ...r, category: "tax" }))
      .map((r) => {
        const value = toCode({ ...r, id: 0, category: "tax" } as never, false);
        return { ...value, codeSystem: r.codeSystem, countyName: r.countyName, value };
      });

    const plan = planPromotion(candidates, existing);
    if (plan.add.length) {
      const values = plan.add.map((c) => c.value);
      for (let i = 0; i < values.length; i += 500) {
        const chunk = values.slice(i, i + 500);
        const created = await tx.insert(jurisdictionCodes).values(chunk).returning({ id: jurisdictionCodes.id });
        await tx.insert(changeLog).values(
          created.map((row, j) => ({
            actor,
            tableName: "jurisdiction_codes",
            rowId: row.id,
            action: "create",
            before: null,
            after: chunk[j] as unknown as Record<string, unknown>,
            effectiveFrom: chunk[j].effectiveFrom,
          })),
        );
      }
      added.push(...plan.add.map(describeCode));
    }

    /**
     * A code the state no longer publishes is closed, not deleted: past periods
     * keep the code they were filed under. Only codes the directory created -
     * a person's own row is never closed by a download.
     */
    const stillPublished = new Set(rows.map((r) => `${indexKey(r.jurisdictionType, r.jurisdictionName)}|${r.officialCode}`));
    const fromDirectory = existing.filter((c) => c.notes?.startsWith(DIRECTORY_NOTE));
    const gone = fromDirectory.filter(
      (c) => !stillPublished.has(`${indexKey(c.jurisdictionType, c.jurisdictionName)}|${c.officialCode}`),
    );
    // Types differ between the directory ("town") and the engine ("city"), so
    // match on the engine's own key rather than the directory's type name.
    const publishedEngineKeys = new Set(
      candidates.map((c) => `${indexKey(c.jurisdictionType, c.jurisdictionName)}|${c.officialCode}`),
    );
    const reallyGone = gone.filter(
      (c) => !publishedEngineKeys.has(`${indexKey(c.jurisdictionType, c.jurisdictionName)}|${c.officialCode}`),
    );
    if (reallyGone.length) {
      const ids = reallyGone.map((c) => c.id);
      await tx
        .update(jurisdictionCodes)
        .set({ effectiveTo: yesterday(), updatedAt: new Date() })
        .where(inArray(jurisdictionCodes.id, ids));
      await tx.insert(changeLog).values(
        reallyGone.map((c) => ({
          actor,
          tableName: "jurisdiction_codes",
          rowId: c.id,
          action: "update",
          before: c as unknown as Record<string, unknown>,
          after: { effectiveTo: yesterday(), reason: `${state} no longer publishes this code` },
          effectiveFrom: null,
        })),
      );
      closed.push(...reallyGone.map(describeCode));
    }
  });

  const outcome: RefreshOutcome = {
    state,
    status: "applied",
    rowsReceived,
    rowsBefore,
    codesAdded: added.length,
    codesClosed: closed.length,
    message:
      `${rowsReceived} rows loaded (was ${rowsBefore}); ` +
      `${added.length} filing code(s) added, ${closed.length} closed.`,
    changes: { added: added.slice(0, 200), closed: closed.slice(0, 200) },
  };
  await recordRun(input, outcome);
  return outcome;
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function recordRun(input: RefreshInput, outcome: RefreshOutcome) {
  await db.insert(jurisdictionRefreshRuns).values({
    state: outcome.state,
    status: outcome.status,
    source: input.source ?? null,
    sourceUrls: input.sourceUrls ?? [],
    rowsReceived: outcome.rowsReceived,
    rowsBefore: outcome.rowsBefore,
    codesAdded: outcome.codesAdded,
    codesClosed: outcome.codesClosed,
    message: outcome.message,
    changes: outcome.changes,
    fetchedAt: input.fetchedAt ? new Date(input.fetchedAt) : null,
  });
}

/** What the server is allowed to skip: states whose data has not changed. */
export async function currentStateFingerprints(): Promise<Record<string, { rows: number; codes: number }>> {
  const rows = await db
    .select({
      state: jurisdictionDirectory.state,
      n: dsql<number>`count(*)::int`,
    })
    .from(jurisdictionDirectory)
    .where(eq(jurisdictionDirectory.category, "tax"))
    .groupBy(jurisdictionDirectory.state);
  const codes = await db
    .select({ state: jurisdictionCodes.state, n: dsql<number>`count(*)::int` })
    .from(jurisdictionCodes)
    .where(like(jurisdictionCodes.notes, `${DIRECTORY_NOTE}%`))
    .groupBy(jurisdictionCodes.state);
  const byState: Record<string, { rows: number; codes: number }> = {};
  for (const r of rows) byState[r.state] = { rows: Number(r.n), codes: 0 };
  for (const c of codes) byState[c.state] = { rows: byState[c.state]?.rows ?? 0, codes: Number(c.n) };
  return byState;
}
