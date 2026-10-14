# South Carolina (SC) - rate sources

As of: **2026-10-01**. Built by `scripts/rates/states/SC.ts`.

## What this seller must collect

The state's 6% plus every county or municipal local tax at the delivery address (SC is destination-sourced for delivered sales). This includes remote sellers over the $100,000 threshold. Avalara does the same for this store, and so do we.

## Sources

| what | source | publication | saved as |
|---|---|---|---|
| Combined rate per county (the official total, used as a check) | SCDOR Sales & Use page, local rate table, column "5/1/26 & after": https://dor.sc.gov/sales-and-use | Latest notices: Lexington SD extension (2026-03-01), Aiken CP reimposed + Williamsburg new CP (2026-05-01). **No notice effective 2026-10-01.** Fetched 2026-10-14 | `data/rates/raw/SC/sales-and-use.html` |
| Map of counties with local taxes | SCDOR ST-500 | fetched 2026-10-14 | `data/rates/raw/SC/ST500.pdf` |
| Components (LO, CP, ECI, SD, TT, TDT codes and rates) | SCDOR ST-389 local tax codes, as captured in the jurisdiction directory SC rows | directory, checked 2026-10-14 | `data/jurisdictions/us-jurisdictions.csv` |
| ZIP to county/town evidence | Census 2020 blocks | 2020 | - |

**Freshness check (2026-10-14):** for all 46 counties, state 6% + the directory's county-wide taxes + Local Option equals the SCDOR "5/1/26 & after" combined rate exactly. That includes the 2026 changes: Williamsburg 8%, Clarendon 7%, Lexington 7%. The directory rows are current, so no override file is needed. Horry-Myrtle Beach 9% = Horry 8% + Myrtle Beach Tourism Development Tax 1%, which matches too.

Mapping:
- County-wide taxes (CP, ECI, SD, TT) go in as "Special", as Avalara labels them.
- Local Option goes in as "City" inside a municipality and "County" outside, applied only in counties that levy LO.
- The Myrtle Beach TDT applies inside city limits only.
- Not modelled: the Catawba tribal tax (reservation land is not a Census place).

## Validation against Avalara (2026-07-01 .. 2026-09-30)

- Keys (state, ZIP, city): **16 / 19** match (84.2%). Invoices: **19 / 24**.
- In all 3 missed keys our table holds Avalara's rate in another row of the same ZIP.

### Mismatches

**(c) Boundary ambiguity:** all 3. Each is a town split across counties with different rates. A ZIP + city cannot say which side the address is on.

| ZIP | city | Avalara | ours (city row we pick) | why |
|---|---|---|---|---|
| 29644 | Fountain Inn | 8% (Laurens side) | 6% (Greenville side, most of the town's population) | Fountain Inn lies in Greenville (6%) and Laurens (8%) counties |
| 29673 | Piedmont | 6% x2, **7% x1 for the same ZIP+4 7354** | 7% (Anderson side) | Piedmont lies in Anderson (7%) and Greenville (6%). Avalara itself charged both rates for one ZIP+4 |
| 29651 | Greer | 6% x2, 7% x1 (ZIP+4 6269) | 6% | Greer lies in Greenville (6%) and Spartanburg (7%) |

**(a) Ours wrong:** none. **(b) Avalara wrong:** none found.
