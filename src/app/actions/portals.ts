"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { portals } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { scrubSecrets } from "@/lib/scrub-secrets";

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

  if (idRaw) {
    await db.update(portals).set(values).where(eq(portals.id, Number(idRaw)));
  } else {
    await db.insert(portals).values(values).onConflictDoUpdate({
      target: portals.label,
      set: values,
    });
  }
  revalidatePath("/portals");
}

export async function deletePortal(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.delete(portals).where(eq(portals.id, id));
  revalidatePath("/portals");
}
