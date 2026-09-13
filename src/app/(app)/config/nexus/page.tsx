import { asc } from "drizzle-orm";
import { db } from "@/db";
import { nexusThresholds } from "@/db/schema";
import { fmtMoney, num } from "@/lib/money";
import { saveNexus } from "@/app/actions/config";

export const dynamic = "force-dynamic";

export default async function NexusPage() {
  const rows = await db.select().from(nexusThresholds).orderBy(asc(nexusThresholds.state));

  return (
    <div className="panel overflow-hidden">
      <table className="qtable">
        <thead>
          <tr>
            <th>State</th>
            <th className="num">Sales threshold</th>
            <th className="num">Transaction threshold</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-semibold">{r.state}</td>
              <td className="num">{r.amountThreshold ? fmtMoney(num(r.amountThreshold)) : "-"}</td>
              <td className="num">{r.txnThreshold ?? "-"}</td>
              <td className="text-[11px] text-[var(--muted)]">{r.notes ?? ""}</td>
              <td>
                <details>
                  <summary className="btn btn-sm cursor-pointer list-none">Edit</summary>
                  <form action={saveNexus} className="mt-3 w-[420px] space-y-3 rounded-lg border border-[var(--line)] bg-slate-50 p-3">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="field">Sales threshold</label>
                        <input name="amountThreshold" type="text" defaultValue={r.amountThreshold ? num(r.amountThreshold) : ""} />
                      </div>
                      <div>
                        <label className="field">Transactions</label>
                        <input name="txnThreshold" type="number" defaultValue={r.txnThreshold ?? ""} />
                      </div>
                    </div>
                    <div>
                      <label className="field">Notes</label>
                      <input name="notes" type="text" defaultValue={r.notes ?? ""} />
                    </div>
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
