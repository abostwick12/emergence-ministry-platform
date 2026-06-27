"use client";

// Error boundary for the authenticated app segment. Catches errors thrown by the
// authenticated layout/pages (including server components like getServerSession
// and Camp access resolution) and renders a recoverable card instead of letting
// the failure blank the whole app.

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      }}
    >
      <main
        style={{
          maxWidth: "28rem",
          width: "100%",
          background: "rgba(15,23,42,0.85)",
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: "1rem",
          padding: "1.75rem",
          textAlign: "center",
          color: "#e2e8f0"
        }}
      >
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "rgba(226,232,240,0.75)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
          We couldn&apos;t load this page. Try again, or sign out and sign back in if it keeps happening.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 0,
              borderRadius: "0.6rem",
              padding: "0.6rem 1.1rem",
              background: "#38bdf8",
              color: "#0b1220",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
          <a
            href="/api/auth/logout"
            style={{
              borderRadius: "0.6rem",
              padding: "0.6rem 1.1rem",
              background: "transparent",
              color: "#e2e8f0",
              border: "1px solid rgba(148,163,184,0.4)",
              textDecoration: "none",
              fontWeight: 600
            }}
          >
            Log out
          </a>
        </div>
      </main>
    </div>
  );
}
