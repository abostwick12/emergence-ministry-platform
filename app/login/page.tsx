"use client";

import { FormEvent, useState } from "react";

type LoginResponse = {
  user?: {
    role?: string;
  };
  error?: string;
};

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
    const body = (await response.json().catch(() => null)) as LoginResponse | null;

    if (!response.ok) {
      setError(body?.error ?? "Login failed.");
      return;
    }

    const nextPath = getSafeNextPath(new URLSearchParams(window.location.search).get("next"), body?.user?.role);
    window.location.assign(nextPath);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">
          LE
        </div>
        <div>
          <p className="eyebrow">Internal Access</p>
          <h1 className="title">Lead Emergence Automated Platform</h1>
          <p className="muted">Sign in with your Lead Emergence account. Students can create access from a group invite, then return here anytime.</p>
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

function getSafeNextPath(value: string | null, role?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return role?.trim().toLowerCase() === "student" ? "/student" : "/dashboard";
  return value;
}

