import { asc } from "drizzle-orm";
import { db } from "@/db";
import { exciseConfig } from "@/db/schema";
import { num } from "@/lib/money";
import { rateUnitLabel } from "@/lib/engine/excise";
import { reviseExciseConfig } from "@/app/actions/config";

export const dynamic = "force-dynamic";

const UNITS = ["pct_wholesale", "pct_retail", "per_ml", "per_unit"];
const STRUCTURES = [
  ["A", "A - % of wholesale cost"],
  ["B", "B - % of retail price"],
  ["C", "C - per millilitre"],
  ["D", "D - per cartridge / unit"],
  ["E", "E - bifurcated open / closed"],
];

export default async function ExciseConfigPage() {
  const rows = await db
    .select()
    .from(exciseConfig)
    .orderBy(asc(exciseConfig.state), asc(exciseConfig.effectiveFrom));

  return (
    <div className="space-y-4">
      <div className="callout callout-note">
        <strong>Basis matters.</strong> A RECEIPTS-basis return taxes what you purchased into
        inventory, not what you sold - Kansas EC-2 Line 1a is mL purchased. Receipts-basis states
        read the purchase import and ignore the sales export entirely.
      </div>

      <div className="panel overflow-hidden">
        <table className="qtable">
          <thead>
            <tr>
              <th>State</th>
              <th>Structure</th>
              <th>Basis</th>
              <th className="num">Rate</th>
              <th>Unit</th>
              <th>Open / closed</th>
              <th>Frequency</th>
              <th>Effective</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                <td className="font-semibold">{r.state}</td>
                <td>{r.structure}</td>
                <td>
                  <span className={`badge ${r.basis === "RECEIPTS" ? "badge-not_started" : "badge-no_activity"}`}>
                    {r.basis}
                  </span>
                </td>
                <td className="num">{r.structure === "E" ? "-" : num(r.rate)}</td>
                <td className="text-[11px]">{r.structure === "E" ? "-" : rateUnitLabel(r.rateUnit)}</td>
                <td className="text-[11px]">
                  {r.structure === "E"
                    ? `${num(r.openRate)} ${r.openRateUnit ?? ""} / ${num(r.closedRate)} ${r.closedRateUnit ?? ""}`
                    : "-"}
                </td>
                <td>{r.frequency}</td>
                <td className="whitespace-nowrap text-[11px]">
                  {r.effectiveFrom}
                  {r.effectiveTo ? ` to ${r.effectiveTo}` : ""}
                </td>
                <td>
                  <details>
                    <summary className="btn btn-sm cursor-pointer list-none">Edit</summary>
                    <form action={reviseExciseConfig} className="mt-3 w-[560px] space-y-3 rounded-lg border border-[var(--line)] bg-slate-50 p-3">
                      <input type="hidden" name="id" value={r.id} />
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="field">Structure</label>
                          <select name="structure" defaultValue={r.structure}>
                            {STRUCTURES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field">Basis</label>
                          <select name="basis" defaultValue={r.basis}>
                            <option value="SALES">SALES (sold)</option>
                            <option value="RECEIPTS">RECEIPTS (purchased)</option>
                          </select>
                        </div>
                        <div>
                          <label className="field">Frequency</label>
                          <select name="frequency" defaultValue={r.frequency}>
                            {["MONTHLY", "QUARTERLY", "ANNUAL"].map((f) => <option key={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field">Rate (A-D)</label>
                          <input name="rate" type="text" defaultValue={num(r.rate)} />
                        </div>
                        <div>
                          <label className="field">Rate unit</label>
                          <select name="rateUnit" defaultValue={r.rateUnit}>
                            {UNITS.map((u) => <option key={u} value={u}>{rateUnitLabel(u)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field">Due day (0 = last)</label>
                          <input name="dueDay" type="number" defaultValue={r.dueDay ?? 20} />
                        </div>
                        <div>
                          <label className="field">Open rate (E)</label>
                          <input name="openRate" type="text" defaultValue={r.openRate ? num(r.openRate) : ""} />
                        </div>
                        <div>
                          <label className="field">Open unit</label>
                          <select name="openRateUnit" defaultValue={r.openRateUnit ?? ""}>
                            <option value=""></option>
                            {UNITS.map((u) => <option key={u} value={u}>{rateUnitLabel(u)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field">Effective from</label>
                          <input name="effectiveFrom" type="date" defaultValue={r.effectiveFrom} />
                        </div>
                        <div>
                          <label className="field">Closed rate (E)</label>
                          <input name="closedRate" type="text" defaultValue={r.closedRate ? num(r.closedRate) : ""} />
                        </div>
                        <div>
                          <label className="field">Closed unit</label>
                          <select name="closedRateUnit" defaultValue={r.closedRateUnit ?? ""}>
                            <option value=""></option>
                            {UNITS.map((u) => <option key={u} value={u}>{rateUnitLabel(u)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field">Form</label>
                          <input name="formName" type="text" defaultValue={r.formName ?? ""} />
                        </div>
                      </div>
                      <div>
                        <label className="field">Portal URL</label>
                        <input name="portal" type="text" defaultValue={r.portal ?? ""} />
                      </div>
                      <div>
                        <label className="field">Notes</label>
                        <textarea name="notes" rows={3} defaultValue={r.notes ?? ""} />
                      </div>
                      <label className="flex items-center gap-2 text-[12px]">
                        <input type="checkbox" name="active" defaultChecked={r.active} /> Active registration
                      </label>
                      <button className="btn btn-primary" type="submit">Save</button>
                    </form>
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
