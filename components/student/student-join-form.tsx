"use client";

import { FormEvent, useMemo, useState } from "react";

type StudentJoinFormProps = {
  code: string;
  groupName: string;
  ministryName: string;
  expiresAt: string | null;
};

type JoinResponse = {
  error?: string;
  redirectTo?: string;
  user?: {
    fullName?: string;
  };
};

export function StudentJoinForm({ code, expiresAt, groupName, ministryName }: StudentJoinFormProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joined, setJoined] = useState<{ fullName: string; redirectTo: string } | null>(null);
  const expires = useMemo(() => formatExpiry(expiresAt), [expiresAt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch("/api/student/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        fullName: String(form.get("fullName") || ""),
        email: String(form.get("email") || ""),
        password
      })
    });

    setIsSubmitting(false);

    const payload = (await response.json().catch(() => null)) as JoinResponse | null;
    if (!response.ok || !payload?.redirectTo) {
      setError(payload?.error ?? "Student access could not be created.");
      return;
    }

    setJoined({
      fullName: payload.user?.fullName ?? String(form.get("fullName") || "Student"),
      redirectTo: payload.redirectTo
    });
  }

  if (joined) {
    return (
      <div className="student-join-success" role="status">
        <div className="student-join-context">
          <strong>You are in, {joined.fullName}.</strong>
          <span>{groupName}</span>
          <small>Your leader will review questions before anything is shared with the group.</small>
        </div>
        <ul className="student-join-next-steps">
          <li>Open the Student Portal and ask your first real question.</li>
          <li>Use the deeper questions, journal prompts, prayer prompts, and reading path while your leader reviews it.</li>
          <li>Come back when your leader approves a group discussion prompt.</li>
        </ul>
        <button className="button primary" onClick={() => window.location.assign(joined.redirectTo)} type="button">
          Open Student Portal
        </button>
      </div>
    );
  }

  return (
    <form className="student-join-form" onSubmit={submit}>
      <div className="student-join-context">
        <strong>{ministryName}</strong>
        <span>{groupName}</span>
        <small>{expires ? `Create your Student Portal account before ${expires}.` : "Create your Student Portal account for this group."}</small>
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
        <span>Create password</span>
        <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>

      <label className="field">
        <span>Confirm password</span>
        <input className="input" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      </label>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account and open Student Portal"}
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
