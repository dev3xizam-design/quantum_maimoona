"use client";

import { useActionState } from "react";
import { bootstrapUser, login } from "@/app/actions/auth";

export function LoginForm({ firstRun }: { firstRun: boolean }) {
  const action = firstRun ? bootstrapUser : login;
  const [state, formAction, pending] = useActionState(action, null as { error?: string } | null);

  return (
    <form action={formAction} className="panel space-y-4 p-5">
      <div>
        <h1 className="text-[15px] font-semibold">
          {firstRun ? "Create the first account" : "Sign in"}
        </h1>
        {firstRun && (
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            No users exist yet. This form creates the initial admin.
          </p>
        )}
      </div>

      {firstRun && (
        <div>
          <label className="field" htmlFor="name">Name</label>
          <input id="name" name="name" type="text" autoComplete="name" required />
        </div>
      )}

      <div>
        <label className="field" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div>
        <label className="field" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={firstRun ? "new-password" : "current-password"}
          required
          minLength={firstRun ? 10 : undefined}
        />
      </div>

      {state?.error && <div className="callout callout-warn">{state.error}</div>}

      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Working..." : firstRun ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
