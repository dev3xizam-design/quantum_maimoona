/**
 * Deciding which directory rows may become filing codes. Pure, so the
 * collision rules are unit-tested rather than trusted.
 *
 * The engine indexes filing codes by type + normalised name (and alias), and
 * the last row under a key wins. So a row may only be added when its key is
 * free AND no other row in the same batch wants that key - otherwise a city
 * split across counties would overwrite whichever portion was verified.
 */
import { indexKey } from "../engine/sales";

export type ExistingCode = {
  jurisdictionType: string;
  jurisdictionName: string;
  officialCode: string;
  avalaraAlias: string | null;
};

export type Candidate = {
  jurisdictionType: string;
  jurisdictionName: string;
  officialCode: string;
  /** Whose code it is. A state's own return code outranks a FIPS code for the same place. */
  codeSystem?: string;
};

const isFips = (c: Candidate) => /FIPS/i.test(c.codeSystem ?? "");

export type PromotionPlan<T extends Candidate> = {
  add: T[];
  /** Name or code already in the filing codes. */
  alreadyPresent: T[];
  /** Name appears more than once in the batch - a person has to pick. */
  ambiguous: T[];
  /** The state publishes no code for it. */
  noCode: T[];
  /** A FIPS code for a place that also has the state's own return code. */
  superseded: T[];
};

const nameKey = (type: string, name: string | null) => indexKey(type, name);

export function planPromotion<T extends Candidate>(allCandidates: T[], existing: ExistingCode[]): PromotionPlan<T> {
  const takenNames = new Set<string>();
  const takenCodes = new Set<string>();
  for (const c of existing) {
    takenNames.add(nameKey(c.jurisdictionType, c.jurisdictionName));
    if (c.avalaraAlias) takenNames.add(nameKey(c.jurisdictionType, c.avalaraAlias));
    takenCodes.add(`${c.jurisdictionType}|${c.officialCode}`);
  }

  const coded = allCandidates.filter((c) => c.officialCode.trim() !== "");
  // NE, SD, ND and UT list each place under the DOR's return code AND its SST
  // FIPS code. The return code is the one that gets filed, so it wins.
  const hasStateCode = new Set(coded.filter((c) => !isFips(c)).map((c) => nameKey(c.jurisdictionType, c.jurisdictionName)));
  const superseded = coded.filter((c) => isFips(c) && hasStateCode.has(nameKey(c.jurisdictionType, c.jurisdictionName)));
  const candidates = coded.filter((c) => !superseded.includes(c));

  const wanted = new Map<string, Set<string>>();
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
    superseded,
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
