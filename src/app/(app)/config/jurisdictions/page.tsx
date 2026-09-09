import { asc } from "drizzle-orm";
import { db } from "@/db";
import { jurisdictionCodes } from "@/db/schema";
import { num } from "@/lib/money";
import { deleteJurisdictionCode, saveJurisdictionCode } from "@/app/actions/config";

export const dynamic = "force-dynamic";

const TYPES = ["county", "city", "local", "special"];

function Fields({ r }: { r?: typeof jurisdictionCodes.$inferSelect }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
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

export default async function JurisdictionsPage() {
  const rows = await db
    .select()
    .from(jurisdictionCodes)
    .orderBy(asc(jurisdictionCodes.state), asc(jurisdictionCodes.jurisdictionType), asc(jurisdictionCodes.jurisdictionName));

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

      <div className="panel overflow-hidden">
        <table className="grid">
          <thead>
            <tr>
              <th>State</th>
              <th>Jurisdiction</th>
              <th>Type</th>
              <th>Code</th>
              <th>Paired</th>
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
    </div>
  );
}
