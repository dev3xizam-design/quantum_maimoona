import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tax Automation - Maximum Vapor",
  description: "Multi-state sales tax, vapor excise and PACT Act return preparation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
