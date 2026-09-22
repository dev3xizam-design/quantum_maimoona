import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { portals } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * What a state actually asks for at its login screen, beyond the username.
 * Every field is optional because no two states want the same set.
 */
export type PortalSecrets = {
  password: string;
  /** Arizona's 6-digit PIN, Wyoming's 5-digit PIN, and so on. */
  pin: string;
  /** "First dog? Chino" - one per line, in the state's own wording. */
  securityAnswers: string;
  /** Activation, authorization and access codes. One per line. */
  codes: string;
};

export const EMPTY: PortalSecrets = { password: "", pin: "", securityAnswers: "", codes: "" };

const FIELDS = ["password", "pin", "securityAnswers", "codes"] as const;

export function hasAny(s: PortalSecrets): boolean {
  return FIELDS.some((f) => s[f].trim() !== "");
}

/** Everything blank means "there is no secret here", so store null, not a blob. */
export function packSecrets(s: PortalSecrets): string | null {
  const trimmed = Object.fromEntries(FIELDS.map((f) => [f, s[f].trim()])) as PortalSecrets;
  return hasAny(trimmed) ? encryptSecret(JSON.stringify(trimmed)) : null;
}

export function unpackSecrets(cipher: string | null): PortalSecrets {
  if (!cipher) return { ...EMPTY };
  const raw = JSON.parse(decryptSecret(cipher)) as Partial<PortalSecrets>;
  return {
    password: raw.password ?? "",
    pin: raw.pin ?? "",
    securityAnswers: raw.securityAnswers ?? "",
    codes: raw.codes ?? "",
  };
}

/**
 * Which secret fields exist, WITHOUT the values. This is what the page is
 * allowed to render for every card - so a card can show "Password · PIN"
 * chips without the plaintext ever reaching the browser unasked.
 */
export type SecretShape = { password: boolean; pin: boolean; securityAnswers: boolean; codes: boolean };

export function shapeOf(cipher: string | null): SecretShape {
  if (!cipher) return { password: false, pin: false, securityAnswers: false, codes: false };
  try {
    const s = unpackSecrets(cipher);
    return {
      password: s.password !== "",
      pin: s.pin !== "",
      securityAnswers: s.securityAnswers !== "",
      codes: s.codes !== "",
    };
  } catch {
    // A blob written under a different AUTH_SECRET. Say nothing is there
    // rather than crashing the whole page on one bad row.
    return { password: false, pin: false, securityAnswers: false, codes: false };
  }
}

export async function readSecrets(id: number): Promise<PortalSecrets> {
  const [row] = await db
    .select({ cipher: portals.secretCipher })
    .from(portals)
    .where(eq(portals.id, id))
    .limit(1);
  if (!row) throw new Error("That portal no longer exists.");
  return unpackSecrets(row.cipher);
}
