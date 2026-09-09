import { desc } from "drizzle-orm";
import { db } from "@/db";
import { changeLog, runLog } from "@/db/schema";

export const dynamic = "force-dynamic";

function summarize(before: unknown, after: unknown): string {
  if (!after || typeof after !== "object") return "-";
  const b = (before ?? {}) as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changed: string[] = [];
  for (const [k, v] of Object.entries(a)) {
    if (k === "updatedAt") continue;
    const prev = b[k];
    if (String(prev ?? "") !== String(v ?? "")) {
      changed.push(`${k}: ${String(prev ?? "-")} → ${String(v ?? "-")}`);
    }
  }
  return changed.length ? changed.join(" · ") : "no field changes";
}

export default async function AuditPage() {
  const [changes, runs] = await Promise.all([
    db.select().from(changeLog).orderBy(desc(changeLog.createdAt)).limit(200),
    db.select().from(runLog).orderBy(desc(runLog.startedAt)).limit(30),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Audit</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Every rule change and every generation run. This is the record if a filing is ever
          questioned.
        </p>
      </div>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">
          Rule changes
        </h2>
        <table className="grid">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Table</th>
              <th>Action</th>
              <th>Effective from</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap">{c.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td>{c.actor}</td>
                <td>{c.tableName}</td>
                <td>{c.action}</td>
                <td>{c.effectiveFrom ?? "-"}</td>
                <td className="max-w-[560px] text-[11px] text-[var(--muted)]">
                  {summarize(c.before, c.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {changes.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[var(--muted)]">No rule changes yet.</div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">
          Generation runs
        </h2>
        <table className="grid">
          <thead>
            <tr>
              <th>Started</th>
              <th>Period</th>
              <th>Who</th>
              <th>Status</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const s = r.summary as { attempted?: number; succeeded?: number; failed?: unknown[] } | null;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{r.startedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td>{r.period}</td>
                  <td>{r.actor}</td>
                  <td>{r.status}</td>
                  <td className="text-[11px] text-[var(--muted)]">
                    {s ? `${s.succeeded ?? 0} of ${s.attempted ?? 0} generated${s.failed?.length ? `, ${s.failed.length} failed` : ""}` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {runs.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[var(--muted)]">No runs yet.</div>
        )}
      </section>
    </div>
  );
}
