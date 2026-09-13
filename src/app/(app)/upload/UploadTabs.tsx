"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/upload", label: "Avalara export" },
  { href: "/upload/products", label: "Product master" },
  { href: "/upload/purchases", label: "Purchases" },
  { href: "/upload/shipments", label: "PACT shipments" },
  { href: "/upload/history", label: "History" },
];

export function UploadTabs({ historyCount }: { historyCount: number }) {
  const pathname = usePathname();
  return (
    <div className="pagehead">
      <div className="pagehead-row">
        <div>
          <h1 className="page-title">Upload</h1>
          <p className="page-sub mt-0.5">
            The Avalara export is the main event — it drives sales tax and rebuilds the product
            catalog. The other three only add what a sales-tax export cannot contain.
          </p>
        </div>
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="tab" data-active={pathname === t.href}>
            {t.label}
            {t.href === "/upload/history" && <span className="tab-count">{historyCount}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
