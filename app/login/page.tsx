"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck2, HeartHandshake, LogIn, MessageSquareText } from "lucide-react";
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
    <main className="login-shell login-entry-shell">
      <div className="login-entry-frame">
        <section className="login-entry-vision" aria-labelledby="login-vision-title">
          <div className="login-entry-brand" aria-label="Lead Emergence Automated Platform">
            <span className="login-entry-mark" aria-hidden="true">LE</span>
            <span>
              <strong>Lead Emergence</strong>
              <small>Automated Platform</small>
            </span>
          </div>

          <div className="login-entry-message">
            <p className="eyebrow">Ministry operating system</p>
            <h1 id="login-vision-title">Creating space for ministry to flourish.</h1>
            <p>Bring the people, plans, and follow-through of ministry into one clear weekly rhythm.</p>
          </div>

          <div className="login-entry-outcomes" aria-label="Platform outcomes">
            <span><CalendarCheck2 size={18} aria-hidden="true" /> Plan with clarity</span>
            <span><HeartHandshake size={18} aria-hidden="true" /> Care for people</span>
            <span><MessageSquareText size={18} aria-hidden="true" /> Communicate well</span>
          </div>
        </section>

        <section className="login-entry-access" aria-labelledby="login-access-title">
          <div className="login-entry-access-copy">
            <p className="eyebrow">Secure access</p>
            <h2 id="login-access-title">Welcome back.</h2>
            <p>Sign in with your Lead Emergence account to continue to your workspace.</p>
          </div>

          <form className="login-entry-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <button className="button primary login-entry-submit" type="submit" disabled={isSubmitting}>
              <LogIn size={18} aria-hidden="true" />
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>
          </form>

          <div className="login-entry-alternate"><span>or</span></div>

          <Link className="button login-entry-guest" href="/api/auth/guest">
            Continue as guest <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <p className="login-entry-invite">Students receive access through a group invite.</p>
        </section>
      </div>
    </main>
  );
}

function getSafeNextPath(value: string | null, role?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return role?.trim().toLowerCase() === "student" ? "/student" : "/dashboard";
  return value;
}

