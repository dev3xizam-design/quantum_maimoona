import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, like, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations, shipments } from "@/db/schema";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { millilitresBySku, normalizeCode, slugify, syncOrders as syncMedusaOrders, type OrderSyncResult } from "@/lib/medusa/sync";
import { platform } from "./catalog";
import { ConnectorError } from "./http";
import { emptyResult, normalizeOrders, type NormalizeResult } from "./normalize";
import * as bigcommerce from "./providers/bigcommerce";
import * as ecwid from "./providers/ecwid";
import * as magento from "./providers/magento";
import * as shopify from "./providers/shopify";
import * as squarespace from "./providers/squarespace";
import * as wix from "./providers/wix";
import * as woocommerce from "./providers/woocommerce";
import type { Credentials, NormalizedOrder, SyncWindow } from "./types";

/**
 * Connections for every platform other than Medusa (which keeps its own richer
 * sync in src/lib/medusa, catalog included). Credentials are stored as ONE
 * encrypted JSON blob in integrations.secret_cipher - never returned to the
 * browser, never logged; the UI sees the last four characters of the main key.
 */

type Connector = {
  test: (c: Credentials, config: Record<string, unknown>) => Promise<Record<string, unknown>>;
  orders: (c: Credentials, config: Record<string, unknown>, w: SyncWindow) => AsyncGenerator<NormalizedOrder[]>;
};

const CONNECTORS: Record<string, Connector> = { shopify, woocommerce, wix, bigcommerce, squarespace, ecwid, magento };

const CHUNK = 200;

/** Re-read this many days before the last sync, to catch late cancellations and edits. */
const OVERLAP_DAYS = 14;

async function uniqueSlug(name: string) {
  let slug = slugify(name);
  const taken = new Set((await db.select({ slug: integrations.slug }).from(integrations)).map((r) => r.slug));
  if (taken.has(slug)) {
    let n = 2;
    while (taken.has(`${slug}-${n}`)) n += 1;
    slug = `${slug}-${n}`;
  }
  return slug;
}

/**
 * Save (or reconnect) a store and test it. A second connect of the same
 * platform + address updates the existing row, so reconnecting after a key
 * rotation never creates a duplicate store - or duplicate PACT rows.
 */
export async function saveProviderConnection(input: {
  provider: string;
  name?: string;
  baseUrl: string;
  credentials: Credentials;
  config: Record<string, unknown>;
  actor: string;
  /** Save now, test later - for callbacks that must answer the platform quickly. */
  skipTest?: boolean;
  /** false = held for approval (installs that arrived without a signed-in Quantum user). */
  active?: boolean;
}): Promise<{ id: number; ok: boolean; error: string | null; name: string }> {
  const connector = CONNECTORS[input.provider];
  if (!connector) throw new ConnectorError(`Quantum has no connector for "${input.provider}".`);

  const [existing] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.provider, input.provider), eq(integrations.baseUrl, input.baseUrl)))
    .limit(1);

  let config = { ...(existing?.config ?? {}), ...input.config };
  let error: string | null = null;
  let detectedName: string | undefined;
  if (!input.skipTest) {
    try {
      const extra = await connector.test(input.credentials, config);
      detectedName = typeof extra.storeName === "string" ? extra.storeName : undefined;
      config = { ...config, ...extra };
      delete (config as Record<string, unknown>).storeName;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const mainKey = Object.values(input.credentials).filter(Boolean).pop() ?? "";
  const name =
    input.name?.trim() || existing?.name || detectedName || input.baseUrl.replace(/^https?:\/\//, "");

  const values = {
    name,
    baseUrl: input.baseUrl,
    provider: input.provider,
    secretCipher: encryptSecret(JSON.stringify(input.credentials)),
    secretLast4: last4(mainKey),
    authScheme: null,
    config,
    status: input.active === false ? "pending" : input.skipTest ? "unconfigured" : error ? "error" : "ok",
    lastError: error,
    lastTestedAt: input.skipTest ? null : new Date(),
    syncCatalog: false,
    ...(input.active === undefined ? {} : { active: input.active }),
    updatedBy: input.actor,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(integrations).set(values).where(eq(integrations.id, existing.id));
    return { id: existing.id, ok: !error, error, name };
  }
  const [row] = await db
    .insert(integrations)
    .values({ ...values, slug: await uniqueSlug(name) })
    .returning({ id: integrations.id });
  return { id: row.id, ok: !error, error, name };
}

async function load(id: number) {
  const [row] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
  if (!row) throw new ConnectorError("That connection no longer exists.");
  return row;
}

function credentialsOf(row: typeof integrations.$inferSelect): Credentials {
  if (!row.secretCipher) throw new ConnectorError(`No credentials saved for ${row.name}. Reconnect it.`);
  return JSON.parse(decryptSecret(row.secretCipher)) as Credentials;
}

export async function retestConnection(id: number) {
  const row = await load(id);
  const connector = CONNECTORS[row.provider];
  if (!connector) throw new ConnectorError(`${row.name} is not a pull connection.`);
  try {
    const extra = await connector.test(credentialsOf(row), row.config ?? {});
    delete extra.storeName;
    await db
      .update(integrations)
      .set({ status: "ok", lastError: null, lastTestedAt: new Date(), config: { ...(row.config ?? {}), ...extra } })
      .where(eq(integrations.id, id));
    return { ok: true as const };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.update(integrations).set({ status: "error", lastError: error, lastTestedAt: new Date() }).where(eq(integrations.id, id));
    return { ok: false as const, error };
  }
}

/* ------------------------------------------------------------------ */
/* Writing the PACT feed                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert normalized rows into `shipments` (idempotent on externalId), remove
 * rows for orders that have since been cancelled, and - for Shopify - retire
 * CSV-imported rows of the same orders so a store moved from Matrixify exports
 * to the live API is never counted twice.
 */
export async function writeShipments(
  row: typeof integrations.$inferSelect,
  result: NormalizeResult,
): Promise<OrderSyncResult & { supersededCsvRows: number; removedCancelled: number }> {
  const mlBySku = await millilitresBySku();
  const values = result.rows.map((r) => ({
    integrationId: row.id,
    sourceSystem: row.provider,
    sourceLabel: row.name,
    externalId: r.externalId,
    orderNumber: r.orderNumber,
    period: r.period,
    state: r.state,
    customerName: r.customerName,
    shipToAddress: r.shipToAddress,
    shipToCity: r.shipToCity,
    shipToState: r.shipToState,
    shipToZip: r.shipToZip,
    invoiceDate: r.invoiceDate,
    invoiceNumber: r.invoiceNumber,
    product: r.product,
    brand: r.brand,
    quantity: String(r.quantity),
    mlTotal: String((mlBySku.get(normalizeCode(r.sku) ?? "") ?? 0) * r.quantity),
  }));

  for (let i = 0; i < values.length; i += CHUNK) {
    await db
      .insert(shipments)
      .values(values.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: shipments.externalId,
        set: {
          period: dsql`excluded.period`,
          state: dsql`excluded.state`,
          sourceLabel: dsql`excluded.source_label`,
          customerName: dsql`excluded.customer_name`,
          shipToAddress: dsql`excluded.ship_to_address`,
          shipToCity: dsql`excluded.ship_to_city`,
          shipToState: dsql`excluded.ship_to_state`,
          shipToZip: dsql`excluded.ship_to_zip`,
          invoiceDate: dsql`excluded.invoice_date`,
          invoiceNumber: dsql`excluded.invoice_number`,
          product: dsql`excluded.product`,
          brand: dsql`excluded.brand`,
          quantity: dsql`excluded.quantity`,
          mlTotal: dsql`excluded.ml_total`,
        },
      });
  }

  let removedCancelled = 0;
  for (const orderId of result.cancelledOrderIds) {
    const gone = await db
      .delete(shipments)
      .where(like(shipments.externalId, `${row.provider}:${row.slug}:${orderId}:%`))
      .returning({ id: shipments.id });
    removedCancelled += gone.length;
  }

  let supersededCsvRows = 0;
  if (row.provider === "shopify") {
    const numbers = [...new Set(result.rows.map((r) => r.orderNumber).filter((n): n is string => Boolean(n)))];
    for (let i = 0; i < numbers.length; i += 500) {
      const gone = await db
        .delete(shipments)
        .where(
          and(
            eq(shipments.sourceSystem, "shopify_csv"),
            eq(shipments.sourceLabel, row.name),
            inArray(shipments.orderNumber, numbers.slice(i, i + 500)),
          ),
        )
        .returning({ id: shipments.id });
      supersededCsvRows += gone.length;
    }
  }

  return {
    store: row.name,
    ordersRead: result.ordersRead,
    shipmentRows: values.length,
    periods: [...new Set(result.rows.map((r) => r.period))].sort(),
    states: new Set(result.rows.map((r) => r.state)).size,
    skippedNoAddress: result.skippedNoAddress,
    skippedNonUs: result.skippedNonUs,
    skippedCancelled: result.skippedCancelled,
    withCustomerName: result.rows.filter((r) => r.customerName).length,
    supersededCsvRows,
    removedCancelled,
  };
}

/* ------------------------------------------------------------------ */
/* Pull sync                                                           */
/* ------------------------------------------------------------------ */

export async function syncStoreOrders(id: number, opts: { full?: boolean } = {}): Promise<OrderSyncResult> {
  const row = await load(id);
  if (row.provider === "medusa") return syncMedusaOrders(id);
  if (row.provider === "push") {
    throw new ConnectorError(`${row.name} pushes its own orders through the Quantum plugin — there is nothing to pull.`);
  }
  const connector = CONNECTORS[row.provider];
  if (!connector) throw new ConnectorError(`No connector for ${row.provider}.`);

  const since =
    !opts.full && row.ordersSyncedAt
      ? new Date(row.ordersSyncedAt.getTime() - OVERLAP_DAYS * 86_400_000).toISOString().slice(0, 10)
      : undefined;

  const result = emptyResult();
  try {
    for await (const page of connector.orders(credentialsOf(row), row.config ?? {}, { since })) {
      normalizeOrders(page, row.provider, row.slug, result);
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.update(integrations).set({ status: "error", lastError: error }).where(eq(integrations.id, id));
    throw e;
  }

  const stats = await writeShipments(row, result);
  await db
    .update(integrations)
    .set({
      status: "ok",
      lastError: null,
      ordersSyncedAt: new Date(),
      orderStats: { ...stats, window: since ? `since ${since}` : "full history" } as unknown as Record<string, unknown>,
    })
    .where(eq(integrations.id, id));
  return stats;
}

/** Every active pull store (Medusa included). Push stores are skipped - they send their own. */
export async function syncAllStores(): Promise<{ results: OrderSyncResult[]; failures: { store: string; error: string }[] }> {
  const rows = await db
    .select({ id: integrations.id, name: integrations.name, provider: integrations.provider })
    .from(integrations)
    .where(and(eq(integrations.active, true), eq(integrations.syncOrders, true)));
  const results: OrderSyncResult[] = [];
  const failures: { store: string; error: string }[] = [];
  for (const r of rows) {
    if (r.provider === "push") continue;
    try {
      results.push(await syncStoreOrders(r.id));
    } catch (e) {
      failures.push({ store: r.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { results, failures };
}

/* ------------------------------------------------------------------ */
/* Push connections (plugins + Connect API)                            */
/* ------------------------------------------------------------------ */

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new connection key. Shown once; only its hash is stored. */
export async function issuePushKey(id: number): Promise<string> {
  const key = `qk_live_${randomBytes(24).toString("base64url")}`;
  await db
    .update(integrations)
    .set({ pushKeyHash: hashKey(key), pushKeyLast4: last4(key), status: "ok", lastError: null, updatedAt: new Date() })
    .where(eq(integrations.id, id));
  return key;
}

export async function createPushConnection(input: {
  name: string;
  baseUrl: string;
  platform: string;
  actor: string;
}): Promise<{ id: number; key: string }> {
  const baseUrl = input.baseUrl.trim() || `push://${slugify(input.name)}`;
  const [existing] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.provider, "push"), eq(integrations.baseUrl, baseUrl)))
    .limit(1);

  let id = existing?.id;
  if (!id) {
    const name = input.name.trim() || baseUrl.replace(/^https?:\/\//, "");
    const [row] = await db
      .insert(integrations)
      .values({
        slug: await uniqueSlug(name),
        name,
        provider: "push",
        baseUrl,
        status: "unconfigured",
        syncCatalog: false,
        config: { platform: input.platform },
        updatedBy: input.actor,
      })
      .returning({ id: integrations.id });
    id = row.id;
  }
  return { id, key: await issuePushKey(id) };
}

export async function connectionForPushKey(key: string | null | undefined) {
  if (!key || !key.startsWith("qk_")) return null;
  const [row] = await db.select().from(integrations).where(eq(integrations.pushKeyHash, hashKey(key))).limit(1);
  return row && row.active ? row : null;
}

export async function recordPush(id: number, stats: OrderSyncResult) {
  await db
    .update(integrations)
    .set({
      lastPushAt: new Date(),
      ordersSyncedAt: new Date(),
      status: "ok",
      lastError: null,
      orderStats: stats as unknown as Record<string, unknown>,
    })
    .where(eq(integrations.id, id));
}

export { platform };
