import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Quantum · Tax Automation",
    template: "%s · Quantum",
  },
  description:
    "Multi-state sales tax, vapor excise and PACT Act return preparation for all 50 states and DC.",
  applicationName: "Quantum Tax Automation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
