import "server-only";
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/** One-time, 10-minute codes that let a plugin claim its connection key. */

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short.");
  return new TextEncoder().encode(`quantum:pairing:${s}`);
}

export async function signPairingCode(integrationId: number): Promise<{ code: string; jti: string }> {
  const jti = randomBytes(12).toString("base64url");
  const code = await new SignJWT({ integrationId })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key());
  return { code, jti };
}

export async function verifyPairingCode(code: string | null | undefined) {
  if (!code) return null;
  try {
    const { payload } = await jwtVerify(code, key());
    if (typeof payload.integrationId !== "number" || !payload.jti) return null;
    return { integrationId: payload.integrationId, jti: payload.jti };
  } catch {
    return null;
  }
}
