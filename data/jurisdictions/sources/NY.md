# New York — jurisdiction reporting codes

**Status: COMPLETE** (all general-rate sales tax reporting codes in Publication 718)

## Sources (official, NYS Department of Taxation and Finance)
- Publication 718 (2/25), *New York State Sales and Use Tax Rates by Jurisdiction*, effective March 1, 2025 — https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf (Last-Modified Jan 27 2025; the "current periods" page https://www.tax.ny.gov/pubs_and_bulls/publications/sales/local_rates_current.htm, updated May 12 2025, still points to this edition as current)
- Publication 718-A (12/25), enactment/effective/expiration dates — https://www.tax.ny.gov/pdf/publications/sales/pub718a.pdf (used only to confirm no general-rate change after 3/1/2025)
- Publication 718-C (2/25), clothing & footwear — https://www.tax.ny.gov/pdf/publications/sales/pub718c.pdf (reviewed, not loaded — see quirks)

## Row count: 82
| type | rows |
|---|---|
| state (0021 "New York State only") | 1 |
| county (57 counties outside NYC) | 57 |
| city (18 cities with their own tax + New York City 8081) | 19 |
| borough (Bronx, Kings, New York, Queens, Richmond → all 8081) | 5 |

Duplicate key check: only `8081/borough` repeats (5 times), on purpose — one lookup row per NYC borough, all reporting under 8081. Every rate is between 4% and 8.875%.

## Complete
- Every county and city reporting code printed in Pub 718, with the combined rate. `local_rate` is the combined rate minus the 4% state rate. That figure already includes the county rate, any city rate and the 3/8% MCTD tax. Pub 718 does not break these apart.

## Missing / not included
- **MCTD (Metropolitan Commuter Transportation District, 3/8%)** has no reporting code of its own. It is built into the codes for NYC, Dutchess, Nassau, Orange, Putnam, Rockland, Suffolk and Westchester (including Mount Vernon, New Rochelle, White Plains and Yonkers). No separate row was created.
- **Clothing/footwear under $110 (Pub 718-C)** and **motor fuel/diesel cents-per-gallon (Pub 718-F)** use their own rate schedules and extra ST-100 lines. Neither applies to vapor products, so neither was loaded.
- School-district-level codes (used for some utility taxes) are not part of Pub 718 and do not apply here.

## Quirks a preparer must know
- **Report by jurisdiction code, not ZIP code.** Pub 718 warns that ZIP codes do not follow political boundaries.
- County lines marked "– except" cover only the part of the county **outside** the listed cities. Examples: Cattaraugus 0481 vs Olean 0441 and Salamanca 0431; Oneida County 3010 vs Rome 3015 and Utica 3018; Westchester 5581 vs Mount Vernon 5521, New Rochelle 6861, White Plains 6513 and Yonkers 6511.
- **Yonkers (8.875%) has a different rate** from the rest of Westchester (8.375%).
- The 5 NYC counties (boroughs) all report under **8081**.
- Several additional local rates expire 30 Nov 2027 (Pub 718-A footnotes C, J, m, r, v), and White Plains' additional rates expire 31 Aug 2027. Re-pull Pub 718 after those dates.
- Vapor products also carry NY's separate 20% supplemental tax on vapor products. That is a different tax and return, not a Pub 718 jurisdiction code.
