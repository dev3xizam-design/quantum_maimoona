import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { platform } from "./catalog";

/**
 * The glue for one-button connects: a signed, short-lived state that proves the
 * callback belongs to a flow a signed-in Quantum user started, plus the HMAC
 * checks Shopify requires on every redirect and webhook.
 */

export const STATE_COOKIE = "q_connect";
const STATE_TTL = 15 * 60;

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short.");
  return new TextEncoder().encode(`quantum:connect:${s}`);
}

export type ConnectState = {
  provider: string;
  /** Store address the flow was started for (Shopify shop, Woo site). */
  target?: string;
  /** Name the user typed, if any. */
  name?: string;
  actor: string;
};

export async function signState(state: ConnectState): Promise<string> {
  return new SignJWT(state as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL}s`)
    .sign(key());
}

export async function verifyState(token: string | null | undefined): Promise<ConnectState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as ConnectState;
  } catch {
    return null;
  }
}

export function stateCookie(value: string) {
  return {
    name: STATE_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/connect",
    maxAge: STATE_TTL,
  };
}

/** Public origin of this Quantum. APP_URL wins; otherwise the request's own origin. */
export function appUrl(req: Request): string {
  const env = process.env.APP_URL?.replace(/\/+$/, "");
  if (env) return env;
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? u.host;
  return `${proto}://${host}`;
}

/** True when every env var the platform's one-button OAuth needs is set. */
export function oauthReady(provider: string): boolean {
  const p = platform(provider);
  if (!p) return false;
  if (p.oneClick === "always") return true;
  if (p.oneClick === "never") return false;
  return (p.oauthEnv ?? []).every((k) => Boolean(process.env[k]));
}

export function oauthReadiness(): Record<string, boolean> {
  return Object.fromEntries(
    ["shopify", "woocommerce", "wix", "bigcommerce", "squarespace", "ecwid", "magento", "medusa", "push"].map((id) => [
      id,
      oauthReady(id),
    ]),
  );
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Shopify redirect HMAC: hex HMAC-SHA256 of the sorted query string, minus hmac. */
export function verifyShopifyQuery(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get("hmac");
  if (!hmac) return false;
  const message = [...params.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return safeEqual(createHmac("sha256", secret).update(message).digest("hex"), hmac);
}

/** Shopify webhook HMAC: base64 HMAC-SHA256 of the raw body. */
export function verifyShopifyWebhook(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  return safeEqual(createHmac("sha256", secret).update(rawBody, "utf8").digest("base64"), header);
}
