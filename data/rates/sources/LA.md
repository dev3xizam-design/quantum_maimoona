# Louisiana (LA) - rate sources

As of: **2026-10-01** (Commission filing period Oct-2026). Built by `scripts/rates/states/LA.ts`.

## What this seller must collect

- **Remote seller** (no physical presence in Louisiana) over $100,000 or 200 transactions: since 2020-07-01 it must "collect and remit state and local sales and use tax based upon actual applicable bases and rates" to the **Louisiana Sales and Use Tax Commission for Remote Sellers** (LA R.S. 47:302(W), 47:340, 47:301(4)(m); LDR / Commission Remote Sellers FAQ Q7 and Q9).
- The flat **8.45% "direct marketer"** rate (R.S. 47:302(K)) stays open only to sellers *under* the threshold (FAQ Q6).
- **Physical presence**: the seller is a "dealer" and owes state + local too (FAQ Q2).

So the law requires **state 5% + the destination local rate**, whichever way the store is registered. Quantum's seed has an LDR LaTAP account (`002446798`, "General Sales and Use Return") and notes "CONFIRM which return this account files". The builder uses state + local.

> **FLAG FOR THE USER:** Avalara charged **5.000% (state only)** on all 13 LA invoices from July to September 2026. No local tax was charged. The gap on these 13 invoices is **$44.84**. Also check which return the local tax should go on: the Commission's Remote Seller's Sales Tax Return if the store has no Louisiana presence, otherwise parish returns. The LaTAP general return covers state tax only.

## Sources

| what | source | publication | saved as |
|---|---|---|---|
| Local rates per domicile code (the total local rate of each area) | Commission "Remittance Rates", Authority 1000 (Sales Tax), filing period **Oct-2026**, all 64 parishes: https://remotesellersfiling.louisiana.gov/lookup/lookup.aspx | table for Oct-2026 fetched 2026-10-14 | `data/rates/raw/LA/rsc-rates-2026-10.json` (parsed), `rsc-raw-2026-10.json` (scraped page tables), `rsc-parishes.json`, `lookup.html` |
| Remote seller collection rule | LDR / Commission "Frequently Asked Questions - Louisiana Sales and Use Tax on Remote Sales" (draft for the 2020-05-21 Commission meeting): https://dam.ldr.la.gov/miscellaneous/Remote%20Sellers%20FAQs.pdf | 2020 (rule in force since 2020-07-01) | `data/rates/raw/LA/ldr-remote-sellers-faq.pdf` |
| State rate 5% | LDR posted rates effective 2025-01-01 (jurisdiction directory LA state row) | 2025 | `data/jurisdictions/us-jurisdictions.csv` |
| ZIP to parish/town/ward evidence | Census 2020 blocks (`data/rates/derived/zcta-geo.csv`; Louisiana county subdivisions are wards) | 2020 | - |

Scraper: `scripts/rates/fetch-la-rsc.py 10-01-2026`. It POSTs `ddlJurisdiction` + `ddlFilingPeriod` per parish. To parse its output into `rsc-rates-*.json`, take for each parish the rows after the "Jurisdiction (Domicile Code)" header: name `(dddd)`, rate = "Tax Rate" / 100.

How the builder applies them:
- An incorporated town gets the domicile named for it ("City of", "Town of", "Within the City of", "... Sales", etc.). An exact name beats a decorated one: Shreveport 0904 rather than "Shreveport ONLY" 0809.
- Elsewhere the piece gets the parish's own domicile (code = parish code), or the ward row matching its Census ward (Calcasieu, St. Mary).
- Where a parish has no parish-wide row, it gets its unincorporated row ("RURAL SALES", "Parish Sales", "Outside ...", "District 1/2").
- Local tax is reported as one "County" or "City" jurisdiction carrying the domicile code. Avalara itself splits it into parish/city/district.

## Validation against Avalara (2026-07-01 .. 2026-09-30)

- Keys (state, ZIP, city): **0 / 12** match. Invoices: **0 / 13**.
- The state 5% matches on every invoice. Every difference is local tax Avalara did not charge.

### Mismatches

**(b) Avalara wrong per the official source:** all 12 keys. Avalara charged 5% only. Evidence: the Commission's Oct-2026 remittance rate for the domicile shown (and FAQ Q9 for why local applies).

| ZIP | city | parish | invoices | Avalara | ours | our components | Avalara's rate exists elsewhere in the ZIP? |
|---|---|---|---:|---:|---:|---|---|
| 70072 | Marrero | Jefferson | 1 | 5.0% | 9.75% | Louisiana 5.0% + Jefferson Parish 4.75% | no |
| 70115 | New Orleans | Orleans | 1 | 5.0% | 10.0% | Louisiana 5.0% + Orleans Parish 5.0% | no |
| 70433 | Covington | St. Tammany | 1 | 5.0% | 9.25% | Louisiana 5.0% + Covington 4.25% | no |
| 70435 | Covington | St. Tammany | 1 | 5.0% | 9.25% | Louisiana 5.0% + Covington 4.25% | no |
| 70501 | Lafayette | Lafayette | 1 | 5.0% | 9.0% | Louisiana 5.0% + City of Lafayette 4.0% | no |
| 70560 | New Iberia | Iberia | 1 | 5.0% | 10.5% | Louisiana 5.0% + New Iberia 5.5% | no |
| 70706 | Denham Springs | Livingston | 1 | 5.0% | 9.0% | Louisiana 5.0% + Livingston Parish 4.0% | no |
| 71037 | Haughton | Bossier | 2 | 5.0% | 10.25% | Louisiana 5.0% + Haughton 5.25% | no |
| 71055 | Minden | Webster | 1 | 5.0% | 10.5% | Louisiana 5.0% + Minden 5.5% | no |
| 71292 | West Monroe | Ouachita | 1 | 5.0% | 10.99% | Louisiana 5.0% + City of West Monroe 5.99% | no |
| 71350 | Mansura | Avoyelles | 1 | 5.0% | 10.25% | Louisiana 5.0% + Mansura 5.25% | no |
| 71360 | Pineville | Rapides | 1 | 5.0% | 10.5% | Louisiana 5.0% + Pineville 5.5% | no |

**(c) Boundary ambiguity** (on top of the (b) gap above):
- About 150 Commission domiciles are EDDs, annexation areas, school, fire, hospital or drainage districts and wards with sub-parish boundaries, e.g. the Ascension Gonzales annexations, the EBR school districts, St. Martin District 1/2 and the Livingston school tax districts. None has Census geography, so addresses inside them get the town or parish rate. EDD rates are usually 1-2% higher, so this is an under-collection risk at those addresses.
- Lafourche has no parish-wide row: "North Unincorporated Area" 4.65% vs "South Unincorporated Area" 5.40%. The North/South line is not in Census data, so the lowest domicile code (North, 4.65%) is used for all unincorporated Lafourche.
- 70706 "Denham Springs" is a postal city only. No block of the ZIP is inside Denham Springs city limits (Census 2020), so it gets unincorporated Livingston Parish 4% and 9% total. This is correct unless the address lies in Livingston's Ward 2 drainage district or a school tax district (4.5-5.5%), which have no Census geography. The ZIP's 10% row is the St. Helena Parish piece.

**(a) Ours wrong:** none known.
