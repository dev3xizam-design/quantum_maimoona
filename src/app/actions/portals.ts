"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { portals } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { scrubSecrets } from "@/lib/scrub-secrets";
import {
  EMPTY,
  packSecrets,
  readSecrets,
  type PortalSecrets,
} from "@/lib/portal-secrets";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  const s = v === null ? "" : String(v).trim();
  return s === "" ? null : s;
};

const STATUSES = new Set(["active", "blocked", "needs_license", "no_login"]);

export async function savePortal(formData: FormData) {
  await requireSession();
  const idRaw = str(formData, "id");
  const label = str(formData, "label");
  if (!label) return;

  const status = str(formData, "status") ?? "active";
  const url = str(formData, "portalUrl");

  const values = {
    state: (str(formData, "state") ?? "--").toUpperCase().slice(0, 2),
    label,
    purpose: scrubSecrets(str(formData, "purpose")),
    // A bare domain is still a usable link once it has a scheme.
    portalUrl: url && !/^https?:\/\//i.test(url) ? `https://${url}` : url,
    loginId: str(formData, "loginId"),
    licenseNumber: str(formData, "licenseNumber"),
    frequency: str(formData, "frequency"),
    status: STATUSES.has(status) ? status : "active",
    notes: scrubSecrets(str(formData, "notes")),
    updatedAt: new Date(),
  };

  // Secret boxes render empty, so an empty box means "leave it as it was",
  // never "erase it". Clearing is deliberate, via the checkbox.
  const id = idRaw ? Number(idRaw) : null;
  const clear = formData.get("clearSecrets") === "on";
  const existing: PortalSecrets = id && !clear ? await readSecrets(id) : { ...EMPTY };
  const merged: PortalSecrets = {
    password: str(formData, "password") ?? existing.password,
    pin: str(formData, "pin") ?? existing.pin,
    securityAnswers: str(formData, "securityAnswers") ?? existing.securityAnswers,
    codes: str(formData, "codes") ?? existing.codes,
  };
  const withSecrets = { ...values, secretCipher: packSecrets(merged) };

  if (id) {
    await db.update(portals).set(withSecrets).where(eq(portals.id, id));
  } else {
    await db.insert(portals).values(withSecrets).onConflictDoUpdate({
      target: portals.label,
      set: withSecrets,
    });
  }
  revalidatePath("/portals");
}

/**
 * Hands one account's credentials to the browser, and only when a signed-in
 * user clicks Reveal on that card. Nothing here is ever logged, and the
 * plaintext is never part of the page's own HTML - that is the whole reason
 * this is an action rather than a field on the card.
 */
export async function revealSecrets(id: number): Promise<PortalSecrets> {
  await requireSession();
  if (!Number.isFinite(id)) throw new Error("Unknown portal.");
  try {
    return await readSecrets(id);
  } catch {
    // Almost always a blob written under a different AUTH_SECRET.
    throw new Error(
      "These credentials cannot be decrypted. AUTH_SECRET has changed since they were saved - re-enter them.",
    );
  }
}

export async function deletePortal(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.delete(portals).where(eq(portals.id, id));
  revalidatePath("/portals");
}
