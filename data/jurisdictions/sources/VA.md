# Virginia (VA): sales/use tax jurisdiction codes

**File:** states/VA.csv. **Rows:** 134 (1 state, 95 counties, 38 independent cities). **Status:** COMPLETE.

## Sources (official, Virginia Department of Taxation)
- https://www.tax.virginia.gov/sites/default/files/inline-files/sales-tax-rates.xlsx : "download sales tax rates and locality codes". Server Last-Modified is 2026-01-09. This is the only source used for codes and rates. Saved as raw/VA/sales-tax-rates.xlsx.
- https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup : says locality codes are FIPS codes and links the xlsx.
- https://www.tax.virginia.gov/retail-sales-and-use-tax : rate summary (7% / 6.3% / 6% / 5.3%). I used it as a cross-check only, and it matches the xlsx.

Build script: build/va.py. Local DNS returned a stale negative for www.tax.virginia.gov, so the download used `curl --resolve` pinned to the IP that `dig` returned.

## Code system
- `official_code` is the 3-digit locality code (county or independent-city FIPS), exactly as printed in the xlsx, with leading zeros kept: 001 Accomack ... 199 York, 510 Alexandria ... 840 Winchester. It is entered on Schedule A of Form ST-9 (in-state and remote dealers) and ST-8 (out-of-state dealers).
- The state row uses code `51`, the xlsx "State Code (FIPS)" column.
- Validation: the 133 locality codes match the Census 2020 county-equivalent list for VA exactly, with none missing and none extra. There are no duplicate codes, and every rate is between 0.053 and 0.07.

## Rates (general merchandise)
| Combined | Count | Localities |
|---|---|---|
| 7%   | 3  | James City Co (095), York Co (199), Williamsburg (830). Historic Triangle: HR 0.7% + HT 1%. |
| 6.3% | 8  | Charlotte (037), Gloucester (073), Halifax (083), Henry (089), Northampton (131), Patrick (141), Pittsylvania (143), Danville (590). Additional 1% local option. |
| 6%   | 28 | Northern VA (9), Hampton Roads (11, which includes the 3 Historic Triangle localities), Central VA (8). Regional 0.7%. |
| 5.3% | 95 | Everywhere else. |

`local_rate` is the locality's own tax: the 1% local tax plus any additional local option 1%. The regional taxes (NVA, HR, CVA, HT) are **state-levied**, so they are not in `local_rate`. They are in `combined_rate` and itemized in `notes`. `rate_includes_state=true` refers to `combined_rate`.

## Quirks a preparer must know
- **Regions have no code of their own.** Virginia Tax prints no region code. The regional tax is reported on its own ST-9 line (10a NVA, 10b HR, 10c CVA, 10d HT) but is keyed to the locality code on Schedule A. For that reason there are no `region` rows. Each locality row's notes name its region instead of the CSV inventing a region code.
- The Historic Triangle localities pay **both** the HR 0.7% and the HT 1%.
- The additional 1% local option (the 6.3% localities) goes on Line 12a.
- Food and personal hygiene items are 1% everywhere: the local 1% with a 0% state rate. This is noted on every row.
- **Towns have no separate sales-tax code.** A sale in a town is reported under the surrounding county's code. Independent cities are NOT inside counties, so a Fairfax City sale (600) is not a Fairfax County sale (059).
- Effective dates are blank because the xlsx has no effective-date column.
- Out of scope but relevant to a vape seller: Virginia has a separate Tobacco Products Tax on liquid nicotine and vapor products, plus retail vape licensing. These are not part of this sales-tax dataset.

## Missing
Nothing for general sales tax. Motor-vehicle, aircraft and watercraft rates and the accommodations or local meals taxes that localities administer themselves are not included, because they are not on the ST-9.
