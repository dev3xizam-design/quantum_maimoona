# North Dakota (ND) — jurisdiction codes

**File:** `states/ND.csv` — 565 rows (built by `scripts_dakne/build_nd.py`)
**Status:** Complete: 151 taxing cities and 8 taxing counties with ND local codes, rates as of July 1, 2026. SST FIPS rows cover all 352 cities and 53 counties in the SST file, including 0% ones. One SST place FIPS (58700, 0%) could not be named.

## Sources (all official OSTC / SST)
- ND Office of State Tax Commissioner "Local Taxes by Location Guideline — Rates Effective July 1, 2026" (Content Revised 6-2026), the primary source for codes, rates, max-tax caps and compensation: https://www.tax.nd.gov/sites/www/files/documents/guidelines/business/sales-use/local-taxes-by-location.pdf
- ND OSTC "North Dakota FIPS Codes, April 1, 2026", the official pairing of ND Local Code with FIPS: https://www.tax.nd.gov/sites/default/files/documents/forms/business/sales-use/local-jurisdiction-rates/2026-jurisdiction/fips-codes-4-1-2026.pdf
- SST rate file NDR2026Q4AUG14.csv and boundary file NDB2026Q4AUG14.zip: https://www.streamlinedsalestax.org/ratesandboundry/
- Census 2020 place/county files.

**Access caveat:** tax.nd.gov and nd.gov timed out on TCP 443 from this network, and WebFetch was refused too. The two OSTC PDFs came from the Internet Archive's unmodified (`id_`) captures of those exact URLs:
- guideline: https://web.archive.org/web/20260721111008id_/… (captured 2026-07-21)
- FIPS list: https://web.archive.org/web/20260609054310id_/… (captured 2026-06-09)

They are the official documents byte-for-byte, but a preparer should re-download from tax.nd.gov to confirm. **No FIPS list for July 1, 2026 was found in the archive.** FIPS pairing therefore uses the April 1, 2026 list. All 159 July-guideline codes appear on that list, so no new jurisdictions were added between April and July.

## Row counts
| code_system | type | rows |
|---|---|---|
| ND OSTC local code | city | 151 |
| ND OSTC local code (5xx) | county | 8 |
| SST FIPS state (38) | state | 1 |
| SST FIPS place (151 non-zero + 201 at 0%) | city | 352 |
| SST FIPS county (8 non-zero + 45 at 0%) | county | 53 |

Cross-checks: all 151 city and 8 county OSTC rates equal the current SST rates. Nine cities changed rate between the April list and the July guideline (Beach, Devils Lake, Drayton, New Leipzig, New Town, Northwood, Scranton, Steele, Wishek), and SST agrees with the July rates.

## Code-system quirks a preparer must know
- **ND local codes are 3-digit numbers.** Cities use 1xx–2xx (e.g. Grand Forks 101, Bismarck 102, Minot 103, Fargo 105). Counties use 501–508: Cass 501, Walsh 502, Steele 503, Williams 504, Ward 505, Burleigh 506, Morton 507, Hettinger 508.
- **County tax stacks on top of state and city tax.** Guideline footnotes list the taxing cities inside taxing counties (e.g. Fargo = city 105 + Cass 501). City rows carry "ALSO subject to X County tax" where the guideline shades them.
- **Maximum tax / refund caps:** many jurisdictions cap local tax per sale (e.g. $25/sale), or have no cap after a given date. Retailers may collect the full amount (the customer claims a refund) or only up to the cap, but must be consistent. The cap history is copied into notes for each code. Some jurisdictions also allow **permit holder compensation**, also in notes.
- Some cities impose "Sales and Gross Receipts only" (no use tax), e.g. Bisbee; the tax type is in notes. A few exclude new farm machinery.
- **Upcoming change:** the SST file shows **Minot (103 / FIPS 53380) rising from 2% to 2.5% effective 2026-10-01**. Current rows keep 2%, with an UPCOMING note on both Minot rows.
- City lodging, lodging & restaurant, and motor vehicle rental taxes are filed on separate forms and have no codes in the guideline, so they are not included. None apply to vape sales.
- DOR rows carry 2026-07-01 → 2026-09-30 (the quarterly guideline).

## Missing / not included
- SST place FIPS **58700** (0% rate, begin 2023-10-01). It is not in Census 2020 places. The boundary file places it in Cass County, ZIP 58104. It is left with a blank name.
- An October 1, 2026 OSTC guideline/FIPS list could not be obtained (site unreachable). The only known Q4 change, from the SST file, is Minot.
