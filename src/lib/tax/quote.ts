/**
 * The checkout quote: sales tax by destination plus excise by product, for one
 * cart or order. Pure - every lookup arrives as an argument - so the same
 * function prices a live checkout, a commit, and a test.
 */

import type { ExciseConfigRow } from "../engine/excise";
import type { RateJurisdiction } from "@/db/schema";
import { exciseForLine, type ExciseLine } from "./excise-line";
import { resolveFacts, type KnownProduct, type StoreLine } from "./product-facts";

export type QuoteAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state: string;
  zip: string;
  country?: string | null;
};

export type PickedRate = {
  totalRate: number;
  countyName: string | null;
  cityName: string | null;
  jurisdictions: RateJurisdiction[];
  source: string;
  matchedBy: string;
};

export type SalesRegistration = {
  /** Registered to collect in this state at all. */
  registered: boolean;
  /** Fallback when the rate table has no row for the ZIP. */
  stateRate: number;
};

export type QuoteInput = {
  address: QuoteAddress;
  lines: StoreLine[];
  shipping: { id: string; amount: number }[];
};

export type QuoteDeps = {
  rate: PickedRate | null;
  sales: SalesRegistration;
  excise: ExciseConfigRow | null;
  shippingTaxable: boolean;
  known: Map<string, KnownProduct>;
  costEstimateRatio: number | null;
};

export type TaxPiece = RateJurisdiction & { amount: number };

export type QuoteLine = {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  /** What tax is charged on: price x qty less discount. */
  amount: number;
  sales: { rate: number; amount: number; jurisdictions: TaxPiece[] };
  excise: ExciseLine | null;
  facts: {
    mlPerUnit: number | null;
    costPerUnit: number | null;
    costIsEstimate: boolean;
    cartridgesPerUnit: number | null;
    systemType: string | null;
    containsNicotine: boolean;
    /** Quantum already has a product record for this line. */
    known: boolean;
    sources: Record<string, string>;
  };
};

export type Quote = {
  address: { state: string; zip: string; county: string | null; city: string | null; rateSource: string | null; matchedBy: string | null };
  lines: QuoteLine[];
  shipping: { id: string; amount: number; taxable: boolean; rate: number; tax: number; jurisdictions: TaxPiece[] }[];
  totals: { salesTax: number; exciseTax: number; totalTax: number };
  warnings: string[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Codes are compared without spaces/dashes, upper-case (same as the Medusa matcher). */
export const codeKey = (v: string | null | undefined) =>
  v ? String(v).trim().toUpperCase().replace(/[\s-]/g, "") || null : null;

/**
 * The jurisdictions that apply. Deliberately ignores state_tax_config.has_local:
 * that flag describes the RETURN's layout (IL, VA and WV file flat forms) and
 * not whether local tax is owed - Chicago, Northern Virginia and WV cities all
 * have it. The destination rate table is the authority at checkout.
 */
export function applicableJurisdictions(rate: PickedRate | null, sales: SalesRegistration, state: string): RateJurisdiction[] {
  if (!sales.registered) return [];
  if (rate) return rate.jurisdictions.filter((j) => j.rate !== 0 || j.type === "State");
  return [{ type: "State", name: state, code: null, rate: sales.stateRate }];
}

function pieces(jurisdictions: RateJurisdiction[], base: number): TaxPiece[] {
  return jurisdictions.map((j) => ({ ...j, amount: base * j.rate }));
}

export function computeQuote(input: QuoteInput, deps: QuoteDeps): Quote {
  const state = input.address.state.toUpperCase();
  const warnings: string[] = [];
  const jurisdictions = applicableJurisdictions(deps.rate, deps.sales, state);
  const combined = jurisdictions.reduce((s, j) => s + j.rate, 0);

  if (deps.sales.registered && !deps.rate) {
    warnings.push(
      `No local rate on file for ${state} ${input.address.zip} - charged the ${state} state rate only. Local tax is under-collected until the rate table covers this ZIP.`,
    );
  }

  const lines: QuoteLine[] = input.lines.map((line) => {
    const known =
      deps.known.get(`variant:${line.variantId}`) ??
      deps.known.get(codeKey(line.barcode) ?? "\u0000") ??
      deps.known.get(codeKey(line.sku) ?? "\u0000") ??
      null;
    const facts = resolveFacts(line, known, { costEstimateRatio: deps.costEstimateRatio });
    const amount = Math.max(0, facts.unitPrice * facts.quantity);
    const salesPieces = facts.isNonProduct ? [] : pieces(jurisdictions, amount);
    const salesAmount = salesPieces.reduce((s, p) => s + p.amount, 0);
    const excise = exciseForLine(deps.excise, facts);
    if (excise?.estimated) warnings.push(`${facts.description}: ${excise.notes.join("; ")}`);

    return {
      id: line.id,
      itemCode:
        facts.sku ??
        ((line.barcode || line.sku)?.trim().toUpperCase() || null) ??
        `MEDUSA:${line.variantId ?? line.id}`,
      description: facts.description,
      quantity: facts.quantity,
      amount: r2(amount),
      sales: { rate: facts.isNonProduct ? 0 : combined, amount: r2(salesAmount), jurisdictions: salesPieces },
      excise,
      facts: {
        mlPerUnit: facts.mlPerUnit,
        costPerUnit: facts.costPerUnit,
        costIsEstimate: facts.costIsEstimate,
        cartridgesPerUnit: facts.cartridgesPerUnit,
        systemType: facts.systemType,
        containsNicotine: facts.containsNicotine,
        known: known !== null,
        sources: facts.sources,
      },
    };
  });

  const shipping = input.shipping.map((s) => {
    const taxable = deps.shippingTaxable && deps.sales.registered;
    const js = taxable ? pieces(jurisdictions, s.amount) : [];
    return {
      id: s.id,
      amount: r2(s.amount),
      taxable,
      rate: taxable ? combined : 0,
      tax: r2(js.reduce((sum, p) => sum + p.amount, 0)),
      jurisdictions: js,
    };
  });

  const salesTax = r2(lines.reduce((s, l) => s + l.sales.amount, 0) + shipping.reduce((s, l) => s + l.tax, 0));
  const exciseTax = r2(lines.reduce((s, l) => s + (l.excise?.amount ?? 0), 0));

  return {
    address: {
      state,
      zip: input.address.zip,
      county: deps.rate?.countyName ?? null,
      city: deps.rate?.cityName ?? input.address.city ?? null,
      rateSource: deps.rate?.source ?? null,
      matchedBy: deps.rate?.matchedBy ?? null,
    },
    lines,
    shipping,
    totals: { salesTax, exciseTax, totalTax: r2(salesTax + exciseTax) },
    warnings: [...new Set(warnings)],
  };
}
