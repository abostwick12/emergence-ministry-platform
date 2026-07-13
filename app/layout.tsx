import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./shell-continuity.css";

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
      <body>{children}</body>
    </html>
  );
}
