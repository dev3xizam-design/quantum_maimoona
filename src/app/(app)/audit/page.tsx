import { desc } from "drizzle-orm";
import { db } from "@/db";
import { changeLog, runLog } from "@/db/schema";
import { AuditView, type ChangeRow, type RunRow } from "./AuditView";

export const dynamic = "force-dynamic";

function summarize(before: unknown, after: unknown): string {
  if (!after || typeof after !== "object") return "—";
  const b = (before ?? {}) as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changed: string[] = [];
  for (const [k, v] of Object.entries(a)) {
    if (k === "updatedAt") continue;
    if (String(b[k] ?? "") !== String(v ?? "")) {
      changed.push(`${k}: ${String(b[k] ?? "—")} → ${String(v ?? "—")}`);
    }
  }
  return changed.length ? changed.join(" · ") : "no field changes";
}

export default async function AuditPage() {
  const [rawChanges, rawRuns] = await Promise.all([
    db.select().from(changeLog).orderBy(desc(changeLog.createdAt)).limit(300),
    db.select().from(runLog).orderBy(desc(runLog.startedAt)).limit(60),
  ]);

  const changes: ChangeRow[] = rawChanges.map((c) => ({
    id: c.id,
    when: c.createdAt.toISOString().slice(0, 16).replace("T", " "),
    actor: c.actor,
    tableName: c.tableName,
    action: c.action,
    effectiveFrom: c.effectiveFrom,
    summary: summarize(c.before, c.after),
  }));

  const runs: RunRow[] = rawRuns.map((r) => {
    const s = r.summary as { attempted?: number; succeeded?: number; failed?: unknown[] } | null;
    return {
      id: r.id,
      when: r.startedAt.toISOString().slice(0, 16).replace("T", " "),
      period: r.period,
      actor: r.actor,
      status: r.status,
      summary: s
        ? `${s.succeeded ?? 0} of ${s.attempted ?? 0} generated${s.failed?.length ? `, ${s.failed.length} failed` : ""}`
        : "—",
    };
  });

  return <AuditView changes={changes} runs={runs} />;
}
