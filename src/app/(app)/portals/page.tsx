import { asc } from "drizzle-orm";
import { db } from "@/db";
import { portals } from "@/db/schema";
import { shapeOf } from "@/lib/portal-secrets";
import { PortalsView } from "./PortalsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portals" };

export default async function PortalsPage() {
  let rows: (typeof portals.$inferSelect)[] = [];
  try {
    rows = await db.select().from(portals).orderBy(asc(portals.state), asc(portals.sortOrder));
  } catch {
    rows = [];
  }

  return (
    <PortalsView
      rows={rows.map((r) => ({
        id: r.id,
        state: r.state,
        label: r.label,
        purpose: r.purpose,
        portalUrl: r.portalUrl,
        loginId: r.loginId,
        licenseNumber: r.licenseNumber,
        frequency: r.frequency,
        status: r.status,
        notes: r.notes,
        // Which credentials exist, never what they are. The values come
        // later, one card at a time, through the reveal action.
        secrets: shapeOf(r.secretCipher),
      }))}
      fein={process.env.COMPANY_FEIN ?? "82-1098441"}
    />
  );
}
