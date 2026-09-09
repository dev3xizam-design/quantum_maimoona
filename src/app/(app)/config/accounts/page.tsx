import { asc } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { saveAccount } from "@/app/actions/config";

export const dynamic = "force-dynamic";

function Fields({ r }: { r?: typeof accounts.$inferSelect }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="field">State</label>
        <input name="state" type="text" defaultValue={r?.state ?? ""} required maxLength={2} />
      </div>
      <div>
        <label className="field">Tax type</label>
        <select name="taxType" defaultValue={r?.taxType ?? "sales"}>
          <option value="sales">sales</option>
          <option value="excise">excise</option>
          <option value="pact">pact</option>
        </select>
      </div>
      <div>
        <label className="field">Account number</label>
        <input name="accountNumber" type="text" defaultValue={r?.accountNumber ?? ""} />
      </div>
      <div>
        <label className="field">License number</label>
        <input name="licenseNumber" type="text" defaultValue={r?.licenseNumber ?? ""} />
      </div>
      <div>
        <label className="field">Login field (e.g. FEIN + PIN)</label>
        <input name="loginField" type="text" defaultValue={r?.loginField ?? ""} />
      </div>
      <div>
        <label className="field">Frequency override</label>
        <input name="frequencyOverride" type="text" defaultValue={r?.frequencyOverride ?? ""} />
      </div>
      <div className="col-span-3">
        <label className="field">Notes</label>
        <input name="notes" type="text" defaultValue={r?.notes ?? ""} />
      </div>
    </div>
  );
}

export default async function AccountsPage() {
  const rows = await db.select().from(accounts).orderBy(asc(accounts.state), asc(accounts.taxType));

  return (
    <div className="space-y-4">
      <div className="callout callout-warn">
        Identifiers only. No passwords, no PINs, no card numbers, no bank logins - not in the notes
        field either.
      </div>

      <details className="panel p-4">
        <summary className="cursor-pointer text-[13px] font-semibold">Add an account</summary>
        <form action={saveAccount} className="mt-3 space-y-3">
          <Fields />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
      </details>

      <div className="panel overflow-hidden">
        <table className="grid">
          <thead>
            <tr>
              <th>State</th>
              <th>Type</th>
              <th>Account number</th>
              <th>License</th>
              <th>Login field</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.state}</td>
                <td>{r.taxType}</td>
                <td className="font-mono text-[12px]">{r.accountNumber ?? ""}</td>
                <td className="font-mono text-[12px]">{r.licenseNumber ?? ""}</td>
                <td>{r.loginField ?? ""}</td>
                <td className="max-w-[320px] text-[11px] text-[var(--muted)]">{r.notes ?? ""}</td>
                <td>
                  <details>
                    <summary className="btn btn-sm cursor-pointer list-none">Edit</summary>
                    <form action={saveAccount} className="mt-3 w-[640px] space-y-3 rounded-lg border border-[var(--line)] bg-slate-50 p-3">
                      <input type="hidden" name="id" value={r.id} />
                      <Fields r={r} />
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
