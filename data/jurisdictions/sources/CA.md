# California (CA): jurisdiction codes report

Data as of 2026-09-15 (Q3 2026 rates, operative since 2026-07-01). Build script and raw files: `raw/CA/` (`build.py`, `parse_a2.py`, `parse_823.py`).

## Sources (all CDTFA, the California Department of Tax and Fee Administration)

| Use | URL |
|---|---|
| District tax area codes (the codes printed on the return) | https://cdtfa.ca.gov/formspubs/cdtfa531a2.pdf (CDTFA-531-A2 Schedule A2 Long Form, REV. 56 (4-26)) |
| County codes for the countywide pool (Schedule B) | https://cdtfa.ca.gov/formspubs/cdtfa531.pdf (CDTFA-531 Schedule B, REV. 9 (5-18)) |
| 5-digit city / unincorporated tax area codes | https://cdtfa.ca.gov/formspubs/cdtfa531fl1.pdf (CDTFA-531-FL1, REV. 14 (3-25)) |
| Full 12-character TAC per jurisdiction, with rate breakdown (primary source for city and unincorporated rows) | CDTFA's own ArcGIS layer behind "Find Your Tax Rate", listed on data.ca.gov as "CDTFA SalesandUseTaxRates Public": https://services6.arcgis.com/snwvZ3EmaoXJiugR/arcgis/rest/services/California_Sales_and_Use_Tax_Rates/FeatureServer/0 (DateStamp 2026-07-01, 558 features) |
| Individual district taxes with operative and sunset dates | https://cdtfa.ca.gov/formspubs/cdtfa823.pdf (CDTFA-823 REV. 17 (4-26)) |
| Rate cross-check | https://cdtfa.ca.gov/taxes-and-fees/SalesTaxRates07-01-26.xlsx (July 1, 2026 city and county rate list) |
| Code changes on 2026-10-01 | https://cdtfa.ca.gov/taxes-and-fees/explanationoftaxratechanges.htm |

## Row counts (1,449 total)

| Type | Rows | Code system |
|---|---|---|
| state | 1 | no code (7.25% base) |
| county | 58 | Schedule B county code, 2 digits (`01` Alameda … `58` Yuba) |
| city | 483 | 5-digit tax area code (482 incorporated cities, plus San Francisco `38001`) |
| unincorporated | 57 | 5-digit tax area code `CC998` (every county except San Francisco) |
| district | 359 | Schedule A2 district tax area code, 3 characters (e.g. `966`, `B47`, `D10`, `099`) |
| special | 450 | no code; individual district taxes from CDTFA-823 |
| transit | 41 | no code; individual district taxes from CDTFA-823 |

- There are no duplicate (state, code, type) rows among the 908 coded rows.
- Every rate is between 0 and 0.15.
- 492 rows have no code on purpose: the state row, plus the 491 individual district taxes.

## Validation

- The sources agree with each other:
  - All 540 five-digit codes in the TAC layer match CDTFA-531-FL1 exactly, in both directions. The only naming difference is "Mt. Shasta" vs "Mount Shasta".
  - All 359 current Schedule A2 codes are used by at least one TAC.
  - Every TAC's district code exists on Schedule A2, and its CountyRate + CityRate equals the Schedule A2 rate.
  - Every county code in the TAC layer equals the Schedule B code.
  - All 483 city combined rates match the July 1, 2026 xlsx, with 0 mismatches.
- CDTFA-823 checks:
  - The district taxes for each jurisdiction add up to its Schedule A2 rate: county taxes plus city taxes equals the city's area rate.
  - None of the listed taxes has a sunset date before 2026-09-15.
- Schedule A2 REV. 56 is dated 4-26, but CDTFA's rate-change page lists no July 1, 2026 changes, so it is still current through 2026-09-30.

## Complete

- All 58 counties, 482 incorporated cities, San Francisco, and 57 unincorporated areas are included, each with its official code and the current combined rate.
- All 359 active Schedule A2 district tax areas are included. Rows marked "Discontinued" on the form were left out.
- All 491 active individual district taxes are included, with rate, operative date and sunset date.

## Missing or limited

- **Individual district taxes have no code.** CDTFA does not publish a separate return code for them (for example BART, or the Alameda County Transportation Commission). They are reported under the Schedule A2 area code, and `paired_code` gives that code where one exists.
- **Communities.** CDTFA-531-FL1 lists communities (e.g. Hollywood, Van Nuys, La Jolla) under their city's code. They are not separate rows; they are listed in the city row's notes.
- **Sub-areas.** Sixteen cities have extra 12-character TACs whose last four digits are not `0000` (redevelopment or sub-areas, e.g. Colton has four). They have the same codes and rate, so they are merged into one row, with every TAC listed in the notes.
- **2026-10-01 codes are not rows.** Only codes in effect today are included. The 61 district codes being replaced on 2026-10-01 have `effective_to = 2026-09-30` and a note naming the new code and rate. Examples: LA County `B47 -> D29` (10.25%), Alhambra `B48 -> D30`, Red Bluff `424 -> E05`. Five jurisdictions that currently have no own district code get new codes: Perris `E03`, Calabasas `D41`, El Segundo `D54`, San Marino `D87` and Temple City `D96`. These are noted on their city rows. The app will need these new codes for Q4 2026.

## Code-system quirks a preparer must know

1. **Three code systems appear on one return.**
   - **Schedule B:** 2-digit county code. An out-of-state or remote seller that ships from outside California (title passing outside the state) uses this to allocate the 1.25% local use tax, by the ship-to county, through the countywide pool.
   - **Schedule A2:** 3-character district tax area code. Taxable sales above 7.25% are reported by the delivery area.
   - **Schedules C, F and H:** 5-digit tax area code, used only for direct allocation. Examples: a place of business in California, or use-tax sales of $500,000 or more, which go directly to the city of first use.
2. **Report each sale on only one Schedule A2 line.** A city's A2 rate already includes the county district taxes, so sales in a city with its own code go on the city line only. Cities without their own code use the county's A2 code; the county district row lists which cities those are.
3. **Some counties have no countywide A2 line.** Del Norte, Kern, Monterey, Santa Cruz and Yuba have an "Unincorporated Area" A2 code instead (`831`, `A20`, `C27`, `A89`, `739`), because a tax applies only outside city limits. Many other counties (e.g. El Dorado, Glenn, Kings, Lake, Placer, Shasta, Ventura, Yolo) have no county district tax at all. Their unincorporated area and non-taxing cities report at 7.25% on line A2/A3.
4. **A2 codes change whenever a rate changes.** CDTFA issues a new code (e.g. Oakland `D10`, Culver City `D16`) and marks the old one "Discontinued". The old code is still used only for adjustments to earlier periods. So codes must carry effective dates; do not treat them as permanent IDs.
5. **A2 codes are 3-character text** and can have leading zeros (`099`, `014`, `023`, `026`, `029`, `030`, `031`, `037`, `038`, `066`). Store them as strings.
6. **The 12-character TAC** from Find Your Tax Rate is made of three parts: the 5-digit local code, the 3-character A2 code, and a 4-digit sub-area. The first two parts are the codes to use on the return.
7. **"Jurisdiction codes" PDF.** CDTFA also publishes https://cdtfa.ca.gov/taxes-and-fees/jurisdictioncodes.pdf, but it says it must **not** be used for returns, so it was not used.
8. **Rates in the data.**
   - County `local_rate` is the sum of the county's countywide district taxes.
   - City `local_rate` covers only the taxes the city imposes itself.
   - Unincorporated-area `local_rate` is all district taxes in that area.
   - District-area `local_rate` is the Schedule A2 rate (the total district rate).
   - `combined_rate` always includes the 7.25% base.
   - The 1.25% local share inside the 7.25% is not a separate rate.
