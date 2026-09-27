"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { ConnectorError, normalizeSiteUrl } from "@/lib/connectors/http";
import { signPairingCode } from "@/lib/connectors/pairing";
import { normalizeStoreHash } from "@/lib/connectors/providers/bigcommerce";
import { normalizeShopDomain } from "@/lib/connectors/providers/shopify";
import {
  createPushConnection,
  issuePushKey,
  retestConnection,
  saveProviderConnection,
  syncAllStores,
  syncStoreOrders,
} from "@/lib/connectors/store";
import type { OrderSyncResult } from "@/lib/medusa/sync";
import type { Credentials } from "@/lib/connectors/types";

function refresh() {
  revalidatePath("/config/stores");
  revalidatePath("/marketplace");
  revalidatePath("/", "layout");
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const val = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type Result = { ok: boolean; message: string };

/** The key-paste path for every pull platform. */
export async function connectWithKeys(_prev: unknown, fd: FormData): Promise<Result> {
  const session = await requireSession();
  const provider = val(fd, "provider");
  const name = val(fd, "name") || undefined;

  try {
    let baseUrl: string;
    let credentials: Credentials;
    let config: Record<string, unknown>;

    switch (provider) {
      case "shopify": {
        const shop = normalizeShopDomain(val(fd, "shop"));
        const token = val(fd, "accessToken");
        const clientId = val(fd, "clientId");
        const clientSecret = val(fd, "clientSecret");
        if (!token && !(clientId && clientSecret)) {
          throw new ConnectorError("Enter the app's Client ID and Client secret, or an Admin API access token.");
        }
        baseUrl = `https://${shop}`;
        credentials = token ? { accessToken: token } : { clientId, clientSecret };
        config = { shop, authMode: token ? "token" : "client_credentials" };
        break;
      }
      case "woocommerce": {
        const site = normalizeSiteUrl(val(fd, "site"));
        baseUrl = site;
        credentials = { consumerKey: val(fd, "consumerKey"), consumerSecret: val(fd, "consumerSecret") };
        if (!credentials.consumerKey || !credentials.consumerSecret) throw new ConnectorError("Enter both WooCommerce keys.");
        config = { site };
        break;
      }
      case "wix": {
        const siteId = val(fd, "siteId");
        if (!siteId || !val(fd, "apiKey")) throw new ConnectorError("Enter the Wix site ID and API key.");
        baseUrl = `wix-site://${siteId}`;
        credentials = { apiKey: val(fd, "apiKey") };
        config = { siteId, authMode: "api_key" };
        break;
      }
      case "bigcommerce": {
        const storeHash = normalizeStoreHash(val(fd, "storeHash"));
        baseUrl = `https://store-${storeHash}.mybigcommerce.com`;
        credentials = { accessToken: val(fd, "accessToken") };
        config = { storeHash, authMode: "api_account" };
        break;
      }
      case "squarespace": {
        baseUrl = normalizeSiteUrl(val(fd, "site"));
        credentials = { apiKey: val(fd, "apiKey") };
        config = {};
        break;
      }
      case "ecwid": {
        const storeId = val(fd, "storeId");
        if (!/^\d+$/.test(storeId)) throw new ConnectorError("The Ecwid store ID is a number.");
        baseUrl = `ecwid://${storeId}`;
        credentials = { token: val(fd, "token") };
        config = { storeId };
        break;
      }
      case "magento": {
        const site = normalizeSiteUrl(val(fd, "site"));
        baseUrl = site;
        credentials = { accessToken: val(fd, "accessToken") };
        config = { site };
        break;
      }
      default:
        throw new ConnectorError(`Unknown platform "${provider}".`);
    }

    const saved = await saveProviderConnection({ provider, name, baseUrl, credentials, config, actor: session.email });
    refresh();
    if (!saved.ok) return { ok: false, message: saved.error ?? "The store rejected the connection." };

    // First sync right away: connecting a store should immediately show its orders.
    try {
      const r = await syncStoreOrders(saved.id, { full: true });
      refresh();
      return { ok: true, message: `Connected ${saved.name}. ${describe(r)}` };
    } catch (e) {
      return { ok: true, message: `Connected ${saved.name}, but the first order sync failed: ${msg(e)}` };
    }
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function syncStore(id: number, full = false): Promise<Result> {
  await requireSession();
  try {
    const r = await syncStoreOrders(id, { full });
    refresh();
    return { ok: true, message: describe(r) };
  } catch (e) {
    refresh();
    return { ok: false, message: msg(e) };
  }
}

export async function syncEveryStore(): Promise<Result> {
  await requireSession();
  const { results, failures } = await syncAllStores();
  refresh();
  const parts = [...results.map(describe), ...failures.map((f) => `${f.store}: FAILED — ${f.error}`)];
  return { ok: failures.length === 0, message: parts.join("  ·  ") || "No store is set to pull orders." };
}

export async function testStore(id: number): Promise<Result> {
  await requireSession();
  const r = await retestConnection(id);
  refresh();
  return r.ok ? { ok: true, message: "Connection works." } : { ok: false, message: r.error };
}

/** Installs that arrived without a signed-in user (BigCommerce iframe) wait here. */
export async function approveStore(id: number) {
  const session = await requireSession();
  await db
    .update(integrations)
    .set({ active: true, status: "ok", updatedBy: session.email, updatedAt: new Date() })
    .where(eq(integrations.id, id));
  await retestConnection(id);
  refresh();
}

export async function renameStore(id: number, name: string) {
  await requireSession();
  const clean = name.trim().slice(0, 80);
  if (!clean) return;
  await db.update(integrations).set({ name: clean, updatedAt: new Date() }).where(eq(integrations.id, id));
  refresh();
}

export async function setStoreActive(id: number, active: boolean) {
  await requireSession();
  await db.update(integrations).set({ active, updatedAt: new Date() }).where(eq(integrations.id, id));
  refresh();
}

/* ---------------- Push connections ---------------- */

/** "Any other platform": a named connection + its key, shown once. */
export async function createApiConnection(
  _prev: unknown,
  fd: FormData,
): Promise<{ ok: boolean; message: string; key?: string }> {
  const session = await requireSession();
  const name = val(fd, "name");
  if (!name) return { ok: false, message: "Give the store a name." };
  try {
    const site = val(fd, "site");
    const { key } = await createPushConnection({
      name,
      baseUrl: site ? normalizeSiteUrl(site) : "",
      platform: val(fd, "platform") || "custom",
      actor: session.email,
    });
    refresh();
    return { ok: true, message: "Connection created. Copy the key now — Quantum will not show it again.", key };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function rotatePushKey(id: number): Promise<{ ok: boolean; key?: string; message: string }> {
  await requireSession();
  const key = await issuePushKey(id);
  refresh();
  return { ok: true, key, message: "New key issued. The old one stopped working just now." };
}

/**
 * The plugin's "Connect to Quantum" button lands on /connect/pair; approving it
 * creates (or reuses) the push connection for that site and sends the browser
 * back to the plugin with a one-time code. The plugin trades the code for the
 * key server-to-server at /api/plugin/v1/pair.
 */
export async function approvePairing(fd: FormData) {
  const session = await requireSession();
  const site = normalizeSiteUrl(val(fd, "site"));
  const returnUrl = new URL(val(fd, "return"));
  // The code only ever goes back to the site that asked for it.
  if (returnUrl.host !== new URL(site).host) throw new Error("The return address is not on the site being connected.");

  const { id } = await createPushConnection({
    name: val(fd, "name") || new URL(site).host,
    baseUrl: site,
    platform: val(fd, "platform") || "woocommerce",
    actor: session.email,
  });
  const { code, jti } = await signPairingCode(id);
  await db
    .update(integrations)
    .set({ config: dsql`coalesce(${integrations.config}, '{}'::jsonb) || ${JSON.stringify({ pendingCode: jti })}::jsonb` })
    .where(eq(integrations.id, id));

  returnUrl.searchParams.set("quantum_code", code);
  returnUrl.searchParams.set("state", val(fd, "state"));
  refresh();
  redirect(returnUrl.toString());
}

function describe(r: OrderSyncResult & { supersededCsvRows?: number; removedCancelled?: number }): string {
  const skipped = r.skippedNoAddress + r.skippedNonUs + r.skippedCancelled;
  return (
    `${r.store}: ${r.ordersRead.toLocaleString()} orders → ${r.shipmentRows.toLocaleString()} shipment lines across ${r.states} states` +
    (r.periods.length ? ` (${r.periods[0]} to ${r.periods[r.periods.length - 1]})` : "") +
    (skipped ? `, ${skipped} skipped` : "") +
    (r.supersededCsvRows ? `, ${r.supersededCsvRows} CSV-imported lines replaced by live data` : "") +
    "."
  );
}
