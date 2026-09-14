"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  deleteIntegration,
  saveAndTestIntegration,
  syncMedusaCatalog,
  type SyncResult,
} from "@/lib/medusa/sync";
import { refreshProductCatalog } from "@/lib/products/catalog";

export async function saveMedusaConnection(_prev: unknown, formData: FormData) {
  const session = await requireSession();
  const baseUrl = String(formData.get("baseUrl") ?? "");
  const secret = String(formData.get("secret") ?? "");

  try {
    const res = await saveAndTestIntegration(baseUrl, secret, session.email);
    revalidatePath("/config/medusa");
    return res.ok
      ? { ok: true as const, message: `Connected. Authenticating with ${res.scheme}.` }
      : { ok: false as const, message: res.error ?? "Medusa rejected the connection." };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function removeMedusaConnection() {
  await requireSession();
  await deleteIntegration();
  revalidatePath("/config/medusa");
}

/** Pull the catalog, match it to the SKUs Avalara reports, then rebuild. */
export async function runMedusaSync(): Promise<
  { ok: true; result: SyncResult } | { ok: false; error: string }
> {
  await requireSession();
  try {
    const result = await syncMedusaCatalog();
    await refreshProductCatalog();
    revalidatePath("/config/medusa");
    revalidatePath("/products");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
