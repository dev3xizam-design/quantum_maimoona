# Oklahoma (OK) — sales/use tax jurisdiction codes

**File:** `states/OK.csv`. **Rows:** 645 (1 state, 77 county, 567 city).
**Code system:** OK COPO (Oklahoma Tax Commission city/county code), 4 digits, kept as text.
**Rates as of:** July–September 2026 chart (current on 2026-09-15).

## Sources
- OTC "Rates and Codes for Sales, Use, and Lodging Tax", Jul–Sep 2026 (updated May 29, 2026). This is the source of every code and rate:
  https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/businesses/sales-and-use-tax/rate-charts-copos/2026/copo3Q26.pdf
- OTC Oct–Dec 2026 chart, used only to flag rates that change on 10/01/2026:
  https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/businesses/sales-and-use-tax/rate-charts-copos/2026/copo4Q26.pdf
- SST rate file `OKR2026Q4AUG17.csv`, used for cross-checks only. The FIPS codes in `notes` come from this file.
- Census 2020 place/county name files, used only to name-match SST FIPS codes and county names.

## How the chart was parsed and checked
- Each column of the PDF was cropped and parsed separately with pdfplumber.
- The lodging-tax column was left out (lodging tax is not a sales/use tax).
- A second full-text regex pass found no entries that the cropped parse had missed, and no duplicate COPOs.
- All 77 county COPOs (`nn88`) map by name to the 77 Census counties.
- 557 of the 567 city rows name-match an SST place FIPS whose SST rate equals the OTC rate. The FIPS is recorded in `notes`.
- 10 city rows have no SST FIPS match:
  - Cleora: SST shows 0; the chart shows a new use-only tax.
  - Cordell: Census name is New Cordell.
  - Hochatown, LeFlore, Lone Chimney, Picher, Pryor, Vernon, West Siloam Springs: no exact name match.
  - Sapulpa, Tulsa County portion: SST carries one rate per place, but OTC shows 4.5% in Tulsa County and 4% in Creek County.
- All 77 counties agree with SST county rates (Oklahoma County is 0%).

## Complete / missing
- **Complete** for the sales/use chart: every county and city the OTC lists.
  - OTC says: "If a city or county is not listed, they do not have a sales or use tax."
  - Oklahoma has no sales-tax special districts on the OTC chart.
- **Not included:**
  - Lodging-tax COPOs (a separate tax, not relevant to vape sales).
  - SST type-63 records (744 codes of the form 98xxx). They are not OTC return codes.
- **State row:** the OTC assigns no COPO to the state. The state row carries the SST state FIPS `40`.
- **Changes on 10/01/2026 (not yet effective):**
  - Laverne 3005: 3.25% → 3%.
  - Salina 4914: 4% → 5%.
  - Wellston 4124: 4% → 3.5%.
  - Selah 4416: new 4% tax. It is not a row, because it isn't in effect today.
  - Bristow 1912: new lodging tax.
  - Laverne, Salina and Wellston rows have `effective_to` = 2026-09-30.
- **July 1, 2026 changes** are marked with `effective_from` = 2026-07-01: Carmen, Cleora, Coalgate, Hominy, Olustee, Red Oak, South Coffeyville, Valley Brook.
  - For every other row `effective_from` is blank, because the chart does not publish start dates.

## Quirks a preparer must know
1. **City and county are paired.** The first two digits of a city COPO are the county number, and that county's COPO is `nn88` (e.g. Salina 4914 is in Mayes County 4988).
   - `**` next to a city means the county tax is also due. `paired_code` holds that county's COPO.
   - Report the city line and the county line separately.
2. **Cities in more than one county have one COPO per county portion.**
   - Oklahoma City = 0921 (Canadian), 1421 (Cleveland), 5521 (Oklahoma), 6321 (Pottawatomie).
   - Tulsa = 7281, 7381, 5781. Broken Arrow, Owasso, Sand Springs, Mannford and others are also split; `notes` lists the sibling COPOs.
   - Rates can differ by portion. Sapulpa is 4% in Creek County (1931) and 4.5% in Tulsa County (7225).
3. **Use tax flag `#`.**
   - A city or county without `#` has no use tax. For a remote seller collecting Oklahoma sellers' use tax, that city's line does not apply; only the state and any county with `#` do.
   - 80 city rows have no `#`. `notes` says "NO city use tax".
   - Oklahoma County (5588) is 0% and has no use tax.
4. **Cities in Oklahoma County carry no `**`**, because that county's rate is 0. Their `combined_rate` = state + city.
5. `combined_rate` is my own sum: 4.5% state + city rate + the paired county rate where `**` applies. The OTC does not publish combined figures.

