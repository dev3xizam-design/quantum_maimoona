"use client";

import { markFiled, unmarkFiled } from "@/app/actions/filings";

export function FiledForm(props: {
  state: string;
  taxType: string;
  period: string;
  filed: boolean;
  confirmationNumber: string;
  filedAt: string | null;
  filedBy: string | null;
  suggestedAmount: number;
}) {
  if (props.filed) {
    return (
      <section className="panel p-4">
        <h2 className="mb-2 text-[13px] font-semibold">Filed</h2>
        <div className="callout callout-ok">
          Filed {props.filedAt}
          {props.filedBy ? ` by ${props.filedBy}` : ""}
          {props.confirmationNumber ? ` · confirmation ${props.confirmationNumber}` : ""}
        </div>
        <form action={unmarkFiled} className="mt-3">
          <input type="hidden" name="state" value={props.state} />
          <input type="hidden" name="taxType" value={props.taxType} />
          <input type="hidden" name="period" value={props.period} />
          <button className="btn btn-sm" type="submit">Reopen</button>
        </form>
      </section>
    );
  }

  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-[13px] font-semibold">Mark as filed</h2>
      <form action={markFiled} className="space-y-3">
        <input type="hidden" name="state" value={props.state} />
        <input type="hidden" name="taxType" value={props.taxType} />
        <input type="hidden" name="period" value={props.period} />
        <div>
          <label className="field" htmlFor="confirmationNumber">Confirmation number</label>
          <input id="confirmationNumber" name="confirmationNumber" type="text" />
        </div>
        <div>
          <label className="field" htmlFor="amountPaid">Amount paid</label>
          <input
            id="amountPaid"
            name="amountPaid"
            type="number"
            step="0.01"
            defaultValue={props.suggestedAmount || undefined}
          />
        </div>
        <div>
          <label className="field" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={2} />
        </div>
        <button className="btn btn-primary w-full" type="submit">Mark filed</button>
      </form>
    </section>
  );
}
