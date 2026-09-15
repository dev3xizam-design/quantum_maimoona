# New Mexico (NM): Gross Receipts Tax (GRT) location codes

**Code system:** NM Taxation & Revenue Department (TRD) GRT **location code**, format `CC-NNN` (for example 02-100 is Albuquerque).
- The code goes in Column B of the TRD-41413 GRT return (Schedule A), next to the municipality/county name in Column A.

**Rate period:** effective 2026-07-01 through 2027-06-30. It is current on 2026-09-15.
**File:** `states/NM.csv`, 289 rows.

## Sources (official TRD)
| Source | Used for |
|---|---|
| "Rate Schedule July1,2026 - June 30, 2027.xlsx" in the TRD Forms & Publications library: Current and Historic Tax Rates > Gross Receipts and Compensating Tax Rates > Gross Receipts Tax Rate Schedules > Current Year. Direct file URL: https://klvg4oyd4j.execute-api.us-west-2.amazonaws.com/prod/PublicFiles/34821a9573ca43e7b06dfad20f5183fd/43c5ec78-eeed-4153-997a-1d8c921b276c/Rate%20Schedule%20July1,2026%20-%20June%2030,%202027.xlsx | Every location code and total rate |
| https://www.tax.newmexico.gov/forms-publications/ | The library page the file above is served from |
| https://realfile.tax.newmexico.gov/trd-41413ins.pdf (TRD-41413 instructions, Rev. 07/01/2025) | Out-of-state codes 77-777 and 88-888, destination sourcing, how codes are used on the return |

About the file URL:
- tax.newmexico.gov serves its document library through the "RealFile" document system. The download link is on an AWS API host owned by that system's vendor, reached from TRD's own Forms & Publications widget (TRD account GUID 34821a95…). It is the TRD-published file, not a third-party copy.
- The xlsx rate cells are formulas pointing to an external TRD workbook. The saved (cached) values were used.

Downloads and the build script are in `work/NM/` (`build_nm.py`).

## Row counts
| Type | Rows | What |
|---|---|---|
| state | 1 | 4.875% state GRT. No code of its own (blank). |
| county | 33 | "Remainder of County" code for all 33 counties, plus Los Alamos (consolidated city/county, 32-032) |
| municipality | 114 | Incorporated cities, towns and villages. Separate county-portion codes for multi-county municipalities: Edgewood ×3, Rio Rancho ×2, Española ×2, Mosquero ×2. |
| district | 65 | TIDD/TID/TIF (MRA) districts, airports, industrial parks, State Fairgrounds, water and sanitation districts, Alamogordo-owned land |
| special | 76 | 74 tribal-land codes ((1) and (2) variants per pueblo/nation per county) plus the special out-of-state codes 77-777 and 88-888 |

Validation passed:
- 33 counties present
- no duplicate codes
- every combined rate is between 0 and 0.15 (highest: Taos Ski Valley 20-414/20-430 at 9.4375%, then Red River / El Prado-b / El Valle-b at 9.425%)
- codes are kept as text with the hyphen

## Completeness
**Complete:** every location code on the July 1, 2026 – June 30, 2027 TRD rate schedule, plus the two out-of-state reporting codes.

Not included:
- **"Special Notation" / special rate codes** (TRD-41413 instructions tables T1, T3, T4; for example medical code "M" and utility codes). They are not locations and are account-specific.
- **Deduction-reporting special location codes** referred to in the GRT Filer's Kit. They are not jurisdictions.
- **Address-to-code boundaries.** Use TRD's GRT Location Code and Rate Finder map or API.

## Quirks a preparer must know
1. **The schedule publishes TOTAL rates** (state 4.875% + county + municipal + district).
   - `combined_rate` is the published figure.
   - `local_rate` was **derived** as total minus 4.875% and is flagged in `notes`. TRD does not publish local-only rates in this file.
2. **Destination sourcing** has applied since 2021-07-01. A remote seller shipping goods into NM reports each sale under the **customer's** location code.
   - 88-888 (out-of-state, 4.875%) is for professional services or goods shipped *out of* NM.
   - 77-777 is for R&D services performed outside NM.
   - Do not use either for in-state deliveries.
3. **Tribal codes come in pairs.**
   - (1) is for sales to tribal entities or members.
   - (2) is for sales to non-members by non-members.
   - **Isleta Pueblo (1)** is listed at a 0% total rate. **Isleta (2)** has no code of its own: TRD says to use the county's remainder code (02-002, 14-014, 22-022, 25-025). This is noted on those rows.
4. **Footnote letters are part of TRD's names, not the codes.**
   - a = Pueblo land inside city limits
   - b = inside the water district and the city limits (El Prado 20-425, El Valle 20-429)
   - c = property owned by the 19 Pueblos
   - d = land owned by Alamogordo outside the city (26-508, 15-322)
   - They are stripped from `jurisdiction_name` and explained in `notes`.
5. **Taos Ski Valley:** TRD says to report *all* GRT activity under 20-430 (TIDD), not 20-414.
6. **Rates marked `*` changed on 2026-07-01:** Colfax County and all its locations, Los Alamos, Los Ranchos de Albuquerque, Bernalillo (city), Elephant Butte.
   - Rates now normally change only on July 1 each year. January changes happen only in special situations.
7. **Data oddity:** TRD's file gives Taos/Taos Pueblo (2) 20-916 as 0.0749995, versus 0.075 for its (1) twin. It is kept as published and flagged.
8. **Compensating tax:** the schedule is titled "Gross Receipts and Compensating Tax Rate Schedule". The file provides no separate compensating-tax-only rate per location.
