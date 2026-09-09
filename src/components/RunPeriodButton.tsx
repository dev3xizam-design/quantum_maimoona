"use client";

import { useState, useTransition } from "react";
import { runPeriod } from "@/app/actions/filings";

export function RunPeriodButton({ month }: { month: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await runPeriod(month);
            setMsg(
              res.failed.length
                ? `Generated ${res.succeeded} of ${res.attempted}. Failed: ${res.failed
                    .map((f) => `${f.state} ${f.taxType}`)
                    .join(", ")}`
                : `Generated ${res.succeeded} return${res.succeeded === 1 ? "" : "s"}.`,
            );
          })
        }
      >
        {pending ? "Running..." : "Run this period"}
      </button>
      {msg && <span className="text-[12px] text-[var(--muted)]">{msg}</span>}
    </div>
  );
}
