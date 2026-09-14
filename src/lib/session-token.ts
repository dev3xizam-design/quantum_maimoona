import { SignJWT, jwtVerify } from "jose";

/**
 * Signing and verification only - no next/headers, no database - so this can
 * run in middleware (edge) as well as in server components and route handlers.
 */

export const SESSION_COOKIE = "mvtax_session";

/** Seven days, refreshed on use, so a working week never expires mid-task. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Re-issue once the token is past half its life. */
export const SESSION_REFRESH_AFTER = SESSION_MAX_AGE / 2;

export type Session = { userId: number; email: string; name: string; role: string };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set a long random string.");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export type VerifiedSession = { session: Session; issuedAt: number };

export async function verifySession(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      session: {
        userId: Number(payload.userId),
        email: String(payload.email),
        name: String(payload.name),
        role: String(payload.role ?? "admin"),
      },
      issuedAt: Number(payload.iat ?? 0),
    };
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** True once the token is old enough to be worth re-issuing. */
export function shouldRefresh(issuedAt: number, now = Math.floor(Date.now() / 1000)) {
  return issuedAt > 0 && now - issuedAt > SESSION_REFRESH_AFTER;
}
