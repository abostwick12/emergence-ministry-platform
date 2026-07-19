"use client";

import { FormEvent, useMemo, useState } from "react";

import type { RegistrationInviteRole } from "@/lib/platform/registration";

type PlatformRegistrationFormProps = {
  code: string;
  expiresAt: string | null;
  label: string;
  ministryName: string;
  role: RegistrationInviteRole;
};

type RegistrationResponse = {
  error?: string;
  redirectTo?: string;
  user?: {
    fullName?: string;
  };
};

export function PlatformRegistrationForm({ code, expiresAt, label, ministryName, role }: PlatformRegistrationFormProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registered, setRegistered] = useState<{ fullName: string; redirectTo: string } | null>(null);
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

    const response = await fetch("/api/auth/register", {
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
    const payload = (await response.json().catch(() => null)) as RegistrationResponse | null;
    if (!response.ok || !payload?.redirectTo) {
      setError(payload?.error ?? "Account could not be created.");
      return;
    }

    setRegistered({
      fullName: payload.user?.fullName ?? String(form.get("fullName") || "there"),
      redirectTo: payload.redirectTo
    });
  }

  if (registered) {
    return (
      <div className="student-join-success" role="status">
        <div className="student-join-context">
          <strong>You are in, {registered.fullName}.</strong>
          <span>{label}</span>
          <small>Your Lead Emergence access is ready.</small>
        </div>
        <button className="button primary" onClick={() => window.location.assign(registered.redirectTo)} type="button">
          Open Lead Emergence
        </button>
      </div>
    );
  }

  return (
    <form className="student-join-form" onSubmit={submit}>
      <div className="student-join-context">
        <strong>{ministryName}</strong>
        <span>{label}</span>
        <small>{expires ? `Create your ${roleLabel(role)} account before ${expires}.` : `Create your ${roleLabel(role)} account.`}</small>
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
        {isSubmitting ? "Creating account..." : "Create account"}
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

function roleLabel(role: RegistrationInviteRole) {
  if (role === "student") return "student";
  if (role === "parent") return "parent";
  return "leader";
}
