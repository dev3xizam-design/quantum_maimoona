import { and, asc, eq, ilike, like, not, or, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { jurisdictionCodes } from "@/db/schema";
import { num } from "@/lib/money";
import { deleteJurisdictionCode, saveJurisdictionCode } from "@/app/actions/config";
import { STATE_NAMES } from "@/lib/states";
import { DIRECTORY_NOTE } from "@/lib/jurisdictions/directory";

export const dynamic = "force-dynamic";

const TYPES = ["county", "city", "local", "special"];

/**
 * Paged: the directory's "Add all states" puts ~15,000 codes here, and rendering
 * every row with its edit form produced a 125 MB page that never loaded.
 */
const PAGE_SIZE = 100;
const FROM_DIRECTORY = `${DIRECTORY_NOTE}%`;

function Fields({ r }: { r?: typeof jurisdictionCodes.$inferSelect }) {
  return (
    <>
      <div className="grid grid-cols-5 gap-3">
        <div>
          <label className="field">State</label>
          <input name="state" type="text" defaultValue={r?.state ?? ""} required maxLength={2} />
        </div>
        <div>
          <label className="field">Jurisdiction name</label>
          <input name="jurisdictionName" type="text" defaultValue={r?.jurisdictionName ?? ""} required />
        </div>
        <div>
          <label className="field">Type</label>
          <select name="jurisdictionType" defaultValue={r?.jurisdictionType ?? "county"}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field">Official code</label>
          <input name="officialCode" type="text" defaultValue={r?.officialCode ?? ""} required />
        </div>
        <div>
          <label className="field">Paired code (OK)</label>
          <input name="pairedCode" type="text" defaultValue={r?.pairedCode ?? ""} />
        </div>
        <div>
          <label className="field">Paired name</label>
          <input name="pairedName" type="text" defaultValue={r?.pairedName ?? ""} />
        </div>
        <div>
          <label className="field">Rate (decimal)</label>
          <input name="rate" type="text" defaultValue={r?.rate ? num(r.rate) : ""} />
        </div>
        <div>
          <label className="field">County (picks between a city&apos;s per-county codes)</label>
          <input name="countyName" type="text" defaultValue={r?.countyName ?? ""} />
        </div>
        <div>
          <label className="field">Effective from</label>
          <input name="effectiveFrom" type="date" defaultValue={r?.effectiveFrom ?? "2026-01-01"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field">Avalara alias (e.g. Edmond &rarr; Oklahoma City)</label>
          <input name="avalaraAlias" type="text" defaultValue={r?.avalaraAlias ?? ""} />
        </div>
        <div>
          <label className="field">Notes</label>
          <input name="notes" type="text" defaultValue={r?.notes ?? ""} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[12px]">
        <input type="checkbox" name="rateIncludesState" defaultChecked={r?.rateIncludesState ?? false} />
        Published rate already includes the state rate (WY, AZ counties)
      </label>
    </>
  );
}

export default async function JurisdictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string; source?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const state = STATE_NAMES[(sp.state ?? "").toUpperCase()] ? (sp.state as string).toUpperCase() : "";
  const q = (sp.q ?? "").trim();
  const source = sp.source === "manual" || sp.source === "directory" ? sp.source : "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const filters = [
    state ? eq(jurisdictionCodes.state, state) : undefined,
    q
      ? or(
          ilike(jurisdictionCodes.jurisdictionName, `%${q}%`),
          ilike(jurisdictionCodes.officialCode, `${q}%`),
          ilike(jurisdictionCodes.avalaraAlias, `%${q}%`),
        )
      : undefined,
    source === "directory" ? like(jurisdictionCodes.notes, FROM_DIRECTORY) : undefined,
    source === "manual"
      ? or(dsql`${jurisdictionCodes.notes} IS NULL`, not(like(jurisdictionCodes.notes, FROM_DIRECTORY)))
      : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const [[counts]] = await Promise.all([
    db
      .select({
        total: dsql<number>`count(*)::int`,
        matching: dsql<number>`count(*) FILTER (WHERE ${where ?? dsql`true`})::int`,
        directory: dsql<number>`count(*) FILTER (WHERE ${like(jurisdictionCodes.notes, FROM_DIRECTORY)})::int`,
      })
      .from(jurisdictionCodes),
  ]);
  const matching = Number(counts.matching);
  const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const current = Math.min(page, pages);

  const rows = await db
    .select()
    .from(jurisdictionCodes)
    .where(where)
    .orderBy(asc(jurisdictionCodes.state), asc(jurisdictionCodes.jurisdictionType), asc(jurisdictionCodes.jurisdictionName))
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);

  const qs = (next: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ state, q, source, ...next })) if (String(v) !== "" && !(k === "page" && Number(v) === 1)) p.set(k, String(v));
    return p.toString();
  };

  return (
    <div className="space-y-4">
      <div className="callout callout-note">
        Avalara may tax an address under a different named jurisdiction than the city on the label -
        Edmond is taxed as Oklahoma City, Marlow as Duncan. Record that in <em>Avalara alias</em> so
        the allocation picks up the right code. Load the full AZ region and OK COPO charts here.
      </div>

      <details className="panel p-4">
        <summary className="cursor-pointer text-[13px] font-semibold">Add a jurisdiction code</summary>
        <form action={saveJurisdictionCode} className="mt-3 space-y-3">
          <Fields />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
      </details>

      <form method="get" className="panel grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <div>
          <label className="field">State</label>
          <select name="state" defaultValue={state}>
            <option value="">All states</option>
            {Object.keys(STATE_NAMES).sort().map((s) => (
              <option key={s} value={s}>{s} - {STATE_NAMES[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field">Name, code or alias</label>
          <input name="q" type="text" defaultValue={q} placeholder="e.g. Tulsa or 7204" />
        </div>
        <div>
          <label className="field">Source</label>
          <select name="source" defaultValue={source}>
            <option value="">All codes</option>
            <option value="manual">Hand-entered and seeded</option>
            <option value="directory">Added from the US directory</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary" type="submit">Filter</button>
        </div>
      </form>

      <div className="text-[12px] text-[var(--muted)]">
        {matching.toLocaleString()} of {Number(counts.total).toLocaleString()} codes
        {Number(counts.directory) > 0 && ` (${Number(counts.directory).toLocaleString()} added from the US directory)`}
        {" "}- page {current} of {pages}
      </div>

      <div className="panel overflow-x-auto">
        <table className="qtable">
          <thead>
            <tr>
              <th>State</th>
              <th>Jurisdiction</th>
              <th>Type</th>
              <th>Code</th>
              <th>Paired</th>
              <th>County</th>
              <th className="num">Rate</th>
              <th>Alias</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.state}</td>
                <td>{r.jurisdictionName}</td>
                <td>{r.jurisdictionType}</td>
                <td className="font-mono text-[12px]">{r.officialCode}</td>
                <td className="font-mono text-[12px]">{r.pairedCode ?? ""}</td>
                <td className="text-[11px]">{r.countyName ?? ""}</td>
                <td className="num">{r.rate ? num(r.rate) : ""}</td>
                <td>{r.avalaraAlias ?? ""}</td>
                <td className="max-w-[260px] text-[11px] text-[var(--muted)]">{r.notes ?? ""}</td>
                <td>
                  <details>
                    <summary className="btn btn-sm cursor-pointer list-none">Edit</summary>
                    <div className="mt-3 w-[720px] space-y-3 rounded-lg border border-[var(--line)] bg-slate-50 p-3">
                      <form action={saveJurisdictionCode} className="space-y-3">
                        <input type="hidden" name="id" value={r.id} />
                        <Fields r={r} />
                        <button className="btn btn-primary" type="submit">Save</button>
                      </form>
                      <form action={deleteJurisdictionCode}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn btn-sm" type="submit">Delete</button>
                      </form>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex gap-2">
          {current > 1 && <a className="btn btn-sm" href={`/config/jurisdictions?${qs({ page: current - 1 })}`}>Previous</a>}
          {current < pages && <a className="btn btn-sm" href={`/config/jurisdictions?${qs({ page: current + 1 })}`}>Next</a>}
        </div>
      )}
    </div>
  );
}
