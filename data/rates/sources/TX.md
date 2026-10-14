# Texas (TX) - rate table sources

**As of:** 2026-10-01 (Comptroller quarter "Oct26"). Builder: `scripts/rates/states/TX.ts`.

## Sources (official, fetched 2026-10-14, saved in `data/rates/raw/TX/`)
| File | Official URL | What it gives |
|---|---|---|
| `city-rates-Oct26.xlsx` (sheet `Oct26`, 2,998 rows) | https://comptroller.texas.gov/taxes/sales/docs/city-rates.xlsx | One row per (place, county portion): city, county, up to 3 SPDs, 2 transit taxes and the total. Includes unincorporated named places (no city code). |
| `spd.html` | https://comptroller.texas.gov/taxes/sales/spd.php | SPD codes, rates, effective dates, boundary type (Countywide / Citywide / Other) |
| `mta.html` | https://comptroller.texas.gov/taxes/sales/mta.php | Transit authorities and the unincorporated areas each covers |

The rate file is used directly, so it is fresher than Quantum's jurisdiction directory (built from the Jul26 sheet). Rate changes effective 2026-10-01 picked up this way (Jul26 directory -> Oct26 file): Beckville 1% -> 2%, Bellmead 1.5% -> 1.25%, Ellinger 1% -> 1.5%, Frost 1% -> 1.5%, Naples 1.5% -> 1.25%, Northlake 2% -> 1.5%, Orchard 2% -> 1.75%, Payne Springs 2% -> 1.75%, Roscoe 2% -> 1.75%, Waller/Waller-Harris ESD 200 2% -> 1%.

## Method
Per Census 2020 (ZCTA, county, place) piece:
- Place with a row in the rate file for that county: that row's components. Several rows per (place, county) = base area plus sub-areas inside "Other"-boundary SPDs; the base row (city row, fewest taxes, first listed) is used.
- City portion in a county the file doesn't list (32, e.g. Garland in Rockwall): the city's own taxes + this county's.
- Elsewhere: State 6.25% + county tax (as the rate file reports it for that county) + countywide SPDs in force on 2026-10-01 + transit for counties whose unincorporated area the MTA covers (fully or "parts of" - included).
- "Other"-boundary SPDs (most ESDs, MUD/MDDs, Woodlands Township) and combined areas need boundary maps Census doesn't carry; not applied, so those addresses rate low.
- 2% local cap enforced (16 pieces trimmed).
- 32 incorporated places have no city tax row (no local sales tax) and are rated county-only.

## Validation vs Avalara (Sales Invoices since 2026-07-01)
**94 / 105 (state, ZIP, city) keys match (89.5%).** All 11 mismatches are (c) boundary cases; no case found where our rate was wrong per the Comptroller file, and none where Avalara contradicted it.

| ZIP | City | Avalara | Ours | Class | Evidence |
|---|---|---:|---:|---|---|
| 77380 | Spring | 7.25% | 6.25% | (c) | Address inside The Woodlands Township SPD (1%, "Other" boundary); ZIP is unincorporated Montgomery Co. |
| 77429 | Cypress | 8.25% | 7.25% | (c) | Rate file rows "Cypress / Harris" = METRO 1% + a Harris Co ESD 1% (ESD 9/13/15/21); ESD boundary not mappable, Census 2020 has no Cypress CDP. |
| 76247 | Justin | 6.25% | 8.25% | (c) | Postal city Justin, address outside city limits (Denton Co has no county tax). Our ZIP has the unincorporated 6.25% row. |
| 77459 | Missouri City | 6.25% | 8.25% | (c) | Address in Sienna (unincorporated, Fort Bend); our ZIP has a Sienna row at 6.25%. |
| 76557 | Moody | 6.75% | 8.25% | (c) | Outside Moody city limits (McLennan county 0.5% only). |
| 76073 | Paradise | 6.75% | 8.25% | (c) | Outside Paradise city limits (Wise county 0.5% only). |
| 77493 | Katy | 7.25% | 8.25% | (c) | Outside Katy city limits, inside METRO unincorporated area. |
| 75650 | Hallsville | 6.25% | 8.25% | (c) | Outside Hallsville city limits. |
| 78669 | Spicewood | 8.25% | 7.25% | (c) | Inside Briarcliff (city row 8.25% exists in our ZIP). |
| 78619 | Driftwood | 8.25% | 6.75% | (c) | Inside Dripping Springs (row exists in our ZIP). |
| 75009 | Celina | 7.75% | 8.25% | (c) | Address inside Weston (1.5%), postal city Celina; Weston row exists in our ZIP. |

(c) cases resolve with an address-level lookup (rooftop geocode -> city limits/SPD); the ZIP table gives the postal city's rate.
