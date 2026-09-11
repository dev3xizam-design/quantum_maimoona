import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  exciseConfig,
  filings,
  jurisdictionCodes,
  products,
  purchases,
  shipments,
  stateTaxConfig,
  transactions,
} from "@/db/schema";
import { num, round2 } from "./money";
import { normalizeRate } from "./ingest/avalara";
import { filingPeriod, isoDate, monthsInPeriod, periodStart, type Frequency } from "./periods";
import { computeSales, type JurisdictionCode, type SalesConfig } from "./engine/sales";
import { computeExcise, type ExciseConfigRow, type ProductRow } from "./engine/excise";
import { computePact } from "./engine/pact";
import type { ExciseResult, PactResult, SalesResult, TxRow } from "./engine/types";
import { persistFiling } from "./compute";

/**
 * Computes every return for a calendar month in ONE pass.
 *
 * Doing this state-by-state means ~150 round trips (51 states x 3 tax types);
 * this loads the transactions, the config and the product master once and runs
 * the engines in memory, which is what makes "do the whole month" finish inside
 * a serverless invocation.
 */

export type StateBundle = {
  state: string;
  sales: SalesResult | null;
  excise: ExciseResult | null;
  pact: PactResult | null;
  salesPeriod: string | null;
  excisePeriod: string | null;
  pactPeriod: string | null;
  account: { accountNumber: string | null; licenseNumber: string | null } | null;
  exciseAccount: { accountNumber: string | null; licenseNumber: string | null } | null;
  hasActivity: boolean;
  errors: string[];
};

export type PeriodComputation = {
  month: string;
  bundles: StateBundle[];
  totals: {
    states: number;
    statesWithActivity: number;
    gross: number;
    taxable: number;
    salesTax: number;
    exciseTax: number;
    totalTax: number;
    collected: number;
    delta: number;
    pactShipments: number;
    warnings: number;
    reconcileFailures: string[];
  };
};

/**
 * Effective-dated resolution done in memory over one snapshot of the rules.
 *
 * `state_tax_config` holds sales AND pact rows in the same table, so the
 * taxType filter is not optional: without it a state's PACT row can win the
 * sort and the sales return silently never computes.
 */
function resolver<T extends { state: string; effectiveFrom: string; effectiveTo: string | null }>(
  rows: T[],
  where: (row: T) => boolean = () => true,
) {
  const pool = rows.filter(where);
  return (state: string, period: string): T | null => {
    const at = isoDate(periodStart(period));
    const candidates = pool
      .filter(
        (r) =>
          r.state === state &&
          r.effectiveFrom <= at &&
          (r.effectiveTo === null || r.effectiveTo >= at),
      )
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return candidates[0] ?? null;
  };
}

export async function computePeriodEverything(
  month: string,
  opts: { persist?: boolean } = {},
): Promise<PeriodComputation> {
  const [salesCfgRows, exciseCfgRows, codeRows, accountRows, productRows] = await Promise.all([
    db.select().from(stateTaxConfig).where(eq(stateTaxConfig.active, true)),
    db.select().from(exciseConfig).where(eq(exciseConfig.active, true)),
    db.select().from(jurisdictionCodes),
    db.select().from(accounts),
    db.select().from(products),
  ]);

  const resolveSales = resolver(salesCfgRows, (r) => r.taxType === "sales");
  const resolvePact = resolver(salesCfgRows, (r) => r.taxType === "pact");
  const resolveExcise = resolver(exciseCfgRows);

  /* Which filing period does this month roll into, per state per tax type? */
  const states = [...new Set([...salesCfgRows, ...exciseCfgRows].map((r) => r.state))].sort();
  const periodFor = new Map<string, string>();
  const neededMonths = new Set<string>([month]);

  for (const state of states) {
    const sales = resolveSales(state, month);
    if (sales && sales.frequency !== "NONE") {
      const p = filingPeriod(month, sales.frequency as Frequency);
      periodFor.set(`${state}|sales`, p);
      monthsInPeriod(p).forEach((m) => neededMonths.add(m));
    }
    if (resolvePact(state, month)) periodFor.set(`${state}|pact`, month);
    const ex = resolveExcise(state, month);
    if (ex) {
      const p = filingPeriod(month, ex.frequency as Frequency);
      periodFor.set(`${state}|excise`, p);
      monthsInPeriod(p).forEach((m) => neededMonths.add(m));
    }
  }

  const months = [...neededMonths];
  const [txRows, purchaseRows, shipmentRows] = await Promise.all([
    db.select().from(transactions).where(inArray(transactions.period, months)),
    db.select().from(purchases).where(inArray(purchases.period, months)),
    db.select().from(shipments).where(inArray(shipments.period, months)),
  ]);

  /* Bucket everything by state + month so each engine gets exactly its slice. */
  const txByState = new Map<string, TxRow[]>();
  for (const r of txRows) {
    const key = `${r.state}|${r.period}`;
    const row: TxRow = {
      documentId: r.documentId,
      lineNo: r.lineNo,
      ref1: r.ref1,
      itemCode: r.itemCode,
      itemDescription: r.itemDescription,
      docType: r.docType,
      documentDate: r.documentDate,
      period: r.period,
      state: r.state,
      destCounty: r.destCounty,
      destCity: r.destCity,
      destZip: r.destZip,
      jurisdictionType: r.jurisdictionType,
      jurisdictionDescription: r.jurisdictionDescription,
      rate: normalizeRate(num(r.rate), num(r.taxableAmount), num(r.taxAmount)),
      lineAmount: num(r.lineAmount),
      discountAmount: num(r.discountAmount),
      taxableAmount: num(r.taxableAmount),
      exemptAmount: num(r.exemptAmount),
      taxAmount: num(r.taxAmount),
      quantity: num(r.quantity),
    };
    const list = txByState.get(key) ?? [];
    list.push(row);
    txByState.set(key, list);
  }
  const txFor = (state: string, period: string): TxRow[] =>
    monthsInPeriod(period).flatMap((m) => txByState.get(`${state}|${m}`) ?? []);

  const prods: ProductRow[] = productRows.map((p) => ({
    sku: p.sku,
    description: p.description,
    wholesaleCost: p.wholesaleCost === null ? null : num(p.wholesaleCost),
    retailPrice: p.retailPrice === null ? null : num(p.retailPrice),
    liquidMl: p.liquidMl === null ? null : num(p.liquidMl),
    cartridgesPerUnit: p.cartridgesPerUnit === null ? null : num(p.cartridgesPerUnit),
    systemType: p.systemType,
    containsNicotine: p.containsNicotine,
  }));
  const productMlMap = new Map(prods.map((p) => [p.sku.trim().toUpperCase(), { liquidMl: p.liquidMl }]));

  const accountFor = (state: string, taxType: string) => {
    const a = accountRows.find((r) => r.state === state && r.taxType === taxType);
    return a ? { accountNumber: a.accountNumber, licenseNumber: a.licenseNumber } : null;
  };

  const bundles: StateBundle[] = [];

  for (const state of states) {
    const errors: string[] = [];
    let sales: SalesResult | null = null;
    let excise: ExciseResult | null = null;
    let pact: PactResult | null = null;

    const salesPeriod = periodFor.get(`${state}|sales`) ?? null;
    const excisePeriod = periodFor.get(`${state}|excise`) ?? null;
    const pactPeriod = periodFor.get(`${state}|pact`) ?? null;

    const rowsThisMonth = txByState.get(`${state}|${month}`) ?? [];
    const hasActivity = rowsThisMonth.length > 0;

    if (salesPeriod) {
      const cfgRow = resolveSales(state, salesPeriod);
      if (cfgRow) {
        const config: SalesConfig = {
          state: cfgRow.state,
          frequency: cfgRow.frequency,
          stateRate: num(cfgRow.stateRate),
          hasLocal: cfgRow.hasLocal,
          allocation: cfgRow.allocation,
          rounding: cfgRow.rounding,
          portal: cfgRow.portal,
          formName: cfgRow.formName,
          dueDay: cfgRow.dueDay,
        };
        const at = isoDate(periodStart(salesPeriod));
        const codes: JurisdictionCode[] = codeRows
          .filter(
            (c) => c.state === state && c.effectiveFrom <= at && (c.effectiveTo === null || c.effectiveTo >= at),
          )
          .map((c) => ({
            jurisdictionName: c.jurisdictionName,
            jurisdictionType: c.jurisdictionType,
            officialCode: c.officialCode,
            pairedCode: c.pairedCode,
            pairedName: c.pairedName,
            rate: c.rate === null ? null : num(c.rate),
            rateIncludesState: c.rateIncludesState,
            avalaraAlias: c.avalaraAlias,
          }));
        try {
          sales = computeSales(txFor(state, salesPeriod), { config, codes, period: salesPeriod });
        } catch (e) {
          errors.push(`sales: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    if (excisePeriod) {
      const e = resolveExcise(state, excisePeriod);
      if (e) {
        const config: ExciseConfigRow = {
          state: e.state,
          structure: e.structure,
          basis: (e.basis as "SALES" | "RECEIPTS") ?? "SALES",
          rate: num(e.rate),
          rateUnit: e.rateUnit,
          openRate: e.openRate === null ? null : num(e.openRate),
          openRateUnit: e.openRateUnit,
          closedRate: e.closedRate === null ? null : num(e.closedRate),
          closedRateUnit: e.closedRateUnit,
          frequency: e.frequency,
          portal: e.portal,
          formName: e.formName,
          dueDay: e.dueDay,
          notes: e.notes,
        };
        const exMonths = monthsInPeriod(excisePeriod);
        try {
          excise = computeExcise({
            config,
            period: excisePeriod,
            rows: config.basis === "SALES" ? txFor(state, excisePeriod) : [],
            products: prods,
            purchases: purchaseRows
              .filter((p) => p.state === state && exMonths.includes(p.period))
              .map((p) => ({
                sku: p.sku,
                description: p.description,
                quantity: num(p.quantity),
                mlTotal: num(p.mlTotal),
                unitsTotal: num(p.unitsTotal),
                wholesaleCost: num(p.wholesaleCost),
              })),
          });
        } catch (err) {
          errors.push(`excise: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (pactPeriod) {
      const cfg = resolvePact(state, pactPeriod);
      try {
        pact = computePact({
          state,
          period: pactPeriod,
          rows: txFor(state, pactPeriod),
          shipments: shipmentRows
            .filter((sh) => sh.state === state && sh.period === pactPeriod)
            .map((sh) => ({
              customerName: sh.customerName,
              shipToAddress: sh.shipToAddress,
              shipToCity: sh.shipToCity,
              shipToState: sh.shipToState,
              shipToZip: sh.shipToZip,
              invoiceDate: sh.invoiceDate,
              invoiceNumber: sh.invoiceNumber,
              product: sh.product,
              brand: sh.brand,
              quantity: num(sh.quantity),
              mlTotal: num(sh.mlTotal),
            })),
          products: productMlMap,
          portal: cfg?.portal ?? null,
          formName: cfg?.formName ?? "PACT Act ENDS report",
          dueDay: cfg?.dueDay ?? 10,
        });
      } catch (e) {
        errors.push(`pact: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    bundles.push({
      state,
      sales,
      excise,
      pact,
      salesPeriod,
      excisePeriod,
      pactPeriod,
      account: accountFor(state, "sales"),
      exciseAccount: accountFor(state, "excise"),
      hasActivity,
      errors,
    });
  }

  if (opts.persist) {
    for (const b of bundles) {
      if (!b.hasActivity) continue;
      if (b.sales && b.salesPeriod) await persistFiling(b.state, "sales", b.salesPeriod, b.sales);
      if (b.excise && b.excisePeriod) await persistFiling(b.state, "excise", b.excisePeriod, b.excise);
      if (b.pact && b.pactPeriod && b.pact.shipmentCount > 0) {
        await persistFiling(b.state, "pact", b.pactPeriod, b.pact);
      }
    }
  }

  const active = bundles.filter((b) => b.hasActivity);
  const totals = {
    states: bundles.length,
    statesWithActivity: active.length,
    gross: round2(active.reduce((s, b) => s + (b.sales?.gross ?? 0), 0)),
    taxable: round2(active.reduce((s, b) => s + (b.sales?.taxable ?? 0), 0)),
    salesTax: round2(active.reduce((s, b) => s + (b.sales?.taxComputed ?? 0), 0)),
    exciseTax: round2(active.reduce((s, b) => s + (b.excise?.taxComputed ?? 0), 0)),
    totalTax: 0,
    collected: round2(active.reduce((s, b) => s + (b.sales?.taxCollected ?? 0), 0)),
    delta: round2(active.reduce((s, b) => s + (b.sales?.delta ?? 0), 0)),
    pactShipments: active.reduce((s, b) => s + (b.pact?.shipmentCount ?? 0), 0),
    warnings: active.reduce(
      (s, b) =>
        s +
        (b.sales?.warnings.length ?? 0) +
        (b.excise?.warnings.length ?? 0) +
        (b.pact?.warnings.length ?? 0),
      0,
    ),
    reconcileFailures: active.filter((b) => b.sales && !b.sales.reconciles).map((b) => b.state),
  };
  totals.totalTax = round2(totals.salesTax + totals.exciseTax);

  return { month, bundles, totals };
}

export async function getPeriodFilings(month: string) {
  const periods = [...new Set([month, filingPeriod(month, "QUARTERLY"), filingPeriod(month, "ANNUAL")])];
  return db.select().from(filings).where(inArray(filings.period, periods));
}

export async function markPeriodFiled(state: string, taxType: string, period: string) {
  return db
    .select()
    .from(filings)
    .where(and(eq(filings.state, state), eq(filings.taxType, taxType), eq(filings.period, period)));
}
