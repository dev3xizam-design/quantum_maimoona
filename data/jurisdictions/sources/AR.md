# Arkansas (AR) — sales/use tax jurisdiction codes

**File:** `states/AR.csv`. **Rows:** 426 (1 state, 75 county, 350 city).
**Code system:** AR DFA local tax code `CC-NN`. `CC` is the DFA county number (01 Arkansas … 75 Yell, alphabetical, **not** FIPS). `NN` is `00` for the county itself, otherwise the city number.
**Rates as of:** DFA City & County Tax Table, July–September 2026 (current on 2026-09-15).

## Sources
- DFA "List of Cities and Counties with Local Sales and Use Tax", Jul–Sep 2026 (xls). This is the source of every code, rate and effective date:
  https://www.dfa.arkansas.gov/wp-content/uploads/cityCountyTaxTable_Jul_Sep_2026.xls
  (the PDF version is at the same path with a .pdf extension)
- DFA table for Oct–Dec 2026, used only to flag changes on 10/01/2026:
  https://www.dfa.arkansas.gov/wp-content/uploads/cityCountyTaxTable_Oct_Dec_2026.xls
- Landing page: https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/sales-use-tax-rates/city-and-county-sales-use-tax-rates/
- DFA sample sales-tax XML return, which shows the electronic `LocalCode` format:
  https://www.dfa.arkansas.gov/wp-content/uploads/slsReturnSample.xml_.zip
- SST rate file `ARR2026Q4AUG28.csv`, used for FIPS cross-reference only.

## Validation
- 350 of 350 cities name-match an SST place FIPS with an identical rate. DeValls Bluff is "De Valls Bluff" in the Census file.
- All 75 counties match an SST county FIPS. The SST FIPS code is recorded in `notes`.
- No duplicate codes. Rates run 0–0.035 local.
- The SST file also carries Bethel Heights (FIPS 05740, 2.5%) as current. That city merged into Springdale in 2019 and is not on the DFA table, so it was not added.

## Complete / missing
- **Complete:** every city and county the DFA lists as levying local sales/use tax.
  - Arkansas has no sales-tax special districts on the DFA table.
  - Monroe and Saline counties appear on the table at 0% and are kept.
- **State row:** DFA assigns no local code to the state, so the row carries SST FIPS `05` at 6.5%.
- **Multi-county cities (18):** Alexander, Alpena, Ash Flat, Big Flat, Cave City, Cherokee Village, Damascus, Elm Springs, Fairfield Bay, Glenwood, Hardy, Horseshoe Bend, Humphrey, Jennette, Mansfield, Quitman, Springdale, Tillar.
  - DFA prints the county rate as "See Below" and the total as "Varies".
  - For these rows `combined_rate` and `county_name` are left blank, and `notes` lists the counties.
  - `paired_code` is the county from the code prefix. For a sale in the other county, use that county's `-00` code.
- **Changes on 10/01/2026 (not yet effective; rows have `effective_to` 2026-09-30 and the new rate in `notes`):**
  - Alpena 05-02: 1% → 2.25%.
  - Hempstead County 29-00: 2% → 2.75%.
  - Logan County 42-00: 2% → 1.5%.
  - Stone County 69-00: 1.5% → 1%.

## Quirks a preparer must know
1. The rate table prints codes with a hyphen (`60-02`). The electronic XML return (`LocalCode`, numeric) uses the same four digits without it (`6002`). Both forms are in each row (`notes`).
2. A city sale reports both the city code and the county code (`CC-00`). `combined_rate` = 6.5% state + city + county, for single-county cities only.
3. County numbers are DFA's own alphabetical 01–75, not FIPS. Pulaski is 60, not FIPS 119.
4. `effective_from` is the DFA "Effective Date" of the current rate.
