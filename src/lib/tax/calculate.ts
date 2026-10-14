import "server-only";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import { medusaProducts, products, taxRateAreas, taxRatePlus4, taxRates, taxSettings } from "@/db/schema";
import { num } from "../money";
import { resolveExciseConfig, resolveStateConfig } from "../config";
import { normalizeState, STATE_NAMES } from "../states";
import { normalizeCity, pickRate } from "./rate-lookup";
import { memo, MINUTE, refresh } from "./memo";
import { shippingTaxable } from "./shipping-taxability";
import type { KnownProduct } from "./product-facts";
import { codeKey, computeQuote, type PickedRate, type QuoteInput } from "./quote";

/** Share of list price used as wholesale cost when Quantum has no cost. */
export const DEFAULT_COST_ESTIMATE_RATIO = 0.5;

export async function getTaxSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(taxSettings).where(eq(taxSettings.key, key)).limit(1);
  return row?.value === undefined || row?.value === null ? fallback : (row.value as T);
}

export async function setTaxSetting(key: string, value: unknown, actor: string) {
  await db
    .insert(taxSettings)
    .values({ key, value, updatedBy: actor, updatedAt: new Date() })
    .onConflictDoUpdate({ target: taxSettings.key, set: { value, updatedBy: actor, updatedAt: new Date() } });
}

const today = () => new Date().toISOString().slice(0, 10);

type RateRow = typeof taxRates.$inferSelect;
const live = (on: string) => (r: { effectiveFrom: string; effectiveTo: string | null }) =>
  r.effectiveFrom <= on && (!r.effectiveTo || r.effectiveTo >= on);

/** The ZIP+4 ranges of this ZIP that contain zip4, as rate rows (see tax_rate_plus4). */
async function plus4Rows(state: string, zip5: string, zip4: string, on: string): Promise<RateRow[]> {
  const [packed] = await db
    .select()
    .from(taxRatePlus4)
    .where(and(eq(taxRatePlus4.state, state), eq(taxRatePlus4.zip5, zip5)))
    .limit(1);
  if (!packed) return [];
  const z = Number(zip4);
  const hits: { low: number; high: number; area: number }[] = [];
  for (let i = 0; i + 2 < packed.ranges.length; i += 3) {
    if (z >= packed.ranges[i] && z <= packed.ranges[i + 1]) hits.push({ low: packed.ranges[i], high: packed.ranges[i + 1], area: packed.ranges[i + 2] });
  }
  if (!hits.length) return [];
  const areas = await db.select().from(taxRateAreas).where(inArray(taxRateAreas.id, [...new Set(hits.map((h) => h.area))]));
  const byId = new Map(areas.filter(live(on)).map((a) => [a.id, a]));
  return hits.flatMap((h) => {
    const a = byId.get(h.area);
    if (!a) return [];
    const { id: _id, ...rest } = a;
    return [{ ...rest, id: 0, zip5, plus4Low: String(h.low).padStart(4, "0"), plus4High: String(h.high).padStart(4, "0"), isPrimary: false, loadedAt: new Date(0) }];
  });
}

/**
 * A ZIP with no rows of its own (PO-box-only ZIPs and ZIPs created after the
 * 2020 Census have no Census area): use the numerically nearest ZIP in the same
 * ZIP3 area of the same state, preferring one whose city matches the address.
 * Reported as matchedBy "nearby-zip" so it is visible on the quote.
 */
async function nearbyZipRow(state: string, zip5: string, city: string | null, on: string): Promise<RateRow | null> {
  const rows = (
    await db
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.state, state), like(taxRates.zip5, `${zip5.slice(0, 3)}%`)))
  ).filter(live(on));
  if (!rows.length) return null;
  const want = normalizeCity(city);
  const pool = (want && rows.filter((r) => r.cityName && normalizeCity(r.cityName) === want).length
    ? rows.filter((r) => r.cityName && normalizeCity(r.cityName) === want)
    : rows.filter((r) => r.isPrimary)) as RateRow[];
  const dist = (r: RateRow) => Math.abs(Number(r.zip5) - Number(zip5));
  return [...(pool.length ? pool : rows)].sort((a, b) => dist(a) - dist(b) || Number(b.isPrimary) - Number(a.isPrimary))[0] ?? null;
}

export async function lookupRate(
  state: string,
  zip: string,
  city: string | null | undefined,
  on: string = today(),
): Promise<PickedRate | null> {
  const zip5 = zip.replace(/[^0-9]/g, "").slice(0, 5);
  const zip4 = zip.replace(/[^0-9]/g, "").slice(5, 9) || null;
  if (zip5.length !== 5) return null;
  const rows: RateRow[] = (await db.select().from(taxRates).where(and(eq(taxRates.state, state), eq(taxRates.zip5, zip5)))).filter(live(on));
  if (zip4?.length === 4) rows.push(...(await plus4Rows(state, zip5, zip4, on)));

  let r: RateRow;
  let matchedBy: string;
  if (rows.length) {
    const picked = pickRate(
      rows.map((x) => ({
        zip5: x.zip5,
        plus4Low: x.plus4Low,
        plus4High: x.plus4High,
        cityName: x.cityName,
        countyName: x.countyName,
        isPrimary: x.isPrimary,
        row: x,
      })),
      { city: city ?? null, zip4 },
    );
    if (!picked) return null;
    r = picked.row.row;
    matchedBy = picked.matchedBy;
  } else {
    const near = await nearbyZipRow(state, zip5, city ?? null, on);
    if (!near) return null;
    r = near;
    matchedBy = "nearby-zip";
  }
  return {
    totalRate: num(r.totalRate),
    countyName: r.countyName,
    cityName: r.cityName,
    jurisdictions: r.jurisdictions,
    source: r.source,
    matchedBy,
  };
}

/** Quantum's own records for the products on these lines, keyed every way a line can name one. */
export async function knownProductsFor(storeSlug: string, lines: QuoteInput["lines"]) {
  const known = new Map<string, KnownProduct>();
  const variantKeys = lines.map((l) => l.variantId).filter(Boolean).map((v) => `${storeSlug}:${v}`);
  // Catalog SKUs are stored upper-cased but otherwise as typed ("1S-DEV-SW"),
  // so query both that and the dash-free form; matching then uses codeKey.
  const codes = [
    ...new Set(
      lines
        .flatMap((l) => [l.barcode, l.sku])
        .flatMap((c) => (c ? [c.trim().toUpperCase(), codeKey(c)] : []))
        .filter((c): c is string => !!c),
    ),
  ];

  const mirror = variantKeys.length
    ? await db
        .select({ variantId: medusaProducts.variantId, matchedSku: medusaProducts.matchedSku })
        .from(medusaProducts)
        .where(inArray(medusaProducts.variantId, variantKeys))
    : [];
  const matched = new Map(mirror.filter((m) => m.matchedSku).map((m) => [m.variantId, m.matchedSku!]));

  const skus = [...new Set([...codes, ...matched.values()])];
  const conds = [];
  if (skus.length) conds.push(inArray(products.sku, skus));
  if (variantKeys.length) conds.push(inArray(products.medusaVariantId, variantKeys));
  if (!conds.length) return known;

  const rows = await db.select().from(products).where(or(...conds));
  const toKnown = (p: (typeof rows)[number]): KnownProduct => ({
    sku: p.sku,
    description: p.description,
    wholesaleCost: p.wholesaleCost === null ? null : num(p.wholesaleCost),
    costSource: p.costSource,
    liquidMl: p.liquidMl === null ? null : num(p.liquidMl),
    mlSource: p.mlSource,
    cartridgesPerUnit: p.cartridgesPerUnit === null ? null : num(p.cartridgesPerUnit),
    systemType: p.systemType,
    containsNicotine: p.containsNicotine,
  });
  const bySku = new Map(rows.map((p) => [codeKey(p.sku)!, toKnown(p)]));
  for (const p of rows) {
    if (p.medusaVariantId) known.set(`variant:${p.medusaVariantId.slice(storeSlug.length + 1)}`, toKnown(p));
  }
  for (const [variantKey, sku] of matched) {
    const k = bySku.get(codeKey(sku)!);
    if (k) known.set(`variant:${variantKey.slice(storeSlug.length + 1)}`, k);
  }
  for (const [code, k] of bySku) known.set(code, k);
  return known;
}

export class QuoteError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

/**
 * Every state's sales and excise config, reloaded in the background after a
 * quote (at most every 4 minutes, inside the 5-minute TTL), so a shopper in a
 * state nobody has quoted yet only waits for the ZIP's rate row.
 */
const warmed = new Map<string, number>();
function warmStateCaches(period: string) {
  const last = warmed.get(period);
  if (last && Date.now() - last < 4 * MINUTE) return;
  warmed.set(period, Date.now());
  for (const state of Object.keys(STATE_NAMES)) {
    void refresh(`sales:${state}:${period}`, () => resolveStateConfig(state, "sales", period)).catch(() => {});
    void refresh(`excise:${state}:${period}`, () => resolveExciseConfig(state, period)).catch(() => {});
  }
}

/** Live quote for a cart or order - what checkout calls. */
/**
 * `fresh` skips the in-process cache: a commit is the filed record, so it must
 * see a cost or rate edited in Quantum a moment ago. Checkout quotes use the cache.
 */
export async function calculate(
  storeSlug: string,
  input: QuoteInput,
  on: string = today(),
  { fresh = false }: { fresh?: boolean } = {},
) {
  const cached = <T>(key: string, ttlMs: number, load: () => Promise<T>) => (fresh ? load() : memo(key, ttlMs, load));
  const country = (input.address.country ?? "US").toUpperCase();
  if (country !== "US") throw new QuoteError(`Only US destinations are supported (got ${country}).`);
  const state = normalizeState(input.address.state);
  if (!state) throw new QuoteError(`Unknown US state "${input.address.state}".`);
  const period = on.slice(0, 7);

  const [rate, salesConfig, excise, known, ratio] = await Promise.all([
    cached(`rate:${state}:${input.address.zip}:${(input.address.city ?? "").toLowerCase()}:${on}`, 10 * MINUTE, () =>
      lookupRate(state, input.address.zip, input.address.city, on),
    ),
    cached(`sales:${state}:${period}`, 5 * MINUTE, () => resolveStateConfig(state, "sales", period)),
    cached(`excise:${state}:${period}`, 5 * MINUTE, () => resolveExciseConfig(state, period)),
    cached(
      `known:${storeSlug}:${JSON.stringify(input.lines.map((l) => [l.variantId ?? null, l.sku ?? null, l.barcode ?? null]))}`,
      MINUTE,
      () => knownProductsFor(storeSlug, input.lines),
    ),
    cached("setting:cost_estimate_ratio", 5 * MINUTE, () =>
      getTaxSetting<number | null>("cost_estimate_ratio", DEFAULT_COST_ESTIMATE_RATIO),
    ),
  ]);

  // After this quote's own lookups, so they never queue behind the warm-up.
  warmStateCaches(period);

  const quote = computeQuote(
    { ...input, address: { ...input.address, state } },
    {
      rate,
      sales: {
        registered: Boolean(salesConfig),
        stateRate: salesConfig?.stateRate ?? 0,
      },
      excise,
      shippingTaxable: shippingTaxable(state) === "taxable",
      known,
      costEstimateRatio: ratio,
    },
  );
  if (!rate) {
    // No row for the ZIP and none in its ZIP3 area of this state. A new ZIP inside
    // the state falls back to the state rate, but a ZIP whose area belongs to another
    // state is a wrong address (CO + 21300): refuse it rather than guess a rate.
    const zip3 = input.address.zip.replace(/[^0-9]/g, "").slice(0, 3);
    const [inState] = await cached(`zip3:${state}:${zip3}`, 10 * MINUTE, () =>
      db
        .select({ id: taxRates.id })
        .from(taxRates)
        .where(and(eq(taxRates.state, state), like(taxRates.zip5, `${zip3}%`)))
        .limit(1),
    );
    if (!inState) throw new QuoteError(`ZIP code ${input.address.zip} is not in ${state}. Please check the address.`);
  }
  if (!salesConfig) quote.warnings.push(`Not registered for ${state} sales tax in Quantum - no sales tax charged.`);
  return quote;
}
