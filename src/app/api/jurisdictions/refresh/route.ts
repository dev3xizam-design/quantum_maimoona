import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseDirectoryCsv } from "@/lib/jurisdictions/directory";
import { applyStateRefresh, currentStateFingerprints } from "@/lib/jurisdictions/refresh";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The jurisdiction refresh running on the OpenClaw server posts one state at a
 * time here. Machine to machine: no session, a shared secret instead, so the
 * server never holds the database connection string.
 *
 *   POST /api/jurisdictions/refresh
 *   x-quantum-signature: sha256=<hmac of the raw body, key JURISDICTION_REFRESH_SECRET>
 *   { "state": "TX", "source": "...", "sourceUrls": [...], "fetchedAt": "...",
 *     "csv": "<the state's rows in directory CSV form>" }
 *
 * GET returns what is loaded now, so a run can skip states nothing changed in.
 */
function authorized(raw: string, header: string | null): boolean {
  const secret = process.env.JURISDICTION_REFRESH_SECRET;
  if (!secret || !header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized("", req.headers.get("x-quantum-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  return NextResponse.json({ states: await currentStateFingerprints() });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!authorized(raw, req.headers.get("x-quantum-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: { state?: string; csv?: string; source?: string; sourceUrls?: string[]; fetchedAt?: string; force?: boolean };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }
  if (!body.state || !body.csv) {
    return NextResponse.json({ error: "state and csv are required" }, { status: 400 });
  }

  try {
    // Same validation the repo's own CSV goes through: a bad row rejects the
    // delivery whole rather than loading half a state.
    const rows = parseDirectoryCsv(body.csv).filter((r) => r.category === "tax");
    const outcome = await applyStateRefresh(
      {
        state: body.state,
        rows,
        source: body.source ?? null,
        sourceUrls: body.sourceUrls ?? [],
        fetchedAt: body.fetchedAt ?? null,
        force: body.force === true,
      },
      `refresh:${body.source ?? "openclaw"}`,
    );
    return NextResponse.json(outcome, { status: outcome.status === "applied" ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
