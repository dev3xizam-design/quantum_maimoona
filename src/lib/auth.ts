import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";
import {
  SESSION_COOKIE,
  cookieOptions,
  signSession,
  verifySession,
  type Session,
} from "./session-token";

export type { Session };

export async function createSession(session: Session) {
  (await cookies()).set(SESSION_COOKIE, await signSession(session), cookieOptions());
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (await verifySession(token))?.session ?? null;
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function verifyLogin(email: string, password: string): Promise<Session | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}

export { hashPassword };

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}
