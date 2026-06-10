"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || "")
      })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Login failed.");
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">
          EM
        </div>
        <div>
          <p className="eyebrow">Internal Access</p>
          <h1 className="title">Emerge Ministry Platform</h1>
          <p className="muted">Sign in with the email and password assigned from Supabase Auth.</p>
        </div>

        <form className="grid" onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}

