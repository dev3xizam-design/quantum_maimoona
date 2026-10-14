# New Mexico (NM) - rate table sources

**As of:** 2026-10-01 (schedule in force 2026-07-01 through 2027-06-30; NM local GRT rates change only Jan 1 / Jul 1). Builder: `scripts/rates/states/NM.ts`.

## Sources (official, fetched 2026-10-14)
| File | Official URL | Notes |
|---|---|---|
| `data/rates/raw/NM/GRT-Rate-Schedule-2026-07-01.xlsx` | TRD Forms & Publications library ("Gross Receipts and Compensating Tax Rate Schedule, Effective July 1, 2026 through June 30, 2027"), served at https://klvg4oyd4j.execute-api.us-west-2.amazonaws.com/prod/PublicFiles/34821a9573ca43e7b06dfad20f5183fd/43c5ec78-eeed-4153-997a-1d8c921b276c/Rate%20Schedule%20July1,2026%20-%20June%2030,%202027.xlsx (TRD's RealFile document host, linked from https://www.tax.newmexico.gov/forms-publications/) | 282 location codes with TOTAL rates (state 4.875% + local). Read directly by the builder. |
| Quantum jurisdiction directory | built from the same schedule | Names, type (municipality / county remainder / district / tribal) and county per location code. All 282 codes' rates were checked against the schedule: identical. |

No Jan-1-2027 schedule applies to an as-of date of 2026-10-01.

## Method
Per Census 2020 piece: the municipality's location rate when the piece is in one (matched by name + county; multi-county municipalities - Rio Rancho, Edgewood, Española, Mosquero - have a code per county portion), else the county's "Remainder of County" rate. Split: State 4.875%, local in City (municipality) or County (remainder). Not applied: TIDD/TID/TIF (MRA) districts and tribal-land codes (boundaries not in Census places).

## Validation vs Avalara (Sales Invoices since 2026-07-01)
**4 / 4 keys match (100%).** No mismatches.
