"use client";

import { useState } from "react";

export type ChangeRow = {
  id: number;
  when: string;
  actor: string | null;
  tableName: string;
  action: string;
  effectiveFrom: string | null;
  summary: string;
};

export type RunRow = {
  id: number;
  when: string;
  period: string;
  actor: string | null;
  status: string;
  summary: string;
};

export function AuditView({ changes, runs }: { changes: ChangeRow[]; runs: RunRow[] }) {
  const [tab, setTab] = useState<"changes" | "runs">("changes");

  return (
    <div className="space-y-4">
      <div className="pagehead">
        <div className="pagehead-row">
          <div>
            <h1 className="page-title">Audit</h1>
            <p className="page-sub mt-0.5">
              Every rule change and every generation run. This is the record if a filing is ever
              questioned — nothing here can be edited.
            </p>
          </div>
        </div>
        <nav className="tabs">
          <button className="tab" data-active={tab === "changes"} onClick={() => setTab("changes")}>
            Rule changes<span className="tab-count">{changes.length}</span>
          </button>
          <button className="tab" data-active={tab === "runs"} onClick={() => setTab("runs")}>
            Generation runs<span className="tab-count">{runs.length}</span>
          </button>
        </nav>
      </div>

      {tab === "changes" ? (
        <div className="panel overflow-hidden">
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
                  <td className="whitespace-nowrap text-[12px]">{c.when}</td>
                  <td className="text-[12px]">{c.actor}</td>
                  <td className="text-[12px]">{c.tableName}</td>
                  <td>
                    <span className="badge badge-no_activity">{c.action}</span>
                  </td>
                  <td className="whitespace-nowrap text-[12px]">{c.effectiveFrom ?? "—"}</td>
                  <td className="max-w-[560px] text-[11.5px] text-[var(--muted)]">{c.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {changes.length === 0 && (
            <div className="empty">
              <strong>No rule changes yet.</strong>
              <span>Edits made in Config will appear here with who, when and effective from.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="grid">
            <thead>
              <tr>
                <th>Started</th>
                <th>Period</th>
                <th>Who</th>
                <th>Status</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-[12px]">{r.when}</td>
                  <td className="text-[12px] font-semibold">{r.period}</td>
                  <td className="text-[12px]">{r.actor}</td>
                  <td>
                    <span
                      className={`badge ${r.status === "complete" ? "badge-filed" : "badge-not_started"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-[11.5px] text-[var(--muted)]">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 && (
            <div className="empty">
              <strong>No runs yet.</strong>
              <span>Use Close month, or Run this period on the calendar.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
