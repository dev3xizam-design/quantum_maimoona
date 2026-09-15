# South Dakota (SD) — jurisdiction codes

**File:** `states/SD.csv` — 698 rows (built by `scripts_dakne/build_sd.py`)
**Status:** Complete for DOR return codes. SST FIPS cross-walk is complete except one unidentified SST special-jurisdiction code (39220, 0% rate).

## Sources (all official)
- SD DOR Municipal / Special Jurisdiction Tax Schedule, Jul–Dec 2026 (xlsx, the return worksheet), the primary source: https://dor.sd.gov/media/jrmivhcu/municipal-sj-tax-schedule-2026-07.xlsx
- SD DOR Municipal / Special Jurisdiction Tax Rate Chart, effective Jul 1 – Dec 31 2026 (pdf), used for cross-checks and the McCook Lake instruction: https://dor.sd.gov/media/5jibzt1z/municipal-sj-tax-rate-chart-2026-07.pdf
- SD DOR Municipal Tax Guide, July 2026, for tribal special-jurisdiction rules, MGRT scope and "Other Taxes": https://dor.sd.gov/media/54mb5a2w/2026-07_municipal-tax-guide.pdf
- Jan 2026 chart, used for a history check: https://dor.sd.gov/media/pmrdurff/municipal-sj-tax-rate-chart-2026-01.pdf
- SST rate file SDR2026Q3JUN02.csv: https://www.streamlinedsalestax.org/ratesandboundry/Rates/
- SST boundary file SDB2026Q4SEP08.zip, used only to find which tribal area each SST type-49 code covers: https://www.streamlinedsalestax.org/ratesandboundry/Boundary/
- Census 2020 national place/county files, for FIPS names and counties.

## Row counts
| code_system | type | rows |
|---|---|---|
| SD DOR municipal tax code (`NNN-2`) | city | 254 |
| SD DOR municipal tax code (McCook Lake → 258-2) | unincorporated | 1 |
| SD DOR municipal gross receipts tax code (`NNN-1`) | city | 94 |
| SD DOR special jurisdiction tax code (tribal `4xx-4/-2/-5`) | special | 18 |
| SD DOR municipal/special jurisdiction tax code (Other Taxes 600-1/700-1/800-1/900-1) | special | 4 |
| SST FIPS state (46) | state | 1 |
| SST FIPS county (all 0%) | county | 66 |
| SST FIPS place | city | 254 |
| SST FIPS type 49 (tribal) | special | 6 |

Every DOR municipal general code (254) matched exactly one SST place FIPS (254), and the reverse also holds. DOR "Witten" is Census "New Witten town" (FIPS 45100); the SST boundary file names it WITTEN, ZIP 57584.

## Code-system quirks a preparer must know
- **Return codes are `NNN-S`** (3-digit municipality number, then a suffix). Keep them as text.
  - `-2` is the **municipal general sales/use tax** (asterisked in the chart). This is the code for vape sales.
  - `-1` is the **Municipal Gross Receipts Tax (MGRT)**. It covers only alcohol, eating establishments, lodging and admissions, and applies **on top of** municipal sales tax. It does not apply to vape retail sales.
  - Tribal Special Jurisdictions: `-4` sales/use (4.2%, **in lieu of state tax**, so do not also remit state tax), `-2` contractor's excise (2%), `-5` tourism (1.5%).
- **Tribal areas:** Cheyenne River 408, Crow Creek 417, Oglala/Pine Ridge 411, Rosebud 412 and Standing Rock 413 have comprehensive agreements. Sisseton Wahpeton 414 has only a use-tax code (414-4). Yankton 418 has use (418-4) and excise (418-2) codes. A delivery into a tribal area goes under the tribal `-4` code, plus the city `-2` code if that city also has a municipal tax (for example Mission 239-2, Eagle Butte 102-2, McLaughlin 220-2).
- **McCook Lake** has no code of its own. The DOR chart says "Report to North Sioux City* 258-2". It is included as an `unincorporated` row that shares code 258-2 with North Sioux City; this duplicate is intentional.
- **Other Taxes** codes 600-1 (motor vehicle), 700-1 (tourism 1.5%), 800-1 (Sioux Falls lodging) and 900-1 (telecom) go in the City & Special Jurisdiction section of the return. They are not local jurisdictions and are included for completeness only.
- **SD has no county sales tax.** The SST file lists all 66 counties at 0%.
- Municipal rates can change only on Jan 1 and Jul 1, so DOR rows carry 2026-07-01 → 2026-12-31 (the chart period).
- **SST type 49 codes:** SST files carry no names. The name mapping comes from the addresses each code covers in the SD SST boundary file:
  - 11860 = Cheyenne River (Eagle Butte, Dupree, Timber Lake, Isabel)
  - 14860 = Crow Creek (Fort Thompson, Stephan)
  - 49700 = Oglala/Pine Ridge (Wanblee, Long Valley, Interior)
  - 55980 = Rosebud (Mission, St. Francis)
  - 61260 = Standing Rock (McLaughlin, McIntosh, Morristown)

  **39220** (0%, begin 2023-07-01) appears in no current boundary record. It is left with a blank name and marked unidentified.
- SST combined rates for type-49 rows are 4.2% and include the in-lieu state portion.

## Discrepancies found
- **Gary (DOR 139-2, FIPS 23860):** the DOR Jan-2026 and Jul-2026 charts and the guide all show **2%**. SST file SDR2026Q3JUN02 still shows 1% (row dated from 1987). The DOR rate is used for the DOR row, and both rows carry a WARNING.
- South Shore (333-2) went from 1% to 2% on 2026-07-01. The DOR chart and the SST file agree.

## Missing / not included
- Unidentified SST code 39220.
- City-imposed local lodging/BID fees administered by cities themselves are not on the DOR return. Only DOR-administered codes are included.
- The SD SST rate file is dated Jun 02 (Q3). No SD SST file for Q4 was posted, and SD rates cannot change before 2027-01-01.
