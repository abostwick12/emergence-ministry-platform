"use client";

import { type CSSProperties, FormEvent, useState } from "react";
import { ArrowRight, Sparkles, Workflow } from "lucide-react";

import { landingVideoScenes } from "@/lib/landing-video";

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
    <main className="login-shell login-welcome-shell">
      <section className="login-welcome-panel" aria-label="Lead Emergence welcome">
        <div className="login-welcome-copy">
          <p className="eyebrow">Lead Emergence</p>
          <h1>Welcome back to the ministry workbench.</h1>
          <p>
            Events, tasks, sermon prep, discipleship, and student pathways stay connected so leaders can see the next right step.
          </p>
        </div>
        <div className="login-motion-board" aria-hidden="true">
          <div className="login-orbit-mark">
            <Sparkles size={22} />
          </div>
          {landingVideoScenes.slice(0, 5).map((scene, index) => (
            <article
              className={`login-scene-card accent-${scene.accent}`}
              key={scene.productArea}
              style={{ "--scene-index": index, "--scene-offset": `${index * 18}px` } as CSSProperties}
            >
              <span>{scene.eyebrow}</span>
              <strong>{scene.productArea}</strong>
              <p>{scene.metric}</p>
            </article>
          ))}
        </div>
        <div className="login-welcome-flow" aria-hidden="true">
          <span><Workflow size={16} /> Plan</span>
          <ArrowRight size={15} />
          <span>Assign</span>
          <ArrowRight size={15} />
          <span>Prepare</span>
        </div>
      </section>
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

