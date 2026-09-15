# Maryland (MD)

**Rows:** 1 (state: 1)  
**Code system:** Census state FIPS `24` used only as a key — Maryland's Form 202 has no jurisdiction codes.  
**Completeness:** Complete — no general local sales taxes in Maryland.

## Sources
- Business Tax Tip #8: https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/tips/business/bustip8.pdf — 6% rate, "There are no general local sales taxes in Maryland."
- Tax Alert, ESD rate changes effective 2024-07-01: https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/alerts/Tax-Alert-Cigarettes-OT-ESDs-Tax-Rate-Changes.pdf (also https://www.marylandcomptroller.gov/legal-library/sut-ta-jul-01-2024.html)
- Sales & Use Tax Facts 2024-2025: https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/facts/Sales-Use-Tax-Facts-2024.pdf (ESD 12% -> 20%, new Form 202 lines)
- Sales & Use Tax Updates 2025-2026: https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/alerts/tax-alert-sales-and-use-tax-updates.pdf (3% IT/data services)
- Sales & Use Tax Updates 2026-2027 (May 27, 2026): https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/alerts/tax-alert-sales-and-use-tax-updates-2026-2027.pdf — no rate changes affecting goods; e-filing mandate
- Raw copies: `raw/MD/`

## Preparer notes (critical for a vape seller)
- **The 6% general rate does NOT apply to most vape products.** Electronic smoking devices, including vaping liquid in containers **over 5 ml**, are taxed at **20%** (since 2024-07-01). Vaping liquid in containers of **5 ml or less** is taxed at **60%**. These rates exceed the dataset's 0–15% rate column range, so they sit in the notes rather than the rate columns.
- Form 202 has separate lines to report ESD sales and the tax collected on them. Split the sales by product type before filing.
- Business Tax Tip #8 still shows the old 12% ESD rate. It is out of date; the July 2024 Tax Alert governs.
- Sales and use tax returns must be filed electronically for periods beginning after 2026-12-31.
- Remote-seller nexus thresholds were not re-verified in this pass.
