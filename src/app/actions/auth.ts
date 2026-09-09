"use server";

import { redirect } from "next/navigation";
import { countUsers, createSession, destroySession, hashPassword, verifyLogin } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const session = await verifyLogin(email, password);
  if (!session) return { error: "Incorrect email or password." };
  await createSession(session);
  redirect("/");
}

/** First-run only: creates the initial admin when no user exists yet. */
export async function bootstrapUser(_prev: unknown, formData: FormData) {
  if ((await countUsers()) > 0) return { error: "An account already exists. Sign in instead." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || "Admin";
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 10) {
    return { error: "Email is required and the password must be at least 10 characters." };
  }

  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash: await hashPassword(password), role: "admin" })
    .returning();
  await createSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
