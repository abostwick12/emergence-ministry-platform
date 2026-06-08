import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emerge Ministry Platform",
  description: "MVP 1 ministry operations platform for event automation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
