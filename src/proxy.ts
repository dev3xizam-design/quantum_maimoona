import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  cookieOptions,
  shouldRefresh,
  signSession,
  verifySession,
} from "@/lib/session-token";

/**
 * Sliding session. A valid token past half its life is re-issued on the way
 * through, so someone working a normal week is never signed out mid-task - and
 * an abandoned tab still expires.
 */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next();

  const verified = await verifySession(token);
  if (!verified || !shouldRefresh(verified.issuedAt)) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE, await signSession(verified.session), cookieOptions());
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand|icon.png|apple-icon.png).*)"],
};
