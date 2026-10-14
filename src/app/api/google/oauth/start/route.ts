import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { GOOGLE_STATE_COOKIE as STATE_COOKIE, googleAuthUrl, googleConfigured, googleRedirectUri as redirectUri } from "@/lib/pact-email/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Sign in with Google" for the reporting mailbox: a one-time state in a cookie, then Google. */
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", req.url));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/pact-email?tone=err&msg=Google+sign-in+is+not+set+up+yet.", req.url));
  const state = randomBytes(24).toString("base64url");
  const hint = new URL(req.url).searchParams.get("hint") ?? undefined;
  const res = NextResponse.redirect(googleAuthUrl(redirectUri(req), state, hint));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google/oauth", maxAge: 600 });
  return res;
}
