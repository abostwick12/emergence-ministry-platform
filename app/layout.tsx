import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./shell-continuity.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-platform-sans"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-platform-serif",
  weight: ["400", "500", "600", "700"]
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-platform-mono"
});

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
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
