"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1220",
          color: "#e2e8f0",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem"
        }}
      >
        <main
          role="alert"
          style={{
            maxWidth: "28rem",
            width: "100%",
            background: "rgba(15,23,42,0.85)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: "1rem",
            padding: "1.75rem",
            textAlign: "center"
          }}
        >
          <div
            aria-hidden="true"
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: "2.75rem",
              height: "2.75rem",
              borderRadius: "0.85rem",
              marginBottom: "1rem",
              background: "#38bdf8",
              color: "#0b1220",
              fontWeight: 900
            }}
          >
            LE
          </div>
          <p style={{ margin: "0 0 0.5rem", color: "#38bdf8", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Application Recovery
          </p>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "rgba(226,232,240,0.75)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
            The app hit an unexpected problem. You can retry, sign back in, or return to login.
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
            <a
              href="/login"
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
              Login
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
