# Florida (FL) — jurisdiction codes report

**File:** `states/FL.csv`, 68 rows (1 state + 67 counties). Built by `build_FL.py`.
**Status:** complete for rates. Read "Code-system quirks" before using the codes: **Form DR-15 has no county-code field.**

## Sources (all Florida Department of Revenue)
| What | Official URL | How it was fetched |
|---|---|---|
| 2026 surtax rates, component levies, effective and expiration dates, 2026 changes | https://floridarevenue.com/Forms_library/current/dr15dss_26.pdf (Form DR-15DSS, R. 11/25, "for Calendar Year 2026") | Wayback raw capture 2026-01-15: https://web.archive.org/web/20260115171122/https://floridarevenue.com/Forms_library/current/dr15dss_26.pdf |
| DOR county numbers 11–77 | https://floridarevenue.com/property/Documents/CountyNumberMap.pdf ("Florida County Numbers", DOR Property Tax Oversight, dated 10/22/2018) | Wayback capture 2026-05-02 |
| Return mechanics: surtax lines, $5,000 limit, delivery-county rule, out-of-state dealers | https://floridarevenue.com/Forms_library/current/dr15n.pdf (DR-15N R. 10/25) and dr15.pdf (R. 01/25) | Wayback captures 2026-02-08 and 2026-08-28 |
| Cross-check: DOR Address/Jurisdiction DB surtax table and county/place codes (county FIPS) | https://pointmatch.floridarevenue.com/General/DiscretionarySalesSurtaxRates.aspx and /General/PlaceCodes.aspx | Wayback captures 2026-04-21 and 2026-06-12 (page 1 only) |
| County FIPS in the notes | census/national_county2020.txt (US Census) | local file |

**Access problem.** `floridarevenue.com` could not be reached from this machine (DNS failed; the IP from 8.8.8.8 timed out on 443, outside the sandbox too). WebFetch also failed with ENOTFOUND. So each DOR file above is the Internet Archive's unmodified (`id_`) capture of the official DOR URL. The `source_url` column gives the official DOR URL. Before production use, re-download `dr15dss_26.pdf` directly and diff it. The capture's rates match the pointmatch table on every county that page shows (Alachua through Hardee).

## What is complete
- **State row:** 6%. `official_code` is blank on purpose, because the state has no code on the DR-15.
- **All 67 counties.** Each row has:
  - `local_rate`: the total discretionary sales surtax (0 for Citrus and Collier, up to 2% for Hamilton)
  - `combined_rate`: 6% plus the surtax
  - the component levies with their effective and expiration dates, in `notes`
- **Checks:** every county's component levies add up to the printed total. County numbers are unique and cover 11–77 with no gaps.
- **2026 changes** (DR-15DSS page 2):
  - Jackson: 1.5% (the small-county surtax was extended)
  - Martin: now 0.5% (the school surtax expired 12/31/2025)
  - Palm Beach: now 0.5% (the new 0.5% school surtax started 1/1/2026, and the 1% infrastructure surtax was repealed 12/31/2025)
- **Date columns:**
  - `effective_from` is the start date of the most recent component levy. For the three counties that changed in 2026 it is 2026-01-01.
  - `effective_to` is the earliest expiration among the components, which is when the total rate will change.

## Missing or not applicable
- **No city or special-district rows.** Florida has no municipal general sales tax. Discretionary sales surtax is county-level only.
- **Tourist development and transient rental taxes are excluded.** They do not apply to retail vape sales.
- **Flagler is listed twice** in the pointmatch table, once per component levy. The CSV has one Flagler row (1%).

## Code-system quirks a preparer must know
1. **The DR-15 has no county code.** The return only prints a "Surtax Rate," which is the rate of the dealer's own location; out-of-state dealers get no rate printed. All surtax is reported in total:
   - 15(a): the amount over $5,000 per item
   - 15(b): taxable sales not subject to surtax (for example, deliveries into Citrus or Collier)
   - 15(c): taxable sales at a rate different from your county's rate. A remote seller puts all its surtax-bearing sales here.
   - 15(d): total surtax due

   Nothing is broken out by county. The 2-digit code in this file is the **DOR county number** from DOR's official list. It is useful as a stable internal key and matches DOR's county numbering, but you do not type it on the DR-15.
2. **The other DOR code system is 3-digit county FIPS.** DOR's Address/Jurisdiction database (pointmatch) uses county FIPS (for example Miami-Dade = 086) plus 9-digit place feature IDs. The FIPS code is in each row's `notes`.
3. **Miami-Dade is "Dade" (23)** on the DOR county-number list.
4. **Remote-seller rule (DR-15N):** an out-of-state dealer collects surtax at the rate of the county **where the goods are delivered**. It collects none when delivering into a county without a surtax.
5. **$5,000 cap:** surtax applies only to the first $5,000 of each single sale of tangible personal property. This does not apply to services or transient rentals.
6. **Rates change only on January 1.** Surtaxes in Brevard, Charlotte, Liberty and Santa Rosa have components expiring 12/31/2026. Re-pull the calendar-year 2027 DR-15DSS (published around November 2026).
