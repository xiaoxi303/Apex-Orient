import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Orient - Liquid Glass Stock Radar",
  description: "High-fidelity US stock tracker with premium Apple-style liquid glassmorphism UI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
