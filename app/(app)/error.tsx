"use client";

export default function AppRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid workspace-page">
      <section className="panel" role="alert">
        <p className="eyebrow">Application Recovery</p>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Something went wrong
        </h2>
        <p className="muted">This page hit an unexpected problem. Retry the page or sign back in.</p>
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
    </div>
  );
}
