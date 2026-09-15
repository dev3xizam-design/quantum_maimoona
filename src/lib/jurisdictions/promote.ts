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
  /** County the code covers; lets a city with one code per county portion be added whole. */
  countyName?: string | null;
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
  for (const c of existing) {
    takenNames.add(nameKey(c.jurisdictionType, c.jurisdictionName));
    if (c.avalaraAlias) takenNames.add(nameKey(c.jurisdictionType, c.avalaraAlias));
  }

  const coded = allCandidates.filter((c) => c.officialCode.trim() !== "");
  // NE, SD, ND and UT list each place under the DOR's return code AND its SST
  // FIPS code. The return code is the one that gets filed, so it wins.
  const hasStateCode = new Set(coded.filter((c) => !isFips(c)).map((c) => nameKey(c.jurisdictionType, c.jurisdictionName)));
  const superseded = coded.filter((c) => isFips(c) && hasStateCode.has(nameKey(c.jurisdictionType, c.jurisdictionName)));
  const candidates = coded.filter((c) => !superseded.includes(c));

  /**
   * Several codes under one name are fine when each is tied to a different
   * county (Tulsa, Kingsport, De Soto): the engine picks by destination county.
   * Several codes with no county to tell them apart need a person.
   */
  const group = new Map<string, T[]>();
  for (const c of candidates) {
    const k = nameKey(c.jurisdictionType, c.jurisdictionName);
    group.set(k, [...(group.get(k) ?? []), c]);
  }
  const resolvable = (list: T[]) => {
    const codes = new Set(list.map((c) => c.officialCode));
    if (codes.size <= 1) return true;
    const byCounty = new Map<string, Set<string>>();
    for (const c of list) {
      const county = (c.countyName ?? "").trim().toLowerCase();
      if (!county) return false;
      byCounty.set(county, (byCounty.get(county) ?? new Set()).add(c.officialCode));
    }
    return [...byCounty.values()].every((s) => s.size === 1);
  };

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
    // Same name AND same code AND same county is a true duplicate; NYC's five
    // boroughs share 8081 under five names and all belong in.
    const dup = `${nk}|${c.officialCode}|${(c.countyName ?? "").toLowerCase()}`;
    if (takenNames.has(nk)) plan.alreadyPresent.push(c);
    else if (!resolvable(group.get(nk)!)) plan.ambiguous.push(c);
    else if (!added.has(dup)) {
      added.add(dup);
      plan.add.push(c);
    }
  }
  return plan;
}
