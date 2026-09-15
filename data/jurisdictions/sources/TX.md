# Texas (TX): local sales/use tax jurisdiction codes

**Code system:** Texas Comptroller of Public Accounts 7-digit **local code**. Sales and use tax returns (Form 01-114 and the Webfile local-code schedule) report local tax by these codes.
**Rates effective:** July 1, 2026 quarter. That quarter is current on 2026-09-15; the next changes take effect 2026-10-01.
**File:** `states/TX.csv`, 1,938 rows.

## Sources (all from comptroller.texas.gov)
| Source | Used for |
|---|---|
| https://comptroller.texas.gov/taxes/sales/docs/city-rates.xlsx (sheet `Jul26`) | Main city list: codes, rates, county portions, total rates |
| https://comptroller.texas.gov/taxes/sales/city.php (web table) | Cross-check; the Error Tax and Unspecified pseudo-codes |
| https://comptroller.texas.gov/taxes/sales/docs/city-rates.pdf ("TEXAS SALES AND USE TAX RATES – July 2026") | Third cross-check, used to break ties |
| https://comptroller.texas.gov/taxes/sales/county.php | All 125 county codes, effective dates, rate footnotes |
| https://comptroller.texas.gov/taxes/sales/mta.php | All 10 transit authorities (MTA/CTD/CTA/ATD), with member cities |
| https://comptroller.texas.gov/taxes/sales/spd.php | Special purpose districts (SPDs): codes, rates, effective dates, boundary text |
| https://comptroller.texas.gov/taxes/sales/combined-area.php | Combined-area codes and their companion codes |
| https://comptroller.texas.gov/taxes/sales/quarterly-updates/jul-2026.php and 2026-oct.php | Checked that July 2026 changes are included and October 2026 changes are not |
| https://comptroller.texas.gov/taxes/sales/remote-sellers.php | Single local use tax rate for remote sellers |

Downloads and the build script are in `work/TX/` (`build_tx.py`). The full cross-check log is `work/TX/discrepancies.txt`.

## Row counts
| Type | Code prefix | Rows |
|---|---|---|
| state | none | 1. The state has no local code, so `official_code` is intentionally blank. |
| city | 2xxxxxx | 1,176 |
| county | 4xxxxxx | 125. The county page says "125 counties impose a county sales and use tax". |
| transit | 3xxxxxx | 10: 6 MTAs, 2 CTDs, 1 CTA, 1 ATD |
| special: SPDs | 5xxxxxx | 505 |
| special: combined areas | 6xxxxxx | 113 |
| special: pseudo-codes | 2/3/4/5 + 99999x / 888/999 | 8 (Error Tax and Unspecified at city, county, transit and SPD level) |

Validation passed:
- no duplicate (state, code, type) rows
- every local rate is between 0 and 0.02
- every combined rate is at most 0.0825
- every code is 7 digits, kept as text

## Completeness
**Complete** for every city, county, transit authority, SPD and combined area the Comptroller published for the July 2026 quarter.

### Items needing preparer attention
These are conflicts between the Comptroller's own publications. Each affected row has a note.
- **Pine Island (city):** the xlsx prints **2237067**, but city.php and the PDF print **2237069**. I used 2237069 (2 of 3 sources). Confirm with the Comptroller.
- **Springtown/Parker Co ESD 1-A (combined area):** the xlsx prints 6184523. combined-area.php, city.php and the PDF print **6184623**, which I used.
- **Hutto/Williamson Co ESD 3:** the PDF prints 6246110. The other three sources print **6246610**, which I used.
- **Rate conflicts, settled by majority of sources plus arithmetic against the published total rate:**
  - Melissa 2043170: city.php says 2%; xlsx and PDF say **1.5%**.
  - Waller/Waller-Harris ESD 200 (6101605): xlsx says 1%; combined-area.php and city.php say **2%**.
  - Hutto/Travis ESD 2 (6227622): PDF says 2%; the others say **1%**.
  - Winkler County: one xlsx row has a 0.05 typo; the correct rate is **0.5%**.
  - Cass Co ESD 3 (5034536) and Williamson Co ESD 2 (5246674): xlsx says 1%; spd.php says **2%**.
    - Both are two-rate districts. The lower-rate part has its own "-A" code.
- **SPD 5108564, Sullivan City MDD:** city.php misprints the code as 2108564. spd.php's code is used.
- **Forney CCPD 5129612, Melissa Crime Control 5043553, Melissa Fire Control 5043562:** these appear only in spd.php's citywide table, not its by-county table. They are included.
  - As a result, the SPD row count (505) is 2 more than the page's own "503 SPDs" statement.
- **6105601, Austin/Dripping Springs Lib Dist/Hays Co:** in city.php and the PDF, but not on combined-area.php or in the xlsx. Included and flagged "verify".
- **Excluded as stale:** each appears only in the city.php web table (not the xlsx, PDF, SPD page or combined-area page):
  - 5081501 Streetman Crime Control District
  - 6015600 Bulverde/Comal Co ESD 3
  - 6079603 Fulshear/Fort Bend Co Assistance District 7
- **Pseudo-codes:** Error Tax 2254995 / 4999968 / 3999986 / 5888506 and Unspecified 2255002 / 4999977 / 3999995 / 5999502.
  - They are listed at the end of the Comptroller's rate table. The table does not say when to use them.
  - They are included with a "confirm before use" note.

### Missing or not provided
- **City effective dates:** the city table has none, so `effective_from` is blank for cities. Counties, transit, SPDs and combined areas have dates.
- **Address-to-jurisdiction boundaries:** not in these files. Use the Comptroller's Sales Tax Rate Locator (GIS).
- **SPD "Other" boundaries** are described in `notes` using the Comptroller's own wording.
- **SST:** Texas is not a Streamlined Sales Tax member, so there are no FIPS-based rates.

## Code-system quirks a preparer must know
1. **Code prefix = jurisdiction type:** 2 = city, 3 = transit, 4 = county, 5 = SPD, 6 = combined area. The next three digits are the Comptroller's county number in alphabetical order (001 Anderson … 254 Zavala).
2. **No paired codes.** Each local authority is reported on its own line with its own code.
   - A city in several counties has **one** city code. Each county portion adds that county's code only if the county levies tax (the xlsx lists county portions).
3. **Combined areas (6xxxxxx):** where a city annexed part of an SPD and the local total would exceed 2%, report the combined-area code **instead of** the city code (and the SPD/county code it absorbs).
   - Some combined areas still need companion codes reported separately (for example a county or MTA code). These are listed in `notes`.
4. **Two-rate SPDs:** some SPDs have two codes, such as "ESD No. 9" at 2% and "ESD No. 9-A" at 1.5% where the district overlaps another taxing entity. Report the code for the delivery location.
5. **2% local cap:** the combined local rate at any address never exceeds 2% (8.25% total).
6. **Remote sellers, relevant to Maximum Vapor:** a remote seller (no Texas physical presence) may elect the **single local use tax rate**, **1.75% for 2026**, instead of destination local rates.
   - Elect with Form 01-799. The election is effective at the start of a reporting period.
   - Revocation filed before Oct 1 takes effect at the end of that calendar year; revocation filed on or after Oct 1 takes effect at the end of the following year.
   - It is not available to marketplace providers.
   - The remote-seller safe harbor is $500,000 of Texas revenue in the preceding 12 months.
   - If the election is made, per-jurisdiction local codes are not needed for local tax. The code table is needed only if Maximum Vapor collects destination local rates.
7. **Upcoming changes (not in the file because not yet effective), from quarterly-updates/2026-oct.php, effective 2026-10-01:**
   - New or increased city taxes: Beckville, Ellinger, Frost, Northlake.
   - Abolished taxes: Bellmead, Naples, Orchard, Roscoe, Northlake IDC.
   - Shoreacres merges into La Porte and abolishes its tax.
   - New SPDs: Ellis Co ESD 1 (5070559) and ESD 9/9-A; Kaufman Co ESD 1/1-A.
   - Montgomery Co ESD 10 is split into two rates.
   - Refresh the dataset at the Oct 1, 2026 quarter.
