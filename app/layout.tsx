import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "./shell-continuity.css";
import "./platform-editorial.css";
import "./mobile-field-app.css";

export const metadata: Metadata = {
  title: "Lead Emergence — Automated Platform",
  description: "Ministry operations platform for event automation."
};

// viewport-fit=cover lets the layout read iPhone safe-area insets so the
// mobile header can pad below the browser/notch chrome instead of tucking under it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview" ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
