# Alabama (AL): jurisdiction codes

## Sources (all Alabama Department of Revenue, ALDOR)
- Rate and code file (current rows only, "Updated for September 2026"): https://www.revenue.alabama.gov/wp-content/uploads/2024/03/taxrates_current.csv
  (linked from https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/). Saved to raw/AL/taxrates_current.csv. The historical file taxrates.csv was also saved but not used.
- Field legend: https://www.revenue.alabama.gov/sales-use/taxrates-file-help/
- Code explanations (multi-code localities, PJ exceptions): https://www.revenue.alabama.gov/sales-use/city-and-county-tax-rates/
- State rates, including SSUT 8%: https://www.revenue.alabama.gov/sales-use/state-sales-use-tax-rates/
- SSUT program: https://www.revenue.alabama.gov/sales-use/simplified-sellers-use-tax-ssut/
- ONE SPOT (single filing portal): https://www.revenue.alabama.gov/sales-use/one-spot-information-for-municipal-county-governments/
- Build script: build_AL.py

## Row count: 2,453
| type | rows | distinct codes |
|---|---|---|
| state | 1 | (no code) |
| special (SSUT program) | 1 | (no code) |
| county (7xxx) | 498 | 194 |
| municipality (9xxx) | 1,368 | 503 |
| district (municipal police-jurisdiction rate) | 585 | 203 |

There is one row per **(locality code, tax type)**, for Sales Tax (ST), Sellers Use (SU) and Consumers Use (CU). A locality only has rows for the tax types it actually levies. The code_system column names the tax type. As a result, (state, code, type) repeats up to 3 times (6 counting PJ rows) on purpose. (code, type, code_system) is unique, which was checked. The rows split this way because 43 localities have general rates that differ between ST, SU and CU. Rates range from 0 to 6% local and none fall outside 0 to 0.15.

## Complete
- **Every** locality code in ALDOR's current file that levies a sales, sellers use or consumers use tax is included. That covers all 697 codes, of every kind:
  - state-administered: 264 codes
  - self-administered: 105 codes
  - non-state administered through an agent (Avenu): 328 codes
  
  The administrator is shown in notes on each row.
- County sub-area codes are included, for example Calhoun Co PJ areas, the Elmore "Enhan" levies, and Lee Co CL/PJ. Multi-county city splits are included, for example Phenix City 9283/9383 and Tallassee 9363/9364. Spanish Fort special districts 9202/9203 are included too.
- 107 "UNABATED" codes (78xx/98xx) are included and flagged.
- local_rate is the **general** rate. Other rate types (AUTO, FARM, MACH, GROC, VEND, AMUSE) and WDFEE are listed in notes.
- The police-jurisdiction (PJ) rate from ALDOR's PJ_Rate field has its own `district` row with the same locality code.

## Not included / missing
- **100 codes that only carry lodgings (LL) or rental (RT) taxes** are left out. They don't apply to retail sales of goods. LL/RT rate types on the codes that are included are also left out.
- **combined_rate is blank for local rows.** ALDOR does not publish a combined rate. The applicable total is: state 4% + the municipality code + the county code(s) for that exact location, CL vs PJ. ALDOR lists the associated county codes on each city (shown in notes). But which county sub-code applies to an address has to come from ALDOR's address rate lookup, not from this file.
- The state and SSUT rows have no official_code. ALDOR prints no locality code for them, and no code was invented.
- effective_from is ALDOR's "Active Date" for the general rate. When the indicator is AC (administration change), that date is when the administrator changed, not when the rate took effect.

## Quirks a preparer must know
1. **Code format.** Codes are 4 digits: counties start with 7, municipalities with 9. The separate 2-digit "County Number" (01–67) is ALDOR's own alphabetical county numbering. It is **not** a FIPS code: ALDOR puts SHELBY = 58 before ST CLAIR = 59, while census FIPS order reverses them. Municipal County Numbers above 67 mark multi-county or special groupings.
2. **Counties can have several codes for different areas.** For example, Mobile County has 7049 outside Mobile/Prichard and 7749 inside them. Madison has 7045 (outside Huntsville) **plus** 7745 (countywide), and the two stack. Elmore's 747x "Enhan" levies stack on top of 7026. Chambers Five Points uses 7070 for sales and 7071 for use. Always check the name and the ALDOR code-explanations page.
3. **Police jurisdictions.** Many municipalities also tax in their police jurisdiction outside city limits, usually at half the city rate. PJ activity uses the same locality code at the PJ rate. Lanett, Mobile (lodgings) and Valley Head have non-half PJ rates.
4. **Tax types.**
   - **ST** is for in-state sellers.
   - **SU** (sellers use) is what a remote seller that is not in SSUT collects.
   - **CU** (consumers use) is paid by the purchaser.
   
   Some localities levy ST and CU but no SU. A remote seller has no local sellers-use tax to collect there.
5. **Administration.** Locals are STATE (ALDOR), SELF, or agent-administered (AVENU; the legend also lists STACS, PReMACORP, LGREC, RCS, RDS and Crocker's). Since 2016-10-01, all of them, state-administered or not, can be filed through ONE SPOT in My Alabama Taxes. Registration, audits and rulings for non-state locals still sit with the locality or its agent.
6. **SSUT flat 8% (Act 2015-448, Code of Ala. §40-23-193).**
   - It is the simplest option for Maximum Vapor as a remote seller with no Alabama physical presence. The seller must apply and be approved before collecting.
   - It covers all Alabama sales regardless of locality, and no local codes are reported.
   - It is filed electronically in My Alabama Taxes by the 20th of each month, with a 2% discount on the first $400,000 of tax (max $8,000 a month).
   - It replaces all other state and local sales/use tax on those sales. Buyers in lower-rate areas can seek refunds.
   - Marketplace facilitators collect SSUT on marketplace sales.
7. **Unabated codes (78xx/98xx).** These are only for tax-abatement certificate holders self-remitting the education-earmarked local tax, which cannot be abated. Do not use them for ordinary retail sales.
8. **Codes with no general rate.** 7237 Jefferson Co restaurant alcohol and 7263/7363/7463 Tuscaloosa County coal/machine codes only carry special rate types. Their local_rate is blank, with the special rate in notes.
9. **Special restaurant/alcohol rates.** Mobile 9149, Prattville 9365 and Thomasville 9405 have REST rates, and Oxford 9315 and Columbiana 9368 have ALCOH rates. These don't affect vape sales.
10. **Typo on ALDOR's explanations page.** Pike Road's TRANV note lists code 9149, which is Mobile's code. The rate file gives Pike Road as **9753**.
11. **Vapor products.** No separate local sales-tax rate type exists for vapor products; the general rate applies. Alabama's state tobacco/vapor excise is a separate return and out of scope here.
12. The file is updated monthly. Re-download taxrates_current.csv each filing period. This build uses the September 2026 file; the latest Active Date in it is 2026-09-01.
