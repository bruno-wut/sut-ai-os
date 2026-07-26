import Link from "next/link";
import type { Route } from "next";

import { LoginForm } from "./login-form";

type LoginPageProps = Readonly<{
  searchParams: Promise<{ next?: string; reason?: string }>;
}>;

function safeNext(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/staff/dashboard";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Staff access</p>
        <h1 className="display-title" id="login-title">Welcome back</h1>
        <p>
          Sign in with your authorised hotel account. Your session is protected
          with secure, server-managed cookies.
        </p>
        {params.reason === "staff_required" ? (
          <p className="setup-panel__error" role="alert">This account does not have active hotel staff access.</p>
        ) : null}
        <LoginForm next={safeNext(params.next)} />
        <Link className="login-return-link" href={"./book" as Route}>
          Return to booking
        </Link>
      </section>
    </main>
  );
}
