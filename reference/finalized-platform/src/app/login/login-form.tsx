"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: Readonly<{ next: string }>) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="login-form">
      <input name="next" type="hidden" value={next} />
      <label className="field">
        <span className="field__label">Staff email</span>
        <input autoComplete="username" className="field__control" name="email" required type="email" />
      </label>
      <label className="field">
        <span className="field__label">Password</span>
        <input
          autoComplete="current-password"
          className="field__control"
          minLength={4}
          name="password"
          required
          type="password"
        />
      </label>
      {state.error ? <p className="setup-panel__error" role="alert">{state.error}</p> : null}
      <button className="button button--primary" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in securely"}
      </button>
    </form>
  );
}
