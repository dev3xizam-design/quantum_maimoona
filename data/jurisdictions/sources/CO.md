# Colorado (CO): jurisdiction codes

**Status: PARTIAL.** Every jurisdiction and rate is current to the **DR 1002, July 2026** edition. The codes come from the newest **DR 0800** that could be retrieved, dated **06/13/25**. That edition is about 15 months old, so any location code CDOR issued in the January 2026 or July 2026 DR 0800 is missing.

## Why the codes are not current
- `tax.colorado.gov` sits behind Amazon CloudFront, and the whole site returns **HTTP 403 "configured to block access from your country"** to this machine. WebFetch and Google's translate proxy were refused as well. The Wayback Machine's captures of tax.colorado.gov have also returned 403 since July 2026.
- On the DR 1002 page (tax.colorado.gov/DR1002), the old PDF has been replaced by an embedded **Google Looker Studio report** that CDOR publishes. Google hosts it, so it could be reached. It was rendered in headless Chromium, and every table was captured in full from the report's own data responses (row limit raised; row counts checked against each table's reported total).
- The code list (DR 0800) and CDOR's combined codes-and-rates spreadsheet are still files on tax.colorado.gov. The newest byte-exact copies in the Internet Archive are:
  - **DR 0800 (06/13/25)**, captured 2025-08-11.
  - **Colorado_Jurisdiction_Codes_Rates_Jan-June2025_REV.xlsx**, captured 2025-04-02.
- In February 2026 the lookup page linked `Colorado_Jurisdiction_Codes_Rates_Jan26-June2026.xlsx` and `DR0800_2025.pdf`. Neither file was ever archived. The July–Dec 2026 spreadsheet could not be reached.

## Sources
| Use | URL |
|---|---|
| Location/jurisdiction codes (DR 0800 06/13/25) | http://web.archive.org/web/20250811053657/https://tax.colorado.gov/sites/tax/files/documents/DR0800.pdf |
| Rates, special districts, home-rule list (DR 1002 July 2026, embedded at tax.colorado.gov/DR1002) | https://lookerstudio.google.com/reporting/b987b537-d28e-4429-a74d-c5db9ade7e9c (pages p_rr5w8whpsd, p_njk6sh5nsd, p_775wp5hqsd, p_u5sbexersd) |
| Tax mix at each code, used for notes only and dated Jan–Jun 2025 | http://web.archive.org/web/20250402153105/https://tax.colorado.gov/sites/tax/files/documents/Colorado_Jurisdiction_Codes_Rates_Jan-June2025_REV.xlsx |
| Link inventory, used to learn file names | http://web.archive.org/web/20260223133421/https://tax.colorado.gov/how-to-look-up-sales-use-tax-rates |
| Incorporated town vs. city vs. unincorporated place (classification only, no codes) | census/national_place2020.txt |

Raw files and scripts are in `work/CO/`: `DR0800_wb20250811.pdf`, `dr0800_parsed.csv`, `looker/tbl_*.csv`, `build_co.py`.

## Row counts (550 total)
| type | rows | official_code |
|---|---|---|
| state | 1 | `State` (DR 0100 tax-type code) |
| county | 64 | 2-digit DR 0800 county number (`01` Denver … `64` Broomfield) |
| city | 97 | 6-digit location code `CC-NNNN` |
| town | 212 | 6-digit location code |
| unincorporated | 118 | 6-digit location code (`CC-0206`, `CC-0208`, district areas, named places such as Highlands Ranch) |
| district | 45 | DR 0100 tax-type code (CD, LID, MHA, PSI, MDT, HSD, FPD, AD, ECD) |
| transit | 13 | DR 0100 tax-type code (RTD, MTS, RTA) |

- The file has **427 location codes**, exactly the set in DR 0800 (06/13/25).
- All 170 state-collected cities and all 65 home-rule cities in DR 1002 July 2026 matched at least one DR 0800 code. Multi-county cities have one code per county portion; Aurora, for example, has 5 codes.

## Complete
- Every location/jurisdiction code in DR 0800 (06/13/25), with its county.
- Current July 2026 rates for:
  - the state
  - 53 county-tax rows (52 counties plus Pitkin's separate Basalt rate)
  - 170 state-collected cities
  - 65 home-rule cities, with the city's contact details
  - RTD and CD
  - 6 LIDs, 3 MTS, 9 RTA rows, 1 MHA, 3 PSI, 13 MDTs, 5 HSDs, 14 FPDs, 1 AD and 1 ECD
- **Home-rule self-collected cities are flagged** in the notes of each of their location rows.

## Missing or uncertain
1. **Location codes created after 06/13/25.**
   - DR 1002 July 2026 marks some districts as new or changed with an asterisk: *Pueblo Rural FPD* and *Upper Pine River FPD*. Sanford's city entry is also asterisked.
   - Fire protection districts first appeared after the Jan–Jun 2025 spreadsheet. The 17 district rows whose name no DR 0800 code references carry a "verify" note.
   - A newer DR 0800 is needed to confirm whether new `CC-02xx` codes exist.
2. **combined_rate is blank on location rows.** No current per-location total could be obtained, because the July 2026 spreadsheet is unreachable.
   - Each location row's notes list the Jan–Jun 2025 tax mix and total (for example `State 2.9, County 0.75, RTD 1, CD 0.1 = 4.75% total`). These totals are historic; recompute them from July 2026 component rates.
   - `local_rate` on a city or town row is only the city sales tax from DR 1002 July 2026.
3. **Counties with no state-collected county tax** (such as Baca, Cheyenne and Kiowa) have a blank `local_rate` and a note. DR 1002 does not print 0% for them.
4. **Classification.** Some named places are typed `unincorporated` because the 2020 Census lists them as census-designated places (Keystone, Pueblo West, Highlands Ranch and others). Keystone may have incorporated since; its note says to verify. No DR 1002 table lists a city tax for any of them.
5. Not included:
   - Lodging-only taxes (LMD, VBT, CLD), which moved to the separate DR 1003 in August 2025 and don't apply to vape sales.
   - The 15% retail marijuana tax (RMS).
   - PIFs and retail sales fees charged by home-rule cities, which DR 1002 does not publish.

## What a preparer must know
- **The return works by location, not by jurisdiction.**
  - Every line on the DR 0100 (and in Revenue Online, SUTS or XML) uses one 6-digit location/jurisdiction code, written `CC-NNNN` in DR 0800 and `CCNNNN` in the spreadsheet or XML.
  - The code sets which state-collected taxes apply at that location: state, county, city or LID, RTD/CD, RTA, MTS, MHA, PSI, MDT, HSD, FPD, AD and ECD.
  - Special districts have **no code of their own**. Their tax goes in the matching DR 0100 column on the line for each affected location. That is why district rows reuse tax-type codes such as `MDT` and `FPD`, and why several rows share the same (state, code, type).
  - XML e-file uses slightly different codes: `Cnty` for county, `MT` for MTS, `BGM` for MDT.
- **Deliveries to unincorporated areas:**
  - `CC-0206` is the generic unincorporated code.
  - `CC-0208`, `0209` and `0210` are unincorporated areas that include a special district, for example `10-0208` for unincorporated Arapahoe (CD only).
  - CDOR retired `0207`.
- **Home-rule, self-collected cities** include Denver, Aurora, Colorado Springs, Boulder and Fort Collins; there are 65 in all.
  - Their city tax is **not** paid to CDOR. Register and file with each city, or through SUTS, which covers most of them in one return.
  - State, county and district taxes at those addresses still go to CDOR under the location code.
  - Their taxable bases and exemptions differ from the state's.
  - DR 1002 lists several with more than one rate (food, auto rental and other categories); `local_rate` shows only the first, and the rest are in the notes.
- **Multi-county cities have one code per county portion.** Examples: Aurora `12-0003`, `12-0062`, `10-0001`, `10-0002`, `47-0030`; Littleton in Arapahoe, Douglas and Jefferson; Timnath `06-0077` and `03-0158`. Variants such as "CD Only", "(RTD)" and "(Lincoln Station LID)" carry different district mixes.
- **Pitkin County:** the county tax inside Basalt is 2.60%, compared with 3.60% elsewhere. The Eagle, Pitkin and Summit county rates in DR 1002 already include MTS.
- **Service fee:** the state vendor fee was eliminated from 2026-01-01. Local service fees still vary; they are in the notes.
- **Remote sellers:** CDOR's lookup tool (colorado.ttr.services) redirects to colorado.atr.avalara.com. It was not used as a source, under the no-Avalara rule.
- **Validation:** 383 rows carry a `local_rate`, all between 0 and 0.15, and there are no blank codes. 89 location rows are flagged home-rule self-collected. Duplicate (state, code, type) keys occur only on district and transit tax-type rows (LID, MTS, RTA, PSI, MDT, HSD, FPD), as explained above. All 427 location codes are unique.
