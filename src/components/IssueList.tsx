import { groupIssues, shortLine, type Issue } from "@/lib/issues";

function Row({ issue }: { issue: Issue }) {
  return (
    <div className="issue">
      <span className="issue-dot" data-sev={issue.severity} />
      <div>
        <div className="issue-title">{issue.title}</div>
        <div className="issue-detail">{shortLine(issue)}</div>
      </div>
    </div>
  );
}

/**
 * Warnings live at the BOTTOM of a page and only the ones that change what you
 * do are shown. Anything true-but-irrelevant — over-collection, reminders — is
 * folded away behind a count, so the numbers get the top of the screen.
 */
export function IssueList({ warnings, title = "Things to check" }: { warnings: string[]; title?: string }) {
  const { blocking, notable, quiet, hiddenCount } = groupIssues(warnings);
  if (!blocking.length && !notable.length && !quiet.length) return null;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-head">
        {title}
        {blocking.length > 0 && (
          <span className="badge badge-overdue">{blocking.length} blocking</span>
        )}
        {notable.length > 0 && (
          <span className="badge badge-not_started">{notable.length} to review</span>
        )}
        {blocking.length === 0 && notable.length === 0 && (
          <span className="badge badge-filed">nothing blocking</span>
        )}
      </div>

      {blocking.map((i, n) => (
        <Row key={`b${n}`} issue={i} />
      ))}
      {notable.map((i, n) => (
        <Row key={`n${n}`} issue={i} />
      ))}

      {hiddenCount > 0 && (
        <details>
          <summary className="cursor-pointer border-t border-[var(--line)] px-4 py-3 text-[12px] font-semibold text-[var(--muted)] hover:bg-[#f8faf9]">
            {hiddenCount} more note{hiddenCount === 1 ? "" : "s"} — nothing you need to act on
          </summary>
          <div className="border-t border-[var(--line)]">
            {quiet.map((i, n) => (
              <Row key={`q${n}`} issue={i} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

/** A single line for a header: only speaks up when something is blocking. */
export function IssueBadge({ warnings }: { warnings: string[] }) {
  const { blocking, notable } = groupIssues(warnings);
  if (blocking.length) return <span className="badge badge-overdue">needs fixing</span>;
  if (notable.length) return <span className="badge badge-not_started">{notable.length} to review</span>;
  return <span className="badge badge-filed">clear</span>;
}
