import { round2 } from "@/lib/money";
import { rateUnitLabel } from "@/lib/engine/excise";
import type { ExciseResult } from "@/lib/engine/types";
import type { ExciseFormSpec, FormCtx, ReturnLine } from "./types";

const S = (label: string): ReturnLine => ({ kind: "section", label });
const B = (): ReturnLine => ({ kind: "blank" });
const L = (
  line: string | undefined,
  label: string,
  value: number | string | null,
  opts: Partial<Extract<ReturnLine, { kind: "line" }>> = {},
): ReturnLine => ({ kind: "line", line, label, value, format: "money", ...opts });

const lic = (ctx: FormCtx) => ctx.licenseNumber ?? ctx.accountNumber ?? "(add in Config > Accounts)";

/** Kansas EC-2 is the receipts-basis one: Line 1a is mL PURCHASED, not sold. */
const KS: ExciseFormSpec = {
  id: "KS_excise_EC2",
  title: "Kansas EC-2 - Consumable Materials Monthly Report",
  lines: (r) => [
    S("Part 1 - Consumable material received"),
    L("1a", "Number of mL PURCHASED during the month", r.totalMl, {
      format: "qty",
      highlight: true,
      note: "PURCHASED, not sold. This is a receipts-basis return - it comes from the purchase import.",
    }),
    L("1b", "Number of mL manufactured during the month", 0, { format: "qty" }),
    L("2", "Total mL (1a + 1b)", r.totalMl, { format: "qty" }),
    B(),
    S("Part 2 - Tax"),
    L("3", "Taxable mL", r.totalMl, { format: "qty", highlight: true }),
    L("4", "Tax due (Line 3 x $0.05)", round2(r.taxComputed), { highlight: true }),
    B(),
    S("Not your returns"),
    L(undefined, "CG-32 / TB-32 / EC-32", "Manufacturer sample returns - ignore these", { format: "text" }),
  ],
  steps: (r, ctx) => [
    "Log in at the Kansas Customer Service Center (ksrevenue.gov) - SAME login as sales tax, but the Cigarette & Tobacco Tax account.",
    `Reach the form via Your License List > View ${lic(ctx)} > the EC-2 link.`,
    `Line 1a = ${r.totalMl.toLocaleString()} mL PURCHASED during the month (NOT sold). Line 1b manufactured = 0.`,
    `Tax = total mL x $0.05 = ${round2(r.taxComputed).toLocaleString()}.`,
    "Payment is ACH CREDIT - you push it from the bank. There is no card option.",
    "Ignore CG-32, TB-32 and EC-32 - those are manufacturer sample returns.",
    "Kansas SALES tax is separate and became ANNUAL as of 1/1/2026 - do not file it monthly.",
  ],
};

function genericLines(r: ExciseResult): ReturnLine[] {
  const lines: ReturnLine[] = [S(`Basis - ${r.basis === "RECEIPTS" ? "product PURCHASED this period" : "product SOLD this period"}`)];
  lines.push(L(undefined, "Total mL", r.totalMl, { format: "qty" }));
  lines.push(L(undefined, "Total units", r.totalUnits, { format: "qty" }));
  lines.push(L(undefined, "Total cartridges", r.totalCartridges, { format: "qty" }));
  lines.push(L(undefined, "Total wholesale cost", r.wholesaleCost));
  lines.push(L(undefined, "Total retail price", r.retailPrice));
  lines.push(B());
  lines.push(S(`Structure ${r.structure} calculation`));
  for (const c of r.components) {
    if (c.rate === 0 && c.basisAmount === 0) continue;
    lines.push(L(undefined, `${c.label} - ${c.basisLabel}`, c.basisAmount, {
      format: c.rateUnit.startsWith("pct") ? "money" : "qty",
    }));
    lines.push(L(undefined, `${c.label} - rate`, c.rate, {
      format: c.rateUnit.startsWith("pct") ? "pct" : "money",
      note: rateUnitLabel(c.rateUnit),
    }));
    lines.push(L(undefined, `${c.label} - tax`, c.tax, { highlight: true }));
    lines.push(B());
  }
  lines.push(S("Total"));
  lines.push(L(undefined, "Total excise tax due", round2(r.taxComputed), { highlight: true }));
  return lines;
}

const GENERIC: ExciseFormSpec = {
  id: "generic_excise",
  title: "Vapor / Nicotine Products Excise Return",
  lines: genericLines,
  steps: (r, ctx) => [
    `Log in at ${r.portal ?? "the state tobacco/vapor portal"} - this is usually a DIFFERENT account from sales tax.`,
    `License ${lic(ctx)}. Form: ${r.form ?? "the vapor/tobacco products return"}.`,
    r.basis === "RECEIPTS"
      ? "RECEIPTS basis: report what you PURCHASED into inventory this period, not what you sold."
      : "SALES basis: report what you sold this period.",
    ...r.components
      .filter((c) => c.tax !== 0 || c.basisAmount !== 0)
      .map(
        (c) =>
          `${c.label}: ${c.basisLabel} ${c.basisAmount.toLocaleString()} x ${rateUnitLabel(c.rateUnit)} ${c.rate} = ${round2(c.tax).toLocaleString()}.`,
      ),
    `Total excise due ${round2(r.taxComputed).toLocaleString()}.`,
    "Confirm the basis against a prior filed return before submitting - some states switched basis mid-year.",
  ],
};

export const EXCISE_FORMS: Record<string, ExciseFormSpec> = { KS };

export function exciseFormFor(state: string): ExciseFormSpec {
  return EXCISE_FORMS[state] ?? GENERIC;
}
