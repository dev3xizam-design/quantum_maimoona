# Nebraska (NE) — jurisdiction codes

**File:** `states/NE.csv` — 554 rows (built by `scripts_dakne/build_ne.py`)
**Status:** Complete for DOR local codes: 270 cities/villages, 1 county and 6 Good Life District codes. SST FIPS cross-walk is complete for cities and the county. The SST Good Life District codes GL802–GL805 could not be tied to named districts (see below).

## Sources (all official)
- NE DOR "Local Sales and Use Tax Rates, Effective July 1, 2026" (Form 6-545-2024 Rev. 3-2026), the primary source. It prints the Local Code and the SST FIPS code for each jurisdiction. https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2026/salestax/slstax_rates_07-01-2026.pdf
  - The October 1, 2026 listing was not yet posted (404 on 2026-09-15).
- NE DOR Form 10 (Nebraska and Local Sales and Use Tax Return). Schedule I columns are "City Code" and "County Code", which confirms these are return codes. https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/f_10.pdf
- NE DOR rate/boundary downloads NETaxData_2026Q3.zip and NETaxData_2026Q4.zip: https://revenue.nebraska.gov/businesses/sales-and-use-tax-rates-and-boundary-files-downloading
- SST rate file NER2026Q4AUG21.csv. It is identical in content to the DOR Q4 zip's NER file. https://www.streamlinedsalestax.org/ratesandboundry/Rates/
- Census 2020 place/county files.

Note: revenue.nebraska.gov failed to resolve through the local DNS resolver. It was fetched with curl `--resolve` using the host's public DNS answer, so the content is the official site.

## Row counts
| code_system | type | rows |
|---|---|---|
| NE DOR local code | city | 142 |
| NE DOR local code | village | 128 |
| NE DOR local code (Dakota County 134-922) | county | 1 |
| NE DOR Good Life District state rate code | district | 6 |
| SST FIPS state (31) | state | 1 |
| SST FIPS place | city/village | 270 |
| SST FIPS county (043) | county | 1 |
| SST FIPS type 63 (GL801–GL805) | district | 5 |

All 270 DOR cities matched a current SST place row, and all local rates agree. The city vs village type comes from the Census 2020 place name. Census names "Greeley Center village" for DOR "Greeley".

## Code-system quirks a preparer must know
- **Local Code format is `N-NNN`, `NN-NNN` or `NNN-NNN`** (e.g. Omaha `1-365`, Adams `267-002`). The first segment is **not zero-padded**, and codes are kept exactly as printed. The same code goes on Form 10 Schedule I.
- **Dakota County (134-922, 0.5%)** is the only county sales tax. It applies **only outside a municipality that imposes a local tax**, so it does not stack on city rates.
- **Good Life Districts (GLD)** are state-rate districts, not local taxes.
  - DOR codes: 801-801 (Opted-In Avenue One Retailer, **2.75% state rate**), 601-601 (Avenue One, not opted in), 602-602 (Nebraska Crossing / Gretna), 603-603 (Grand Island), 604-604 (La Belle Vue) and 605-605 (Kearney). Those five are at 5.5%.
  - Add the city local rate on top of the GLD rate when inside a taxing city.
  - The DOR listing prints the Kearney FIPS as "GL 605" (with a space).
- **SST mismatch for GLDs:**
  - The DOR listing gives FIPS GL801 and GL601–GL605 (6 districts). The SST/DOR rate file has GL801–GL805 (5 codes).
  - SST GL801 shows intrastate 5.5% and interstate 2.75%.
  - GL codes appear in no record of the NE boundary file, so GL802–GL805 cannot be mapped to named districts from official data. They are marked unidentified, and no mapping was guessed.
- Form 10 also carries non-jurisdiction reporting codes: 700-700 (sales made through a multivendor marketplace platform, relevant for marketplace sellers), 600-600 (motor vehicle leases), 626-626 (ATV/UTV) and 633-633 (motorboats). They are not rows in the CSV.
- DOR rows carry 2026-07-01 → 2026-09-30 (the quarterly listing). The NE Q4 SST rate file shows no city changes effective 2026-10-01.

## Missing / not included
- Mapping of SST GL802–GL805 to district names.
- County/city lodging and occupation taxes are not administered on Form 10 and are not included.
