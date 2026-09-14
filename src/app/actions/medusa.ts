"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  deleteConnection,
  saveConnection,
  setMatchDecision,
  syncAllOrders,
  syncCatalog,
  syncOrders,
  type OrderSyncResult,
  type SyncResult,
} from "@/lib/medusa/sync";
import { refreshProductCatalog } from "@/lib/products/catalog";

function refresh() {
  revalidatePath("/config/stores");
  revalidatePath("/products");
  revalidatePath("/", "layout");
}

export async function saveStore(_prev: unknown, formData: FormData) {
  const session = await requireSession();
  const idRaw = String(formData.get("id") ?? "").trim();

  try {
    const res = await saveConnection({
      id: idRaw ? Number(idRaw) : undefined,
      name: String(formData.get("name") ?? ""),
      baseUrl: String(formData.get("baseUrl") ?? ""),
      secret: String(formData.get("secret") ?? ""),
      syncOrders: formData.get("syncOrders") !== "off",
      syncCatalog: formData.get("syncCatalog") !== "off",
      actor: session.email,
    });
    refresh();
    return res.ok
      ? { ok: true as const, message: `Connected — authenticating with ${res.scheme}.` }
      : { ok: false as const, message: res.error ?? "That store rejected the connection." };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function removeStore(formData: FormData) {
  await requireSession();
  await deleteConnection(Number(formData.get("id")));
  refresh();
}

export async function runCatalogSync(
  id: number,
): Promise<{ ok: true; result: SyncResult } | { ok: false; error: string }> {
  await requireSession();
  try {
    const result = await syncCatalog(id);
    await refreshProductCatalog();
    refresh();
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Reads orders and writes the PACT shipment feed for that store. */
export async function runOrderSync(
  id: number,
): Promise<{ ok: true; result: OrderSyncResult } | { ok: false; error: string }> {
  await requireSession();
  try {
    const result = await syncOrders(id);
    refresh();
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runAllOrderSyncs(): Promise<
  { ok: true; results: OrderSyncResult[] } | { ok: false; error: string }
> {
  await requireSession();
  try {
    const results = await syncAllOrders();
    refresh();
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function decideMedusaMatch(rowId: number, decision: "reject" | "accept") {
  await requireSession();
  await setMatchDecision(rowId, decision);
  await refreshProductCatalog();
  refresh();
}
