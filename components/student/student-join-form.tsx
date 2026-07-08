"use client";

import { FormEvent, useMemo, useState } from "react";

type StudentJoinFormProps = {
  code: string;
  groupName: string;
  ministryName: string;
  expiresAt: string | null;
};

export function StudentJoinForm({ code, expiresAt, groupName, ministryName }: StudentJoinFormProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expires = useMemo(() => formatExpiry(expiresAt), [expiresAt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/student/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        fullName: String(form.get("fullName") || ""),
        email: String(form.get("email") || ""),
        password: String(form.get("password") || "")
      })
    });

    setIsSubmitting(false);

    const payload = (await response.json().catch(() => null)) as { error?: string; redirectTo?: string } | null;
    if (!response.ok || !payload?.redirectTo) {
      setError(payload?.error ?? "Student access could not be created.");
      return;
    }

    window.location.assign(payload.redirectTo);
  }

  return (
    <form className="student-join-form" onSubmit={submit}>
      <div className="student-join-context">
        <strong>{ministryName}</strong>
        <span>{groupName}</span>
        {expires ? <small>Invite expires {expires}</small> : null}
      </div>

      <label className="field">
        <span>Name</span>
        <input className="input" name="fullName" autoComplete="name" placeholder="Your name" required />
      </label>

      <label className="field">
        <span>Email</span>
        <input className="input" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </label>

      <label className="field">
        <span>Password</span>
        <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating access..." : "Join student portal"}
      </button>
    </form>
  );
}

function formatExpiry(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
