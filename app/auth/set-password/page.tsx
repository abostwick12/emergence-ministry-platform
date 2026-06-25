"use client";

import { FormEvent, useEffect, useState } from "react";

type SetupState = "preparing" | "ready" | "saving" | "complete" | "error";
type InviteSessionResponse = {
  error?: string;
  user?: {
    email?: string;
  };
};
type PasswordResponse = {
  error?: string;
  redirectTo?: string;
  campRoleLabel?: string;
  passwordUpdated?: boolean;
};

export default function SetPasswordPage() {
  const [setupState, setSetupState] = useState<SetupState>("preparing");
  const [message, setMessage] = useState("Preparing your Camp invite...");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const canSubmit = setupState === "ready";
  const isWorking = setupState === "preparing" || setupState === "saving";
  const showForm = setupState !== "error" && !(setupState === "complete" && error);

  useEffect(() => {
    let cancelled = false;

    async function prepareInviteSession() {
      const invite = readInviteSessionFromUrl();
      if (!invite) {
        setSetupState("error");
        setMessage("Use the latest Camp invite email to continue.");
        setError("This invite link is missing or expired. Ask Andrew to send a new Camp invite.");
        return;
      }

      const response = await fetch("/api/auth/invite-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: invite.accessToken,
          refreshToken: invite.refreshToken,
          type: invite.type
        })
      });
      const payload = (await response.json().catch(() => ({}))) as InviteSessionResponse;
      if (cancelled) return;

      if (!response.ok) {
        setSetupState("error");
        setMessage("Use the latest Camp invite email to continue.");
        setError(payload.error ?? "Invite session could not be prepared.");
        return;
      }

      window.history.replaceState(null, "", "/auth/set-password");
      setEmail(payload.user?.email ?? "");
      setMessage("Create a password for your Camp account.");
      setSetupState("ready");
    }

    void prepareInviteSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSetupState("saving");
    setMessage("Saving your password and opening Camp...");
    const response = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const payload = (await response.json().catch(() => ({}))) as PasswordResponse;

    if (!response.ok) {
      setSetupState(payload.passwordUpdated ? "complete" : "ready");
      setMessage(payload.passwordUpdated ? "Your password was saved." : "Create a password for your Camp account.");
      setError(payload.error ?? "Password setup could not be completed.");
      return;
    }

    setSetupState("complete");
    setMessage(payload.campRoleLabel ? `Camp access active: ${payload.campRoleLabel}. Opening Camp...` : "Camp access active. Opening Camp...");
    window.location.assign(payload.redirectTo ?? "/camp");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">
          LE
        </div>
        <div>
          <p className="eyebrow">Camp invite</p>
          <h1 className="title">Set your password</h1>
          <p className="muted">{email ? `Invite for ${email}` : message}</p>
        </div>

        {email ? <p className="auth-success" role="status">{message}</p> : null}
        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        {showForm ? (
          <form className="grid" onSubmit={submit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} disabled={!canSubmit} required />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input className="input" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} disabled={!canSubmit} required />
            </div>
            <button className="button primary" type="submit" disabled={!canSubmit || isWorking}>
              {setupState === "saving" ? "Saving..." : setupState === "preparing" ? "Preparing..." : "Set password"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function readInviteSessionFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const accessToken = hash.get("access_token") ?? query.get("access_token");
  const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
  const type = hash.get("type") ?? query.get("type") ?? "";

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, type };
}
