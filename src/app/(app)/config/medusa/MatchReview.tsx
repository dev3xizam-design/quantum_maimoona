"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideMedusaMatch } from "@/app/actions/medusa";

export type MatchRow = {
  id: number;
  productTitle: string | null;
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  matchedSku: string | null;
  matchedDescription: string | null;
  matchMethod: string | null;
  matchScore: number | null;
};

export function MatchReview({ rows }: { rows: MatchRow[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const decide = (id: number, decision: "reject" | "accept") =>
    start(async () => {
      await decideMedusaMatch(id, decision);
      router.refresh();
    });

  return (
    <div>
      <table className="qtable">
        <thead>
          <tr>
            <th>Medusa product</th>
            <th>Matched to (from Avalara)</th>
            <th className="num">Confidence</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="max-w-[330px]">
                <div className="truncate">
                  {[r.productTitle, r.variantTitle].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="font-mono text-[10.5px] text-[var(--muted)]">
                  {r.sku ?? "no sku"} · {r.barcode ?? "no barcode"}
                </div>
              </td>
              <td className="max-w-[330px]">
                <div className="truncate">{r.matchedDescription ?? "—"}</div>
                <div className="font-mono text-[10.5px] text-[var(--muted)]">{r.matchedSku}</div>
              </td>
              <td className="num">
                <span
                  className={`badge ${
                    (r.matchScore ?? 0) >= 0.85 ? "badge-filed" : "badge-not_started"
                  }`}
                >
                  {r.matchScore !== null ? `${Math.round(r.matchScore * 100)}%` : "exact"}
                </span>
              </td>
              <td>
                <div className="flex gap-1.5">
                  <button
                    className="btn btn-sm"
                    disabled={pending}
                    onClick={() => decide(r.id, "accept")}
                    title="Keep this match and stop flagging it"
                  >
                    Confirm
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={pending}
                    onClick={() => decide(r.id, "reject")}
                    title="Wrong product - never match this variant again"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11.5px] text-[var(--muted)]">
        Rejecting is permanent — a later sync will not re-match that variant. Confirming keeps the
        match and marks it as yours, so it stops appearing here.
      </p>
    </div>
  );
}
