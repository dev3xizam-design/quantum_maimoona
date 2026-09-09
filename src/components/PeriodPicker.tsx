"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { recentMonths, periodLabel } from "@/lib/periods";

export function PeriodPicker({ month, count = 24 }: { month: string; count?: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const months = recentMonths(count);
  if (!months.includes(month)) months.unshift(month);

  return (
    <select
      value={month}
      className="max-w-[220px]"
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("month", e.target.value);
        router.push(`?${next.toString()}`);
      }}
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {periodLabel(m)}
        </option>
      ))}
    </select>
  );
}
