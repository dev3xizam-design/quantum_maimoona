# North Carolina (NC) - sales/use tax jurisdiction codes

**File:** states/NC.csv - **107 rows** (1 state, 100 counties, 4 transit, 2 special: Mecklenburg additional 1% and statewide 2% food rate).
**Code system:** NCDOR county codes 1-100 (alphabetical county number, printed unpadded on Form E-536 "County and Code" and in Form Gen 562 "County Code"). The E-500 itself has no county codes; county detail goes on the E-536 schedule. SST FIPS codes are recorded in notes for cross-reference.
**As of:** 2026-09-15 (forms/rates effective July 1, 2026).

## Sources (all official NCDOR / SST)
- Form E-536 Schedule of County Sales and Use Taxes (7-26 web-fill): https://www.ncdor.gov/form-e-536-web-fill-version/open - the 100 county codes, and pre-printed Part B codes 101 (2% food) and 060 (1% additional county rate).
- Total current rates CSV (eff. 7-1-2026): https://files.nc.gov/dor/2026-07/Total%20Current%20S%26U%20Tax%20Rates%20Effective%207-1-2026.csv
- County levy dates CSV (updated 7-1-2026): https://files.nc.gov/dor/2026-05/County%20Levy%20Dates%20Updated%207-1-2026.csv
- NCDOR SST rate database (byte-identical to sst/all/NCR2026Q3APR23.csv): https://www.ncdor.gov/rate-database/open
- Form Gen 562 by city (county code per city/ZIP): https://www.ncdor.gov/gen-562-sorted-city/open
- E-500 instructions (July 2026+): https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-forms-and-certificates/tax-return-forms-schedules/instructions-form-e-500-sales-and-use-tax-return
- Mecklenburg Important Notice (3-2-2026): https://www.ncdor.gov/taxes-forms/sales-and-use-tax/other-sales-and-use-tax-resources/important-notices-issued-sales-and-use-tax-division/important-notice-mecklenburg-county-sales-and-use-tax-increase

## Validation performed
- 100 counties in E-536 = 100 in total-rate CSV = 100 in levy-date CSV = 100 SST county rows (52 at 2.00%, 48 at 2.25%).
- For every county: 4.75% + SST county rate + transit + additional = NCDOR published total (exact match).
- Every Gen 562 city line (1,429) has county code and county rate matching the CSV.
- E-500 instructions' 2.25% list (46) + Durham/Orange (listed with transit) = the 48 SST 2.25% counties.
- SST current special rows: type 79 FIPS 99063/99119/99135/99183 (0.5% transit Durham/Mecklenburg/Orange/Wake) and type 26 98119 (Mecklenburg 1%, begin 2026-07-01) - 98119 identified from the NCDOR Mecklenburg notice (same rate, date, county FIPS 119). No future-dated rows in the file.

## Completeness
**Complete.** NC has no city-level general sales tax; all local tax is county, transit, or the Mecklenburg additional rate. Prepared-meals taxes administered by localities are excluded (not on E-500).

## Quirks a preparer must know
1. Codes 1-100 are printed without leading zeros on E-536 Part A; Part B pre-prints 3-digit codes (060, 101). Stored exactly as printed.
2. Transit (0.50%) has **no separate code** - it goes on E-500 line 10 and the Transit column of the county's E-536 row (Durham 32, Mecklenburg 60, Orange 68, Wake 92). Transit rows reuse the county code with jurisdiction_type=transit.
3. **Mecklenburg additional 1% (eff. 2026-07-01):** E-500 line 12 / E-536 Part B (code 060), not the Part A county columns. Total Mecklenburg rate 8.25%. Excludes qualifying food, boats, aircraft, manufactured/modular homes, electricity, piped gas, video programming, telecom, spirituous liquor. New E-500/E-536 forms required for periods beginning July 2026 (7-26 revision). NCDOR's Gen 562 calls it "Additional 1% Transit Tax".
4. County rates are reported by rate column: 2.00% counties on line 8, 2.25% counties on line 9.
5. Qualifying food: 0% state + flat 2% local everywhere (line 7, code 101) - no county/transit tax on it. Not relevant to vapes.
6. E-536 is required when collecting for more than one county or a county other than the business location - i.e. always for a remote seller with NC deliveries.
7. Total rates in NC are 6.75%, 7.00%, 7.25% (Wake), 7.50% (Durham, Orange), 8.25% (Mecklenburg).
