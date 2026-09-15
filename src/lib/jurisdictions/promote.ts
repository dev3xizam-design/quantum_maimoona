/**
 * Deciding which directory rows may become filing codes. Pure, so the
 * collision rules are unit-tested rather than trusted.
 *
 * The engine indexes filing codes by type + normalised name (and alias), and
 * the last row under a key wins. So a row may only be added when its key is
 * free AND no other row in the same batch wants that key - otherwise a city
 * split across counties would overwrite whichever portion was verified.
 */
import { codeKey } from "../engine/sales";

export type ExistingCode = {
  jurisdictionType: string;
  jurisdictionName: string;
  officialCode: string;
  avalaraAlias: string | null;
};

export type Candidate = { jurisdictionType: string; jurisdictionName: string; officialCode: string };

export type PromotionPlan<T extends Candidate> = {
  add: T[];
  /** Name or code already in the filing codes. */
  alreadyPresent: T[];
  /** Name appears more than once in the batch - a person has to pick. */
  ambiguous: T[];
  /** The state publishes no code for it. */
  noCode: T[];
};

const nameKey = (type: string, name: string | null) => `${type}|${codeKey(name)}`;

export function planPromotion<T extends Candidate>(allCandidates: T[], existing: ExistingCode[]): PromotionPlan<T> {
  const takenNames = new Set<string>();
  const takenCodes = new Set<string>();
  for (const c of existing) {
    takenNames.add(nameKey(c.jurisdictionType, c.jurisdictionName));
    if (c.avalaraAlias) takenNames.add(nameKey(c.jurisdictionType, c.avalaraAlias));
    takenCodes.add(`${c.jurisdictionType}|${c.officialCode}`);
  }

  const wanted = new Map<string, Set<string>>();
  const candidates = allCandidates.filter((c) => c.officialCode.trim() !== "");
  for (const c of candidates) {
    const k = nameKey(c.jurisdictionType, c.jurisdictionName);
    // Count distinct codes, so the same code listed twice is not "ambiguous".
    wanted.set(k, (wanted.get(k) ?? new Set()).add(c.officialCode));
  }

  const plan: PromotionPlan<T> = {
    add: [],
    alreadyPresent: [],
    ambiguous: [],
    noCode: allCandidates.filter((c) => c.officialCode.trim() === ""),
  };
  const added = new Set<string>();
  for (const c of candidates) {
    const nk = nameKey(c.jurisdictionType, c.jurisdictionName);
    const ck = `${c.jurisdictionType}|${c.officialCode}`;
    if (takenCodes.has(ck) || takenNames.has(nk)) plan.alreadyPresent.push(c);
    else if ((wanted.get(nk)?.size ?? 0) > 1) plan.ambiguous.push(c);
    else if (!added.has(ck)) {
      added.add(ck);
      plan.add.push(c);
    }
  }
  return plan;
}
