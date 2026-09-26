import { and, asc, isNull, lte, or, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { portals, stateTaxConfig } from "@/db/schema";
import { type Freq, fromConfigValue, parseFrequency, sortFreqs } from "@/lib/filing-frequency";
import { shapeOf } from "@/lib/portal-secrets";
import { PortalsView } from "./PortalsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portals" };

/**
 * What each state is actually on today, per tax type, straight from the rule
 * tables the engine files against. The tracker's own frequency cell wins when
 * it says anything at all - it is per ACCOUNT, and a state can have two
 * accounts on different schedules - but a third of those cells are blank, and
 * falling back here keeps those rows out of a useless "no schedule" bucket.
 */
async function configFrequencies(): Promise<Map<string, Freq[]>> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ state: stateTaxConfig.state, frequency: stateTaxConfig.frequency })
    .from(stateTaxConfig)
    .where(
      and(
        dsql`${stateTaxConfig.active}`,
        lte(stateTaxConfig.effectiveFrom, today),
        or(isNull(stateTaxConfig.effectiveTo), dsql`${stateTaxConfig.effectiveTo} >= ${today}`),
      ),
    );

  const byState = new Map<string, Set<Freq>>();
  for (const r of rows) {
    const f = fromConfigValue(r.frequency);
    if (!f) continue;
    const set = byState.get(r.state) ?? new Set<Freq>();
    set.add(f);
    byState.set(r.state, set);
  }
  return new Map([...byState].map(([s, set]) => [s, sortFreqs([...set])]));
}

export default async function PortalsPage() {
  let rows: (typeof portals.$inferSelect)[] = [];
  let byState = new Map<string, Freq[]>();
  try {
    [rows, byState] = await Promise.all([
      db.select().from(portals).orderBy(asc(portals.state), asc(portals.sortOrder)),
      configFrequencies(),
    ]);
  } catch {
    rows = [];
  }

  return (
    <PortalsView
      rows={rows.map((r) => {
        const own = sortFreqs(parseFrequency(r.frequency));
        return {
          id: r.id,
          state: r.state,
          label: r.label,
          purpose: r.purpose,
          portalUrl: r.portalUrl,
          loginId: r.loginId,
          licenseNumber: r.licenseNumber,
          frequency: r.frequency,
          freqs: own.length ? own : (byState.get(r.state) ?? []),
          /** True when the schedule came from the rule tables, not this account. */
          freqInferred: own.length === 0,
          status: r.status,
          notes: r.notes,
          // Which credentials exist, never what they are. The values come
          // later, one card at a time, through the reveal action.
          secrets: shapeOf(r.secretCipher),
        };
      })}
      fein={process.env.COMPANY_FEIN ?? "82-1098441"}
    />
  );
}
