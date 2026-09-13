import { asc } from "drizzle-orm";
import { db } from "@/db";
import { stateTaxConfig } from "@/db/schema";
import { fmtPct, num } from "@/lib/money";
import { reviseStateConfig } from "@/app/actions/config";

export const dynamic = "force-dynamic";

const FREQ = ["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"];
const ALLOC = ["flat", "county", "city_county", "az_region", "pa_columns", "fl_surtax", "none"];
const ROUND = ["cents", "whole_dollar"];

export default async function StateConfigPage() {
  const rows = await db
    .select()
    .from(stateTaxConfig)
    .orderBy(asc(stateTaxConfig.state), asc(stateTaxConfig.taxType), asc(stateTaxConfig.effectiveFrom));

  return (
    <div className="panel overflow-hidden">
      <table className="qtable">
        <thead>
          <tr>
            <th>State</th>
            <th>Type</th>
            <th>Frequency</th>
            <th className="num">State rate</th>
            <th>Allocation</th>
            <th>Rounding</th>
            <th className="num">Due day</th>
            <th>Form</th>
            <th>Effective</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.active ? "" : "opacity-50"}>
              <td className="font-semibold">{r.state}</td>
              <td>{r.taxType}</td>
              <td>{r.frequency}</td>
              <td className="num">{fmtPct(num(r.stateRate))}</td>
              <td>{r.allocation}</td>
              <td>{r.rounding === "whole_dollar" ? "whole $" : "cents"}</td>
              <td className="num">{r.dueDay === 0 ? "last" : r.dueDay}</td>
              <td className="max-w-[180px] truncate">{r.formName ?? "-"}</td>
              <td className="whitespace-nowrap text-[11px]">
                {r.effectiveFrom}
                {r.effectiveTo ? ` to ${r.effectiveTo}` : ""}
              </td>
              <td>
                <details>
                  <summary className="btn btn-sm cursor-pointer list-none">Edit</summary>
                  <form action={reviseStateConfig} className="mt-3 w-[560px] space-y-3 rounded-lg border border-[var(--line)] bg-slate-50 p-3">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="field">Frequency</label>
                        <select name="frequency" defaultValue={r.frequency}>
                          {FREQ.map((f) => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field">State rate (decimal)</label>
                        <input name="stateRate" type="text" defaultValue={num(r.stateRate)} />
                      </div>
                      <div>
                        <label className="field">Due day (0 = last)</label>
                        <input name="dueDay" type="number" defaultValue={r.dueDay ?? 20} />
                      </div>
                      <div>
                        <label className="field">Allocation</label>
                        <select name="allocation" defaultValue={r.allocation}>
                          {ALLOC.map((a) => <option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field">Rounding</label>
                        <select name="rounding" defaultValue={r.rounding}>
                          {ROUND.map((a) => <option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field">Effective from</label>
                        <input name="effectiveFrom" type="date" defaultValue={r.effectiveFrom} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="field">Form name</label>
                        <input name="formName" type="text" defaultValue={r.formName ?? ""} />
                      </div>
                      <div>
                        <label className="field">Portal URL</label>
                        <input name="portal" type="text" defaultValue={r.portal ?? ""} />
                      </div>
                    </div>
                    <div>
                      <label className="field">Rate label</label>
                      <input name="rateLabel" type="text" defaultValue={r.rateLabel ?? ""} />
                    </div>
                    <div>
                      <label className="field">Notes / quirks</label>
                      <textarea name="notes" rows={3} defaultValue={r.notes ?? ""} />
                    </div>
                    <div className="flex items-center gap-4 text-[12px]">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="hasLocal" defaultChecked={r.hasLocal} /> Has local tax
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="active" defaultChecked={r.active} /> Active registration
                      </label>
                    </div>
                    <p className="text-[11px] text-[var(--muted)]">
                      Changing the effective date closes this row and opens a new one - past periods
                      are untouched.
                    </p>
                    <button className="btn btn-primary" type="submit">Save</button>
                  </form>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
