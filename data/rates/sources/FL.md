# FL - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- FL DOR form DR-15DSS for calendar year 2026 (https://floridarevenue.com/Forms_library/current/dr15dss_26.pdf) as transcribed into Quantum's directory, including the 2026 changes it lists (Jackson 1.5% extended, Martin 0.5%, Palm Beach 0.5%). Florida surtax changes take effect only on January 1 (s. 212.054(5)), so the 2026 table is current on 2026-10-01. floridarevenue.com refused connections from this machine on 2026-10-14, so the PDF was not re-downloaded; the 2026 changes were confirmed via the PDF's search-indexed text. Surtax applies only to the first $5,000 of a single item (not modelled; irrelevant at this store's prices). Components expiring 2026-12-31 (Brevard, Charlotte, Liberty, Santa Rosa) must be re-checked against DR-15DSS 2027.
- Shape: 6% + county surtax. Census 2020 ZCTA pieces map ZIPs to counties/cities.

## Validation against Avalara (Sales Invoices since 2026-07-01)

97 / 99 (state, ZIP, city) keys match (98.0%); 97 / 99 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 32572 | MILTON | 0.07000 | - | Gap: 32572 is a PO-box-only ZIP (Milton, Santa Rosa County, 1% surtax -> 7%). Census ZCTAs have no PO-box ZIPs, so the Census-piece builders produce no row. Needs a ZIP->county fallback (see report). |
| 32703 | APOPKA | 0.07000 | 0.06500 | (c) ZIP straddles Orange (0.5% surtax, Apopka city) and Seminole (1%). Avalara's dest_county is SEMINOLE; we match on the postal city Apopka (Orange). Address-level only. |
