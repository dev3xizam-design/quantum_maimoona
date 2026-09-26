/**
 * How often an account has to be filed, read out of whatever the tracker's
 * frequency cell happens to say. That column is free text written by hand
 * over several years: "M", "Q", "A", "M - Blocked State", "Q-06/30/22 not
 * filed", "Annual Report FTB", "Sales-A/PactAct-M", "No Sales tax req'd".
 *
 * An account can land in more than one bucket, and that is not a bug -
 * "Sales-A/PactAct-M" means the sales return is annual while the PACT report
 * is monthly, which is the single most expensive thing to get wrong (doc 03:
 * frequency is per state PER TAX TYPE).
 */
export type Freq = "monthly" | "quarterly" | "annual";

export const FREQ_LABEL: Record<Freq, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

/**
 * A lone letter only counts on a word boundary, so "Annual" is not read as a
 * stray "A" and "Marlow" is not read as a stray "M".
 */
const PATTERNS: [Freq, RegExp][] = [
  ["monthly", /\bm\b|monthly/i],
  ["quarterly", /\bq\b|quarter/i],
  ["annual", /\ba\b|annual|yearly/i],
];

export function parseFrequency(raw: string | null | undefined): Freq[] {
  if (!raw) return [];
  return PATTERNS.filter(([, re]) => re.test(raw)).map(([f]) => f);
}

/** MONTHLY / QUARTERLY / ANNUAL as the config tables store it. */
export function fromConfigValue(value: string | null | undefined): Freq | null {
  switch ((value ?? "").toUpperCase()) {
    case "MONTHLY":
      return "monthly";
    case "QUARTERLY":
      return "quarterly";
    case "ANNUAL":
      return "annual";
    default:
      return null;
  }
}

export function sortFreqs(freqs: Freq[]): Freq[] {
  const order: Freq[] = ["monthly", "quarterly", "annual"];
  return order.filter((f) => freqs.includes(f));
}
