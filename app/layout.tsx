import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Emergence — Automated Platform",
  description: "Ministry operations platform for event automation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded globally from the App Router root layout (the _document equivalent). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,500;1,800;1,900&family=Playfair+Display:ital,wght@1,600;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
