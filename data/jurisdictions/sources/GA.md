# Georgia — sales/use tax jurisdiction codes

**File:** `states/GA.csv` — **167 rows** (1 state, 159 county, 6 city, 1 special), effective for the quarter 2026-07-01 → 2026-09-30, which covers 2026-09-15.
**Code system:** GA DOR sales tax jurisdiction code, the code used on the ST-3 / GTC local schedule.
- `000` is the state.
- `001`–`159` are the counties in alphabetical order. These are **not** FIPS codes.
- `060A` and `044A` are the City of Atlanta portions of Fulton and DeKalb.
- `800`–`804` are split city and district codes.

**Built by:** `build_GA_parse.py`, `ga_check.py`, `build_GA.py` (downloads in `raw/GA/`).

## Sources (all dor.georgia.gov, downloaded directly)
- **General rate chart, effective July 1 – Sept 30, 2026** (codes, names, rates, type letters): https://dor.georgia.gov/document/document/general-rate-chart-effective-july-1-2026-through-september-30-2026pdf/download
- **Local Sales and Use Tax History, July 2026** (57 pages; each tax component with its start date, end date and rate): https://dor.georgia.gov/document/document/july-2026-historical-sales-tax-chart/download
- Upcoming changes: https://dor.georgia.gov/document/document/rate-changes-effective-october-1-2026/download and the Oct 1 2026 general chart https://dor.georgia.gov/document/document/httpsdorgeorgiagovdocumentdocumentgeneral-rate-chart-effective-october-1-2026/download
- July 1 2026 change bulletin: https://dor.georgia.gov/document/document/2026-jul-quarterly-changespdf/download
- Cross-check: `sst/all/GAR2026Q4AUG28.csv`.
- Index pages: https://dor.georgia.gov/sales-tax-rates-general and https://dor.georgia.gov/historical-sales-tax-chart
- Note: this Mac's resolver had a stale negative DNS entry for dor.georgia.gov. Downloads used `curl --resolve` with the IP returned by `dig @8.8.8.8`, and the content is the official files.

## Validation
- 166 local codes were parsed from the Q3 chart: 159 counties + 060A, 044A, 800, 801, 802, 803, 804. All 159 county numbers are present.
- For **all 166 codes**, the components active on 2026-09-15 in the history chart add up exactly to the chart rate minus 4% (803 is the exception, see below).
- All 159 county codes were mapped to Census county FIPS by name. The SST county rate equals the chart rate minus 4% for 157 of them. The other two, Fulton (060) and DeKalb (044), differ only because SST puts part of the rate into separate special-district rows.
- Parsing the Oct 1 2026 chart reproduced exactly the 11 changes in the DOR Oct 1 bulletin. That confirms the parser is correct.
- No duplicate codes. All rates are between 0 and 0.15.

## Column conventions
- `combined_rate` is the DOR chart rate, which includes the state 4%. `local_rate` = chart rate − 4%.
- `effective_from` is the first day of the current unbroken period at the current total rate, computed from the component history. Renewals that did not change the rate do not reset it.
- `effective_to` is filled only when the rate changes on 2026-10-01; the new rate is given in `notes`.
- `notes` lists each active component (LOST, ELOST, SPLOST, TSPLOST 1/2, PTRLOST, HOST/EHOST, MOST/Other Local, MARTA, Local MARTA, Atlanta TSPLOST, Fulton TSPLOST) with its sunset date, plus the county FIPS.

## Complete / missing
**Complete** for the general sales and use tax chart. Not included (not relevant to a vape retailer): the separate DOR charts for motor fuel, jet fuel, prepaid wireless 911, and manufactured homes.

## Quirks a preparer must know
1. **Fulton County has five codes.** `060` covers Fulton outside Atlanta, Hapeville, College Park and East Point (7.75%). The others are `060A` Atlanta (8.9%), `800` Hapeville, `801` College Park and `802` East Point (8.75% each). `803` Centennial Yards is a district inside Atlanta. **DeKalb** splits into `044` outside Atlanta (8%) and `044A` Atlanta (8.9%). **Clayton** splits into `031` outside College Park (8%) and `804` College Park (9%). Sales must go under the code for the delivery address. Using the county code is wrong for those cities.
2. **803 Fulton (Centennial Yards) is the one code whose printed rate (3.9%) excludes the state 4%.** The chart header says state tax is included in every rate except 803. `combined_rate` is left blank for that row. Report state tax under 000 separately, as DOR instructs.
3. **2026-10-01 changes (current rows are marked with effective_to 2026-09-30):**
   - Charlton 024 → 8%
   - Dougherty 047 → 9%
   - Heard 074 → 8%
   - Houston 076 → 8%
   - Jenkins 082 → 9%
   - Monroe 102 → 9%
   - Richmond 121 → 9%
   - Tattnall 132 → 9%
   - Towns 139 → 7%
   - Wilcox 156 → 9%
   - **New code 805 Fulton (S. Downtown), 3.9%, also excluding state tax.** 805 is not in the CSV because it is not effective on 2026-09-15.
4. Rates are uniform across a county except in the split jurisdictions above. City-level rates are otherwise not coded separately.
5. The GA SST file uses county FIPS (odd numbers 001–321) and a different split structure (e.g. FIPS 13-63-99999). **Do not use SST FIPS as ST-3 codes.**
