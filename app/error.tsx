"use client";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login-shell">
      <section className="login-card" role="alert">
        <div className="brand-mark" aria-hidden="true">
          LE
        </div>
        <div>
          <p className="eyebrow">Application Recovery</p>
          <h1 className="title">Something went wrong</h1>
          <p className="muted">The app hit an unexpected problem. You can retry or return to login.</p>
        </div>
        <div className="toolbar">
          <button className="button primary" type="button" onClick={() => reset()}>
            Try again
          </button>
          <a className="button" href="/api/auth/logout">
            Log out
          </a>
          <a className="button" href="/login">
            Login
          </a>
        </div>
      </section>
    </main>
  );
}
