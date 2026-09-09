"use client";

import { useState, useTransition } from "react";
import { computeOne } from "@/app/actions/filings";

export function RecomputeButton(props: { state: string; taxType: string; period: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-[12px] text-[var(--danger)]">{err}</span>}
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await computeOne(props.state, props.taxType, props.period);
            setErr(res.ok ? null : (res.error ?? "Failed"));
          })
        }
      >
        {pending ? "Recomputing..." : "Recompute"}
      </button>
    </div>
  );
}
