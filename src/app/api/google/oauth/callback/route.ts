import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCode, GOOGLE_STATE_COOKIE as STATE_COOKIE, googleRedirectUri as redirectUri } from "@/lib/pact-email/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (req: Request, msg: string, tone: "ok" | "err") => {
  const res = NextResponse.redirect(new URL(`/pact-email?${new URLSearchParams({ msg, tone })}`, req.url));
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/google/oauth" });
  return res;
};

/** Google's answer: check the state, keep the refresh token (encrypted) as the reporting mailbox. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return back(req, error === "access_denied" ? "Google sign-in was cancelled." : `Google sign-in failed: ${error}`, "err");

  const state = url.searchParams.get("state") ?? "";
  const expected = req.headers.get("cookie")?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1] ?? "";
  if (!state || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return back(req, "That Google sign-in link expired or did not start here. Press Sign in with Google again.", "err");
  }
  try {
    const { email, refreshToken } = await exchangeCode(url.searchParams.get("code") ?? "", redirectUri(req));
    // One reporting mailbox: replace whatever was connected before.
    await db.delete(emailAccounts);
    await db.insert(emailAccounts).values({
      address: email,
      provider: "google",
      secretCipher: encryptSecret(JSON.stringify({ refreshToken })),
      connectedBy: session.email,
    });
    return back(req, `Connected ${email} with Google. Now read its past PACT emails.`, "ok");
  } catch (e) {
    return back(req, e instanceof Error ? e.message : String(e), "err");
  }
}
