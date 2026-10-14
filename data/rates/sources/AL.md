# Alabama (AL) - rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Built by `scripts/rates/states/AL.ts`.

## What this seller must collect

A remote seller over Alabama's $250,000 threshold must do one of two things:

1. Enroll in the **Simplified Sellers Use Tax (SSUT)** program and collect a flat **8%** (Form 2620). The 8% replaces every state and local tax on the sale (Code of Ala. 40-23-191 to -199; ALDOR SSUT page). A seller has to apply and be accepted before it can use the 8%.
2. Otherwise, collect **state 4% + local sellers use tax** at the delivery address, and report it on Form 2100 through ONE SPOT.

Quantum registers this store on **Form 2100** at myalabamataxes (`src/lib/seed-data.ts`, "4% state + local"). That is option 2, so the builder uses state plus local sellers use. If the store is actually enrolled in SSUT, set every AL row to `SSUT_RATE` (8%) in `AL.ts`. **Either way, state-only 4% is not a lawful rate for this seller.**

> **FLAG FOR THE USER:** Avalara charged **4.000% (state only)** on all 29 AL invoices from July to September 2026. That under-collects under both options. Under option 2 the gap on these 29 invoices is **$113.29** of local tax that was never collected. Please confirm whether the store is enrolled in SSUT: 8% flat if yes, state + local if no.

## Sources

| what | source | publication | saved as |
|---|---|---|---|
| Local sellers use rates (TaxType `SU`, Rate Type `GENER`) | ALDOR "Local cities and counties tax rates text file", `taxrates_current.csv`: https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/ | page says "Updated for October 2026" (page modified 2026-10-05); fetched 2026-10-14 | `data/rates/raw/AL/taxrates_current.csv` (+ `taxrates.csv` history, `page.html`) |
| File layout (codes, Rate is a percent, CountyCode links) | ALDOR "taxrates file help": https://www.revenue.alabama.gov/sales-use/taxrates-file-help/ | fetched 2026-10-14 | - |
| State rate 4% (general) | ALDOR state rates page; the jurisdiction directory's AL state row | fetched 2026-10-14 | `data/jurisdictions/us-jurisdictions.csv` |
| ZIP to county/town evidence | Census 2020 blocks (`data/rates/derived/zcta-geo.csv`) | 2020 | - |

How the builder applies them:
- A town with an SU row gets City = the town's rate, plus County = the county codes its rows link to, minus its police-jurisdiction codes. For example, Opelika takes "LEE CO CL AUB & OPE & PHENIX" 1%, not "LEE COUNTY PJ OPELIKA" 3%.
- Outside towns, County = the plain county code plus any UNINC, "EXC <cities>" or "COUNTY-WIDE" code.
- ALDOR county numbers are matched by name, not FIPS ("SHELBY" is 58 and "ST CLAIR" is 59, which is not FIPS order).
- Winston County has no SU rows, so it is state only.

## Validation against Avalara (2026-07-01 .. 2026-09-30)

- Keys (state, ZIP, city): **0 / 23** match. Invoices: **0 / 29**.
- The state component matches on every invoice. Every difference is the local sellers use tax, which Avalara did not charge.

### Mismatches

**(b) Avalara wrong per the official source:** all 23 keys. In each case Avalara charged 4% only, and the official ALDOR Oct-2026 file gives the local rates below. Evidence: `taxrates_current.csv` (Updated for October 2026), the SU GENER rows named in the components column.

| ZIP | city | county | invoices | Avalara | ours | our components | Avalara's rate exists elsewhere in the ZIP? |
|---|---|---|---:|---:|---:|---|---|
| 35007 | Alabaster | Shelby | 1 | 4.0% | 10.0% | Alabama 4.0% + Alabaster 5.0% + Shelby County 1.0% | no |
| 35043 | Chelsea | Shelby | 1 | 4.0% | 10.0% | Alabama 4.0% + Chelsea 5.0% + Shelby County 1.0% | no |
| 35094 | Leeds | Saint Clair | 1 | 4.0% | 10.0% | Alabama 4.0% + Leeds 4.0% + Jefferson County 2.0% | no |
| 35111 | Mc Calla | Tuscaloosa | 1 | 4.0% | 6.0% | Alabama 4.0% + Jefferson County 2.0% | no |
| 35115 | Montevallo | Shelby | 1 | 4.0% | 10.0% | Alabama 4.0% + Montevallo 5.0% + Shelby County 1.0% | no |
| 35180 | Warrior | Jefferson | 1 | 4.0% | 10.0% | Alabama 4.0% + Warrior 4.0% + Jefferson County 2.0% | no |
| 35216 | Vestavia Hills | Jefferson | 1 | 4.0% | 10.0% | Alabama 4.0% + Vestavia Hills 4.0% + Jefferson County 2.0% | no |
| 35233 | Birmingham | Jefferson | 2 | 4.0% | 10.0% | Alabama 4.0% + Birmingham 4.0% + Jefferson County 2.0% | no |
| 35501 | Jasper | Walker | 2 | 4.0% | 9.5% | Alabama 4.0% + Jasper 3.5% + Walker County 2.0% | no |
| 35563 | Guin | Marion | 1 | 4.0% | 9.0% | Alabama 4.0% + Guin 3.0% + Marion County 2.0% | no |
| 35616 | Cherokee | Colbert | 1 | 4.0% | 9.0% | Alabama 4.0% + Cherokee 3.5% + Colbert County 1.5% | no |
| 35750 | Hazel Green | Madison | 1 | 4.0% | 5.5% | Alabama 4.0% + Madison Co Exc Cl Huntsville 1.0% + Madison County County-Wide Tax 0.5% | no |
| 35901 | Gadsden | Etowah | 2 | 4.0% | 10.0% | Alabama 4.0% + Gadsden 5.0% + Etowah County 1.0% | no |
| 35904 | Gadsden | Etowah | 1 | 4.0% | 10.0% | Alabama 4.0% + Gadsden 5.0% + Etowah County 1.0% | no |
| 35959 | Cedar Bluff | Cherokee | 1 | 4.0% | 10.0% | Alabama 4.0% + Cedar Bluff 2.5% + Cherokee County 3.5% | no |
| 36203 | Oxford | Calhoun | 1 | 4.0% | 10.0% | Alabama 4.0% + Oxford 5.0% + Calhoun County - Cl 1.0% | no |
| 36207 | Anniston | Calhoun | 1 | 4.0% | 10.0% | Alabama 4.0% + Anniston 5.0% + Calhoun County - Cl 1.0% | no |
| 36301 | Dothan | Houston | 1 | 4.0% | 9.0% | Alabama 4.0% + Dothan 4.0% + Houston County 1.0% | no |
| 36303 | Dothan | Houston | 3 | 4.0% | 9.0% | Alabama 4.0% + Dothan 4.0% + Houston County 1.0% | no |
| 36320 | Cottonwood | Houston | 1 | 4.0% | 8.0% | Alabama 4.0% + Cottonwood 3.0% + Houston County 1.0% | no |
| 36530 | Elberta | Baldwin | 1 | 4.0% | 11.0% | Alabama 4.0% + Elberta 4.0% + Baldwin County 3.0% | no |
| 36567 | Robertsdale | Baldwin | 2 | 4.0% | 9.0% | Alabama 4.0% + Robertsdale 2.0% + Baldwin County 3.0% | no |
| 36801 | Opelika | Lee | 1 | 4.0% | 9.0% | Alabama 4.0% + Opelika 4.0% + Lee Co Cl Aub & Ope & Phenix 1.0% | no |

**(c) Boundary ambiguity** (on top of the (b) gap above):
- 35094 Leeds (Avalara: St. Clair County) and 35111 McCalla (Avalara: Tuscaloosa County): the ZIP spans two counties, and Census population puts the primary piece in Jefferson County.
- Police jurisdictions are not modelled. ALDOR's PJ rates (often half the city rate) apply outside city limits, and PJ boundaries have no Census geography, so addresses in a PJ get the county-only rate here (under-collection risk).
- 142 town pieces lie in towns with no SU row. They get the county's CL code if it has exactly one, else its general code.
- The Escambia County unincorporated rate is 2% ("ESCAMBIA COUNTY") plus 5% ("EXC 5 CITIES") = 7% county. The file names both codes without saying whether they stack. Verify with ALDOR before relying on it.

**(a) Ours wrong:** none known.
