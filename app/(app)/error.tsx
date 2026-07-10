"use client";

export default function AppRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="route-error-shell">
      <main className="route-error-card liquid-card-strong" role="alert">
        <p className="route-error-eyebrow">
          Application Recovery
        </p>
        <h1>Something went wrong</h1>
        <p>
          This page hit an unexpected problem. Retry the page or sign back in.
        </p>
        <div className="route-error-actions">
          <button
            className="button primary"
            type="button"
            onClick={() => reset()}
          >
            Try again
          </button>
          <a className="button" href="/api/auth/logout">
            Log out
          </a>
          <a className="button" href="/login">
            Login
          </a>
        </div>
      </main>
    </div>
  );
}
