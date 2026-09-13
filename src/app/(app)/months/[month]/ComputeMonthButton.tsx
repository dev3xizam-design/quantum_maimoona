"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { computeMonth } from "@/app/actions/months";

export function ComputeMonthButton({ month, recompute }: { month: string; recompute: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11.5px] text-[var(--danger)]">{error}</span>}
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await computeMonth(month);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending
          ? "Computing every state…"
          : recompute
            ? "Recompute this month"
            : "Compute this month"}
      </button>
    </div>
  );
}
