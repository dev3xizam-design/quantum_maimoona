export type Frequency = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "NONE";

/** A monthly period key: YYYY-MM. Transactions are always stored monthly. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function quarterOf(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

/**
 * The filing-period label for a month under a given frequency.
 *   2026-07 + MONTHLY   -> 2026-07
 *   2026-07 + QUARTERLY -> 2026-Q3
 *   2026-07 + ANNUAL    -> 2026
 */
export function filingPeriod(month: string, freq: Frequency): string {
  const [y, m] = month.split("-").map(Number);
  if (freq === "QUARTERLY") return `${y}-Q${quarterOf(m)}`;
  if (freq === "ANNUAL") return `${y}`;
  return month;
}

/** The monthly keys covered by a filing period. */
export function monthsInPeriod(period: string): string[] {
  if (/^\d{4}$/.test(period)) {
    return Array.from({ length: 12 }, (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`);
  }
  const q = period.match(/^(\d{4})-Q([1-4])$/);
  if (q) {
    const start = (Number(q[2]) - 1) * 3 + 1;
    return [0, 1, 2].map((i) => `${q[1]}-${String(start + i).padStart(2, "0")}`);
  }
  return [period];
}

export function periodStart(period: string): Date {
  const months = monthsInPeriod(period);
  const [y, m] = months[0].split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function periodEnd(period: string): Date {
  const months = monthsInPeriod(period);
  const [y, m] = months[months.length - 1].split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this
}

/**
 * Due date = dueDay of the month AFTER the period ends. PACT is the 10th,
 * most sales tax the 20th, KS CT-9 the 25th - all driven by config.
 * dueDay 0 (or null) means "last day of the following month" (WY, NV, CA).
 */
export function dueDate(period: string, dueDay: number | null | undefined): Date {
  const end = periodEnd(period);
  const y = end.getUTCFullYear();
  const m = end.getUTCMonth() + 1;
  if (!dueDay || dueDay <= 0) return new Date(Date.UTC(y, m + 1, 0));
  const lastDayOfDueMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dueDay, lastDayOfDueMonth)));
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function periodLabel(period: string): string {
  if (/^\d{4}$/.test(period)) return `FY ${period}`;
  const q = period.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `Q${q[2]} ${q[1]}`;
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Is this filing period closed (i.e. fully in the past) as of `asOf`? */
export function periodIsClosed(period: string, asOf = new Date()): boolean {
  return periodEnd(period).getTime() < Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
}

export function recentMonths(count: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(monthKey(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1))));
  }
  return out;
}
