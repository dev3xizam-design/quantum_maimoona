/**
 * All money math lives here. Round half-up at the cent, exactly the way the
 * state forms do - never rely on JS banker's rounding or raw float sums.
 */

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + Number.EPSILON)) / 100;
}

export function roundWholeDollar(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(n) + Number.EPSILON);
}

export function applyRounding(n: number, mode: string | null | undefined): number {
  return mode === "whole_dollar" ? roundWholeDollar(n) : round2(n);
}

/** Drizzle returns `numeric` columns as strings. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function fmtPct(rate: number): string {
  return `${round2(rate * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** 1 cent tolerance for the Taxable + Exempt = Gross invariant. */
export const TOLERANCE = 0.011;
