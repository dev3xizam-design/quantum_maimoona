/**
 * Not every warning deserves the top of the page.
 *
 * The engines report everything they notice, which is right — but a screen that
 * opens with five red boxes buries the one thing that actually stops you
 * filing. Issues are sorted into three buckets:
 *
 *   blocking  — the return is wrong or unfileable until this is fixed
 *   worth-knowing — it changes a number you should see before you file
 *   quiet     — true, logged, and not worth your attention (over-collection,
 *               reminders, coverage notes)
 *
 * Quiet issues are never shown unless you go looking for them.
 */

export type Severity = "blocking" | "notable" | "quiet";

export type Issue = {
  severity: Severity;
  title: string;
  detail: string;
};

const RULES: { match: RegExp; severity: Severity; title: string }[] = [
  // Wrong numbers. Do not file.
  { match: /RECONCILIATION FAILED/i, severity: "blocking", title: "Figures do not reconcile" },
  { match: /Taxable \+ Exempt/i, severity: "blocking", title: "Figures do not reconcile" },

  // Real money, quietly missing from the return.
  { match: /UNDER-COLLECTION/i, severity: "notable", title: "Under-collected" },
  { match: /WHOLESALE COST MISSING/i, severity: "notable", title: "Excise understated — no cost" },
  { match: /mL MISSING/i, severity: "notable", title: "Excise understated — no volume" },
  { match: /OPEN\/CLOSED NOT SET/i, severity: "notable", title: "Open/closed not set" },
  { match: /No purchase rows loaded/i, severity: "notable", title: "No purchase data" },
  { match: /jurisdiction\(s\) have no official filing code/i, severity: "notable", title: "Missing filing codes" },

  // True, but not a call to action.
  { match: /OVER-COLLECTION/i, severity: "quiet", title: "Over-collected" },
  { match: /customer names/i, severity: "quiet", title: "PACT needs the order feed" },
  { match: /not yet in the product master/i, severity: "quiet", title: "New SKUs" },
  { match: /SKU\(s\) are not in the product master/i, severity: "quiet", title: "New SKUs" },
  { match: /Wholesale cost basis is zero/i, severity: "quiet", title: "No cost loaded" },
  { match: /mL basis is zero/i, severity: "quiet", title: "No volume loaded" },
];

export function classifyIssue(text: string): Issue {
  for (const rule of RULES) {
    if (rule.match.test(text)) {
      return { severity: rule.severity, title: rule.title, detail: text };
    }
  }
  // Unrecognised warnings are worth a look, but never blocking.
  return { severity: "notable", title: "Check this", detail: text };
}

export function classifyAll(warnings: string[]): Issue[] {
  return warnings.map(classifyIssue);
}

export type IssueGroups = {
  blocking: Issue[];
  notable: Issue[];
  quiet: Issue[];
  /** What the page should actually surface. */
  visible: Issue[];
  hiddenCount: number;
};

export function groupIssues(warnings: string[]): IssueGroups {
  const all = classifyAll(warnings);
  const blocking = all.filter((i) => i.severity === "blocking");
  const notable = all.filter((i) => i.severity === "notable");
  const quiet = all.filter((i) => i.severity === "quiet");
  return {
    blocking,
    notable,
    quiet,
    visible: [...blocking, ...notable],
    hiddenCount: quiet.length,
  };
}

/** One line for a list row, rather than a paragraph in a red box. */
export function shortLine(issue: Issue): string {
  const first = issue.detail.split(/(?<=\.)\s/)[0] ?? issue.detail;
  return first.length > 150 ? `${first.slice(0, 147)}…` : first;
}
