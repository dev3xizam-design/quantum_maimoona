const LABEL: Record<string, string> = {
  overdue: "Overdue",
  ready: "Ready",
  filed: "Filed",
  not_started: "Not started",
  no_activity: "No activity",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{LABEL[status] ?? status}</span>;
}
