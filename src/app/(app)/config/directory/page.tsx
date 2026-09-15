import { and, asc, eq, inArray, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { jurisdictionCodes, jurisdictionDirectory } from "@/db/schema";
import { promoteDirectoryRow, promoteStateTaxCodes } from "@/app/actions/directory";
import { JURISDICTION_TYPES, engineType, isPromotable } from "@/lib/jurisdictions/directory";
import { STATE_NAMES } from "@/lib/states";

export const dynamic = "force-dynamic";
export const metadata = { title: "US jurisdiction directory" };

const PAGE_SIZE = 100;
type Category = "tax" | "government" | "all";

const pct = (v: string | null) => (v === null ? "" : `${(Number(v) * 100).toFixed(3).replace(/\.?0+$/, "")}%`);

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; cat?: string; type?: string; q?: string; page?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const state = STATE_NAMES[(sp.state ?? "").toUpperCase()] ? (sp.state as string).toUpperCase() : "";
  const cat: Category = sp.cat === "government" || sp.cat === "all" ? sp.cat : "tax";
  const type = (JURISDICTION_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as string) : "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const filters = [
    state ? eq(jurisdictionDirectory.state, state) : undefined,
    cat !== "all" ? eq(jurisdictionDirectory.category, cat) : undefined,
    type ? eq(jurisdictionDirectory.jurisdictionType, type) : undefined,
    q
      ? dsql`(${jurisdictionDirectory.jurisdictionName} ILIKE ${"%" + q + "%"} OR ${jurisdictionDirectory.officialCode} ILIKE ${q + "%"} OR ${jurisdictionDirectory.countyName} ILIKE ${"%" + q + "%"})`
      : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const [[totals], [matching], perState] = await Promise.all([
    db
      .select({
        tax: dsql<number>`count(*) FILTER (WHERE ${jurisdictionDirectory.category} = 'tax')::int`,
        gov: dsql<number>`count(*) FILTER (WHERE ${jurisdictionDirectory.category} = 'government')::int`,
        states: dsql<number>`count(DISTINCT ${jurisdictionDirectory.state}) FILTER (WHERE ${jurisdictionDirectory.category} = 'tax')::int`,
      })
      .from(jurisdictionDirectory),
    db.select({ n: dsql<number>`count(*)::int` }).from(jurisdictionDirectory).where(where),
    db
      .select({ state: jurisdictionDirectory.state, n: dsql<number>`count(*)::int` })
      .from(jurisdictionDirectory)
      .where(cat !== "all" ? eq(jurisdictionDirectory.category, cat) : undefined)
      .groupBy(jurisdictionDirectory.state),
  ]);
  const total = Number(matching.n);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);

  const rows = await db
    .select()
    .from(jurisdictionDirectory)
    .where(where)
    .orderBy(asc(jurisdictionDirectory.state), asc(jurisdictionDirectory.jurisdictionType), asc(jurisdictionDirectory.jurisdictionName))
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);

  // Which rows on this page are already filing codes the engine uses.
  const pageStates = [...new Set(rows.map((r) => r.state))];
  const inEngine = new Set<string>();
  if (pageStates.length) {
    const existing = await db
      .select({ state: jurisdictionCodes.state, type: jurisdictionCodes.jurisdictionType, code: jurisdictionCodes.officialCode })
      .from(jurisdictionCodes)
      .where(inArray(jurisdictionCodes.state, pageStates));
    for (const e of existing) inEngine.add(`${e.state}|${e.type}|${e.code}`);
  }

  const countFor = new Map(perState.map((p) => [p.state, Number(p.n)]));
  const base = { state, cat, type, q };
  const qs = (next: Partial<typeof base & { page: number }>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...next })) if (v !== "" && v !== undefined) p.set(k, String(v));
    return p.toString();
  };
  const returnTo = `/config/directory?${qs({ page: current })}`;
  const stateTaxCount = state && cat === "tax" && !type && !q ? total : 0;

  return (
    <div className="space-y-4">
      {sp.msg && <div className="callout callout-info">{sp.msg}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="stat">
          <div className="stat-label">Tax filing codes</div>
          <div className="stat-value">{Number(totals.tax).toLocaleString()}</div>
          <div className="stat-sub">published by {Number(totals.states)} state revenue departments</div>
        </div>
        <div className="stat">
          <div className="stat-label">Governments (Census FIPS)</div>
          <div className="stat-value">{Number(totals.gov).toLocaleString()}</div>
          <div className="stat-sub">every state, county, city, town, village, township</div>
        </div>
        <div className="stat">
          <div className="stat-label">Download everything</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn btn-sm" href="/downloads/us-jurisdictions.xlsx">Excel</a>
            <a className="btn btn-sm" href="/downloads/us-jurisdictions.csv">CSV (all)</a>
            <a className="btn btn-sm" href="/downloads/us-tax-jurisdiction-codes.csv">CSV (tax codes)</a>
          </div>
        </div>
      </div>

      <div className="callout callout-note">
        This is a reference directory - the engine never reads it. A code reaches a return only once you add it to{" "}
        <a className="underline" href="/config/jurisdictions">Jurisdiction codes</a>. A Census FIPS code identifies a
        government; it is not a filing code unless that state&apos;s return asks for FIPS. Rates change quarterly -
        check the row&apos;s source before filing on one.
      </div>

      <form method="get" className="panel grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
        <div>
          <label className="field">State</label>
          <select name="state" defaultValue={state}>
            <option value="">All states</option>
            {Object.keys(STATE_NAMES).sort().map((s) => (
              <option key={s} value={s}>
                {s} - {STATE_NAMES[s]} ({(countFor.get(s) ?? 0).toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field">Show</label>
          <select name="cat" defaultValue={cat}>
            <option value="tax">Tax filing codes</option>
            <option value="government">Governments (FIPS)</option>
            <option value="all">Both</option>
          </select>
        </div>
        <div>
          <label className="field">Type</label>
          <select name="type" defaultValue={type}>
            <option value="">Any type</option>
            {JURISDICTION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field">Name, code or county</label>
          <input name="q" type="text" defaultValue={q} placeholder="e.g. Tulsa or 7204" />
        </div>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" type="submit">Filter</button>
          {state && (
            <>
              <a className="btn btn-sm" href={`/api/jurisdictions/export?${qs({ page: undefined })}&format=csv`}>CSV</a>
              <a className="btn btn-sm" href={`/api/jurisdictions/export?${qs({ page: undefined })}&format=xlsx`}>Excel</a>
            </>
          )}
        </div>
      </form>

      {stateTaxCount > 0 && (
        <form action={promoteStateTaxCodes} className="panel flex flex-wrap items-center gap-3 p-4">
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="text-[13px]">
            Add all <strong>{stateTaxCount.toLocaleString()}</strong> {STATE_NAMES[state]} tax codes to the filing codes.
            Names already there, and names listed more than once, are skipped and reported.
          </div>
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" name="includeRates" />
            Include published rates (changes computed tax and collection warnings)
          </label>
          <button className="btn" type="submit">Add {state} codes</button>
        </form>
      )}

      <div className="text-[12px] text-[var(--muted)]">
        {total.toLocaleString()} matching - page {current} of {pages}
      </div>

      <div className="panel overflow-x-auto">
        <table className="qtable">
          <thead>
            <tr>
              <th>State</th>
              <th>Jurisdiction</th>
              <th>Type</th>
              <th>Code</th>
              <th>Code system</th>
              <th>County</th>
              <th>Paired</th>
              <th className="num">Local</th>
              <th className="num">Combined</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const added = inEngine.has(`${r.state}|${engineType(r.jurisdictionType)}|${r.officialCode}`);
              return (
                <tr key={r.id}>
                  <td className="font-semibold">{r.state}</td>
                  <td>{r.jurisdictionName}</td>
                  <td>{r.jurisdictionType}</td>
                  <td className="font-mono text-[12px]">
                    {r.officialCode || <span className="font-sans text-[11px] text-[var(--muted)]">none published</span>}
                  </td>
                  <td className="text-[11px]">{r.codeSystem}</td>
                  <td className="max-w-[180px] text-[11px]">{r.countyName ?? ""}</td>
                  <td className="font-mono text-[12px]">
                    {r.pairedCode ? `${r.pairedCode}${r.pairedName ? ` ${r.pairedName}` : ""}` : ""}
                  </td>
                  <td className="num">{pct(r.localRate)}</td>
                  <td className="num">{pct(r.combinedRate)}</td>
                  <td className="max-w-[280px] text-[11px] text-[var(--muted)]">
                    {r.notes ?? ""}
                    {r.sourceUrl && (
                      <>
                        {r.notes ? " " : ""}
                        <a className="underline" href={r.sourceUrl} target="_blank" rel="noreferrer">source</a>
                      </>
                    )}
                  </td>
                  <td>
                    {isPromotable(r) &&
                      (added ? (
                        <span className="text-[11px] text-[var(--ok)]">In filing codes</span>
                      ) : (
                        <form action={promoteDirectoryRow}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button className="btn btn-sm" type="submit">Add</button>
                        </form>
                      ))}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-[var(--muted)]">
                  {Number(totals.tax) + Number(totals.gov) === 0
                    ? "The directory is empty - run npm run db:jurisdictions."
                    : "Nothing matches."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex gap-2">
          {current > 1 && <a className="btn btn-sm" href={`/config/directory?${qs({ page: current - 1 })}`}>Previous</a>}
          {current < pages && <a className="btn btn-sm" href={`/config/directory?${qs({ page: current + 1 })}`}>Next</a>}
        </div>
      )}
    </div>
  );
}
