import { NextResponse } from "next/server";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { verifyPairingCode } from "@/lib/connectors/pairing";
import { issuePushKey } from "@/lib/connectors/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step 3 of the plugin's "Connect to Quantum" button. The browser brought back
 * a one-time code; the plugin's SERVER trades it here for the connection key,
 * so the key itself never passes through a browser, URL or referrer.
 */
export async function POST(req: Request) {
  let body: { code?: string; site?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const claim = await verifyPairingCode(body.code);
  if (!claim) return NextResponse.json({ error: "That pairing code is invalid or expired. Press Connect again." }, { status: 401 });

  // Burn the code atomically before issuing, so a replay can never mint a second key.
  const [row] = await db
    .update(integrations)
    .set({ config: dsql`${integrations.config} - 'pendingCode'` })
    .where(and(eq(integrations.id, claim.integrationId), dsql`${integrations.config}->>'pendingCode' = ${claim.jti}`))
    .returning();
  if (!row) {
    return NextResponse.json({ error: "That pairing code was already used. Press Connect again." }, { status: 409 });
  }
  if (body.site && row.baseUrl !== body.site.replace(/\/+$/, "")) {
    return NextResponse.json({ error: "That code was issued for a different site." }, { status: 403 });
  }

  const key = await issuePushKey(row.id);
  return NextResponse.json({ ok: true, key, store: row.name, api_version: 1 });
}
