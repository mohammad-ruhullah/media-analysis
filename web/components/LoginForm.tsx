"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/login/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400">Password</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-400">{state.error}</p>
      ) : null}
      <button
        disabled={pending}
        className="w-full rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}