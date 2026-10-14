"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

type SectionTab = "all" | "workflow" | "files" | "workbook" | "rules" | "troubleshooting" | "security";

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<SectionTab>("all");
  const [search, setSearch] = useState("");

  const shouldShow = (category: SectionTab) => activeTab === "all" || activeTab === category;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {/* Header & Pagehead */}
      <div className="pagehead">
        <div className="pagehead-row items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Logo size={42} />
            <div>
              <h1 className="page-title text-[28px] font-extrabold tracking-tight">How Quantum Works</h1>
              <p className="page-sub text-[13.5px] text-[var(--muted)] mt-0.5">
                The definitive operational architecture and filing guide. Deterministic formulas, zero estimation, and complete audit integrity.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-ready font-bold">100% Deterministic</span>
            <span className="badge badge-ready font-bold">AES-256 Encryption</span>
            <span className="badge badge-ready font-bold">Cent-Accurate Audit</span>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <nav className="tabs mt-4">
          <button
            type="button"
            className="tab"
            data-active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          >
            All sections
          </button>
          <button
            type="button"
            className="tab"
            data-active={activeTab === "workflow"}
            onClick={() => setActiveTab("workflow")}
          >
            01. Monthly Workflow
          </button>
          <button
            type="button"
            className="tab"
            data-active={activeTab === "files"}
            onClick={() => setActiveTab("files")}
          >
            02. Data Pipeline
          </button>
          <button
            type="button"
            className="tab"
            data-active={activeTab === "workbook"}
            onClick={() => setActiveTab("workbook")}
          >
            03. Master Workbook
          </button>
          <button
            type="button"
            className="tab"
            data-active={activeTab === "rules"}
            onClick={() => setActiveTab("rules")}
          >
            04. Engine Rules
          </button>
          <button
            type="button"
            className="tab"
            data-active={activeTab === "troubleshooting"}
            onClick={() => setActiveTab("troubleshooting")}
          >
            05. Troubleshooting
          </button>
          <button
            type="button"
            className="tab"
            data-active={activeTab === "security"}
            onClick={() => setActiveTab("security")}
          >
            06. Security & Vault
          </button>
        </nav>
      </div>

      {/* Overview Core Principles Card */}
      {shouldShow("workflow") && (
        <section className="panel p-6 bg-[#EAE5D8] border border-[rgba(26,9,5,0.12)] rounded-2xl shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[85ch]">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#4C050C]">
                Core Philosophy
              </span>
              <h2 className="text-[19px] font-extrabold text-[var(--ink)] mt-1 tracking-tight">
                Quantum prepares; a human files.
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
                State portals frequently block scraping and API automation, and automated browser bots break constantly on tax deadlines.
                Quantum eliminates 99% of manual labor by computing the exact numbers, jurisdiction allocations, and form fields into state-specific worksheets.
                Your final step is simply typing five or six verified numbers into each state portal.
              </p>
            </div>
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/70 border border-[rgba(26,9,5,0.08)] min-w-[240px]">
              <div className="text-[11.5px] font-bold text-[var(--ink)]">Tax Coverage</div>
              <div className="text-[12px] text-[var(--muted)]">✓ Sales & Use Tax (50 States + DC)</div>
              <div className="text-[12px] text-[var(--muted)]">✓ State Vapor Excise (All 5 structures)</div>
              <div className="text-[12px] text-[var(--muted)]">✓ Federal PACT Act Monthly Filings</div>
            </div>
          </div>
        </section>
      )}

      {/* 01. The Monthly Run — Step by Step Flow */}
      {shouldShow("workflow") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--ink)]">
                01. The Monthly Run — Ordered Execution
              </h2>
              <p className="text-[12.5px] text-[var(--muted)]">
                Follow these five consecutive steps every month to guarantee mathematical reconciliation.
              </p>
            </div>
          </div>

          <div className="grid gap-3.5 md:grid-cols-5">
            {/* Step 1 */}
            <div className="stat stat-sand flex flex-col justify-between p-4.5 rounded-2xl border border-[rgba(26,9,5,0.12)] h-full bg-[#EAE5D8]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-[13px] text-[#4C050C] px-2 py-0.5 rounded-md bg-[#4C050C]/10">
                    STEP 01
                  </span>
                  <Link href="/upload" className="text-[11.5px] font-bold text-[#4C050C] hover:underline">
                    Upload ↗
                  </Link>
                </div>
                <h3 className="font-bold text-[14px] text-[var(--ink)] mt-2.5 leading-snug">
                  Upload Avalara Export
                </h3>
                <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                  Drag & drop the period’s <strong>SalesTaxDocumentLineDetail</strong> (.xlsx/.csv). Parsed in-browser; file never leaves your machine.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[rgba(26,9,5,0.08)] text-[11px] font-semibold text-[#19694e]">
                ✓ Check: Taxable + Exempt = Gross
              </div>
            </div>

            {/* Step 2 */}
            <div className="stat stat-sand flex flex-col justify-between p-4.5 rounded-2xl border border-[rgba(26,9,5,0.12)] h-full bg-[#EAE5D8]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-[13px] text-[#4C050C] px-2 py-0.5 rounded-md bg-[#4C050C]/10">
                    STEP 02
                  </span>
                  <Link href="/products" className="text-[11.5px] font-bold text-[#4C050C] hover:underline">
                    Products ↗
                  </Link>
                </div>
                <h3 className="font-bold text-[14px] text-[var(--ink)] mt-2.5 leading-snug">
                  Enrich Products
                </h3>
                <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                  Fill in what Avalara cannot know: wholesale cost and pod mL. Ranked by revenue so you focus only on material SKUs.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[rgba(26,9,5,0.08)] text-[11px] font-semibold text-[var(--muted)]">
                Syncs with Medusa/Shopify
              </div>
            </div>

            {/* Step 3 */}
            <div className="stat stat-sand flex flex-col justify-between p-4.5 rounded-2xl border border-[rgba(26,9,5,0.12)] h-full bg-[#EAE5D8]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-[13px] text-[#4C050C] px-2 py-0.5 rounded-md bg-[#4C050C]/10">
                    STEP 03
                  </span>
                  <Link href="/period" className="text-[11.5px] font-bold text-[#4C050C] hover:underline">
                    Compute ↗
                  </Link>
                </div>
                <h3 className="font-bold text-[14px] text-[var(--ink)] mt-2.5 leading-snug">
                  Close the Month
                </h3>
                <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                  Press <strong>Compute</strong>. The deterministic engine calculates all 50 states + DC across sales, excise, and PACT in seconds.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[rgba(26,9,5,0.08)] text-[11px] font-semibold text-[#4C050C]">
                Emits Master Workbook
              </div>
            </div>

            {/* Step 4 */}
            <div className="stat stat-sand flex flex-col justify-between p-4.5 rounded-2xl border border-[rgba(26,9,5,0.12)] h-full bg-[#EAE5D8]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-[13px] text-[#4C050C] px-2 py-0.5 rounded-md bg-[#4C050C]/10">
                    STEP 04
                  </span>
                  <Link href="/audit" className="text-[11.5px] font-bold text-[#4C050C] hover:underline">
                    Action Items ↗
                  </Link>
                </div>
                <h3 className="font-bold text-[14px] text-[var(--ink)] mt-2.5 leading-snug">
                  Resolve Action Items
                </h3>
                <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                  Review the single Action Items list. Address missing jurisdiction codes or unclassified wholesale costs before filing.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[rgba(26,9,5,0.08)] text-[11px] font-semibold text-[var(--muted)]">
                Zero estimation allowed
              </div>
            </div>

            {/* Step 5 */}
            <div className="stat stat-sand flex flex-col justify-between p-4.5 rounded-2xl border border-[rgba(26,9,5,0.12)] h-full bg-[#EAE5D8]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-[13px] text-[#4C050C] px-2 py-0.5 rounded-md bg-[#4C050C]/10">
                    STEP 05
                  </span>
                  <Link href="/portals" className="text-[11.5px] font-bold text-[#4C050C] hover:underline">
                    Portals ↗
                  </Link>
                </div>
                <h3 className="font-bold text-[14px] text-[var(--ink)] mt-2.5 leading-snug">
                  File & Lock Calendar
                </h3>
                <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                  Type numbers from the state tab into each portal. Press <em>Mark Filed</em> with confirmation number to lock status.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[rgba(26,9,5,0.08)] text-[11px] font-semibold text-[#19694e]">
                ✓ Keeps Calendar Honest
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 02. Data Pipeline: The 4 Files */}
      {shouldShow("files") && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--ink)]">
              02. Data Pipeline — The Four Files Quantum Reads
            </h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              Every data stream is distinct, idempotent, and cross-reconciled. Re-uploading a period never duplicates numbers.
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* File 1 */}
            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="badge badge-ready font-bold">Primary Feed</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--muted)]">.XLSX / .CSV</span>
                </div>
                <h3 className="font-bold text-[15px] text-[var(--ink)] mt-2">Avalara Line Detail</h3>
                <p className="mt-1 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                  Drives Sales & Use tax, state/county/city line breakdown, and rebuilds the active product SKU list.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[rgba(26,9,5,0.08)]">
                <div className="text-[11px] font-bold text-[var(--muted)]">Source:</div>
                <div className="text-[11.5px] text-[var(--ink)] font-mono">Avalara → LineDetail Export</div>
                <div className="text-[11px] font-bold text-[#4C050C] mt-2">If Missing:</div>
                <div className="text-[11.5px] text-[#4C050C]">Engine will not compute.</div>
              </div>
            </div>

            {/* File 2 */}
            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="badge badge-ready font-bold">Catalog Feed</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--muted)]">Auto + Form</span>
                </div>
                <h3 className="font-bold text-[15px] text-[var(--ink)] mt-2">Product Master</h3>
                <p className="mt-1 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                  Supplies wholesale unit cost, liquid volume (mL), and open/closed pod classifications for excise taxes.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[rgba(26,9,5,0.08)]">
                <div className="text-[11px] font-bold text-[var(--muted)]">Source:</div>
                <div className="text-[11.5px] text-[var(--ink)] font-mono">Medusa API / Products Tab</div>
                <div className="text-[11px] font-bold text-[#944b0c] mt-2">If Missing:</div>
                <div className="text-[11.5px] text-[#944b0c]">Excise states flag SKUs for review.</div>
              </div>
            </div>

            {/* File 3 */}
            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="badge badge-ready font-bold">Purchases</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--muted)]">.CSV</span>
                </div>
                <h3 className="font-bold text-[15px] text-[var(--ink)] mt-2">Purchase Import</h3>
                <p className="mt-1 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                  Used exclusively for states with receipts-basis excise taxes, such as Kansas Form EC-2 line 1a (mL purchased into inventory).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[rgba(26,9,5,0.08)]">
                <div className="text-[11px] font-bold text-[var(--muted)]">Source:</div>
                <div className="text-[11.5px] text-[var(--ink)] font-mono">Vendor Purchasing Records</div>
                <div className="text-[11px] font-bold text-[var(--muted)] mt-2">If Missing:</div>
                <div className="text-[11.5px] text-[var(--muted)]">Kansas EC-2 cannot compute.</div>
              </div>
            </div>

            {/* File 4 */}
            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="badge badge-ready font-bold">PACT Shipments</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--muted)]">API / Feed</span>
                </div>
                <h3 className="font-bold text-[15px] text-[var(--ink)] mt-2">Shipment Feed</h3>
                <p className="mt-1 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                  Full recipient name, street address, and package delivery verification required for federal PACT Act monthly reports.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[rgba(26,9,5,0.08)]">
                <div className="text-[11px] font-bold text-[var(--muted)]">Source:</div>
                <div className="text-[11.5px] text-[var(--ink)] font-mono">Shopify / Matrixify / Medusa</div>
                <div className="text-[11px] font-bold text-[#944b0c] mt-2">If Missing:</div>
                <div className="text-[11.5px] text-[#944b0c]">PACT lists ZIPs with no recipient names.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 03. Master Workbook Anatomy */}
      {shouldShow("workbook") && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--ink)]">
              03. Master Workbook Architecture & Color Legend
            </h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              Every Excel workbook emitted by Quantum follows strict visual encoding and form order.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Color Coding Box */}
            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl space-y-3">
              <h3 className="font-extrabold text-[14.5px] text-[var(--ink)]">Color Legend</h3>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                  <span className="w-3.5 h-3.5 rounded-full bg-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[12px] text-yellow-900">Yellow Cell</div>
                    <div className="text-[11.5px] text-yellow-800">
                      Direct manual entry number to paste into the state portal form.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-red-50 border border-red-200">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[12px] text-red-900">Red Cell</div>
                    <div className="text-[11.5px] text-red-800">
                      Blocking warning (missing code, unclassified SKU) requiring resolution.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[12px] text-blue-900">Blue / Green Cell</div>
                    <div className="text-[11.5px] text-blue-800">
                      Calculated subtotal, verified reconciliation total, or safe reference figure.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workbook Tabs Box */}
            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl lg:col-span-2 space-y-3">
              <h3 className="font-extrabold text-[14.5px] text-[var(--ink)]">Workbook Tabs & Structure</h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="p-3 rounded-xl bg-white border border-[rgba(26,9,5,0.08)]">
                  <div className="font-bold text-[13px] text-[var(--ink)]">1. Instructions Tab</div>
                  <div className="text-[12px] text-[var(--muted)] mt-1">
                    Filing guidelines, period dates, company FEIN, and color explanations.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[rgba(26,9,5,0.08)]">
                  <div className="font-bold text-[13px] text-[var(--ink)]">2. Summary Tab</div>
                  <div className="text-[12px] text-[var(--muted)] mt-1">
                    Every state on a single row: gross sales, taxable, tax due, collected, and delta.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[rgba(26,9,5,0.08)]">
                  <div className="font-bold text-[13px] text-[var(--ink)]">3. Action Items Tab</div>
                  <div className="text-[12px] text-[var(--muted)] mt-1">
                    Centralized audit warnings across all 50 states, naming exact SKUs or cities.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[rgba(26,9,5,0.08)]">
                  <div className="font-bold text-[13px] text-[var(--ink)]">4. State Filing Tabs</div>
                  <div className="text-[12px] text-[var(--muted)] mt-1">
                    One dedicated tab per registered state in the exact order the portal demands.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 04. Non-Negotiable Engine Rules */}
      {shouldShow("rules") && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--ink)]">
              04. Non-Negotiable Engine Rules
            </h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              Strict mathematical principles that prevent over-reporting, duplicate counting, and audits.
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="panel p-4.5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="text-[11px] font-mono font-bold text-[#4C050C]">RULE 01</div>
              <h3 className="font-bold text-[14px] text-[var(--ink)] mt-1">Jurisdiction Explosion</h3>
              <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                Avalara explodes each sale across State, County, City, and District rows. Quantum takes gross sales strictly from the State row to prevent multiplying revenue by 4x.
              </p>
            </div>

            <div className="panel p-4.5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="text-[11px] font-mono font-bold text-[#4C050C]">RULE 02</div>
              <h3 className="font-bold text-[14px] text-[var(--ink)] mt-1">Cent-Exact Reconciliation</h3>
              <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                <code>Taxable + Exempt = Gross</code> must reconcile to the exact cent for every single state. If any discrepancy exists, the return is flagged before filing.
              </p>
            </div>

            <div className="panel p-4.5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="text-[11px] font-mono font-bold text-[#4C050C]">RULE 03</div>
              <h3 className="font-bold text-[14px] text-[var(--ink)] mt-1">True Returns Deductions</h3>
              <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                Customer returns and refunds always reduce the current period’s taxable amount, regardless of whether the raw export signed them negative or positive.
              </p>
            </div>

            <div className="panel p-4.5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="text-[11px] font-mono font-bold text-[#4C050C]">RULE 04</div>
              <h3 className="font-bold text-[14px] text-[var(--ink)] mt-1">Assessed vs Collected Delta</h3>
              <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                What the store collected at checkout is compared against statutory tax. Positive delta indicates under-collection at checkout and flags a margin alert.
              </p>
            </div>

            <div className="panel p-4.5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="text-[11px] font-mono font-bold text-[#4C050C]">RULE 05</div>
              <h3 className="font-bold text-[14px] text-[var(--ink)] mt-1">Split-Frequency Schedules</h3>
              <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                Filing frequency is managed per tax type: Kansas sales tax can be Annual while its EC-2 excise is Monthly. Each calendar event is independently tracked.
              </p>
            </div>

            <div className="panel p-4.5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="text-[11px] font-mono font-bold text-[#4C050C]">RULE 06</div>
              <h3 className="font-bold text-[14px] text-[var(--ink)] mt-1">Zero Invention</h3>
              <p className="mt-1.5 text-[12px] text-[var(--ink-2)] leading-relaxed">
                Puff counts are never estimated into liquid mL. Wholesale costs are never guessed. Missing data is reported directly on the Action Items tab.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 05. Troubleshooting & Health Diagnostics */}
      {shouldShow("troubleshooting") && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--ink)]">
              05. Troubleshooting Diagnostic Matrix
            </h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              Quick resolution steps for the most common reconciliation anomalies.
            </p>
          </div>

          <div className="panel overflow-hidden border border-[rgba(26,9,5,0.12)] rounded-2xl bg-white shadow-xs">
            <table className="qtable">
              <thead>
                <tr>
                  <th className="w-[30%]">Observed Symptom</th>
                  <th className="w-[35%]">Underlying Cause</th>
                  <th className="w-[35%]">Required Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-bold text-[var(--ink)]">Revenue looks 3x–4x too high</td>
                  <td className="text-[var(--ink-2)]">Non-deduped export or summary report used instead of Line Detail.</td>
                  <td>Ensure export is <strong>SalesTaxDocumentLineDetail</strong> from Avalara.</td>
                </tr>
                <tr>
                  <td className="font-bold text-[var(--ink)]">Reconciliation Mismatch / Flagged</td>
                  <td className="text-[var(--ink-2)]">Period only partially exported or overlapping date ranges uploaded.</td>
                  <td>Verify start date is the 1st and end date is month-end. Re-upload clean month.</td>
                </tr>
                <tr>
                  <td className="font-bold text-[var(--ink)]">Excise tax is zero or unexpectedly low</td>
                  <td className="text-[var(--ink-2)]">Wholesale cost or pod mL missing for high-volume SKUs.</td>
                  <td>Open <Link href="/products" className="font-semibold text-[#4C050C] underline">Products</Link> and enter cost/mL for unclassified items.</td>
                </tr>
                <tr>
                  <td className="font-bold text-[var(--ink)]">Large Positive Delta on Summary</td>
                  <td className="text-[var(--ink-2)]">Checkout charged lower tax than the state’s statutory rate.</td>
                  <td>Real margin delta. Audit tax settings on store platform for that state.</td>
                </tr>
                <tr>
                  <td className="font-bold text-[var(--ink)]">State shows &ldquo;MISSING&rdquo; jurisdiction code</td>
                  <td className="text-[var(--ink-2)]">A local city or county has no official department code assigned.</td>
                  <td>Add the code under <Link href="/config" className="font-semibold text-[#4C050C] underline">Config → Jurisdiction codes</Link>.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 06. Security Vault & Compliance */}
      {shouldShow("security") && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--ink)]">
              06. Security Vault & Zero-Leakage Protocol
            </h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              All state portal credentials and customer addresses are protected with bank-grade encryption.
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#19694e]" />
                <span className="font-bold text-[13px] text-[var(--ink)]">AES-256-GCM Vault</span>
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                State portal passwords, PINs, and security answers are encrypted under keys derived from <code>AUTH_SECRET</code>. Decrypted strictly in memory upon user click.
              </p>
            </div>

            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#19694e]" />
                <span className="font-bold text-[13px] text-[var(--ink)]">Zero Plaintext Logging</span>
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                Credentials and PACT recipient street addresses are never written to application logs, telemetry, or serverless request traces.
              </p>
            </div>

            <div className="panel p-5 bg-[#FAF7F0] border border-[rgba(26,9,5,0.12)] rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#19694e]" />
                <span className="font-bold text-[13px] text-[var(--ink)]">Card / Bank Isolation</span>
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                Credit card numbers and bank credentials are mathematically scrubbed if entered into notes. Quantum stores tax portal logins only.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
