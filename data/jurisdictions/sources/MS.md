# Mississippi (MS) — jurisdiction codes report

**File:** `states/MS.csv`, 507 rows. Built by `build_MS.py`.
**Status:** complete for jurisdiction numbers. **Partial** for special-levy rate codes: 49 of 123 special rows have a blank code because DOR has not published one.

## Bottom line for a remote vape seller
Mississippi is **state-only** for an out-of-state seller:
- Charge **7% use tax** and report it under **rate code 75 on the Use Tax return**. Groceries would be 5% at rate code 41. Source: Notice 72-25-03.
- **Register once** annual Mississippi sales go over **$250,000** in the prior 12 months (DOR "Online Seller Guidance").
- **No local tax applies:**
  - Mississippi has no general county sales tax.
  - Jackson's 1% infrastructure tax is due from businesses *located* in Jackson. Since 4/24/2014, delivery *into* Jackson from outside is not taxable (Notice 72-14-2).
  - Tupelo's 0.25% applies to sales made in Tupelo.
  - Every tourism/economic development levy is a hotel, motel, restaurant or bar tax. None applies to vape retail.
- **Separate from sales tax:** Notice 72-26-09 (June 22, 2026) says every ENDS (vape) retailer, wholesaler and distributor must obtain an **ENDS Permit** through TAP.

## Sources (all Mississippi Department of Revenue, dor.ms.gov, downloaded directly)
- **City/County List** (the official code list for the TAP import template): https://www.dor.ms.gov/sites/default/files/business/sales_city_county_list.xls
  - 309 three-digit city numbers and 83 two-digit county numbers
  - Workbook last modified 2024-02-09
- **TAP import template instructions:** https://www.dor.ms.gov/sites/default/files/business/sales_tap-import-template-with-instructions.xlsx
  - Defines the code types: 2-digit County Number, 3-digit City Number, 2-digit Tax/Rate Code.
  - Special-tax rate codes are 21, 25, 87–99. Sales categories are 12–83.
- **Tourism and Economic Development Taxes page** (levy names, rates, bases, effective and repeal dates): https://www.dor.ms.gov/business/sales-and-use-tax/tourism-and-economic-development-taxes
- **Sales tax notices / Special Tax Levy Advisories** (rate codes). 103 PDFs, listed in `raw/MS/notices_all.txt`. Key ones:
  - 72-25-03: rate codes 74, 40, 75, 41
  - 72-14-2: Jackson, code 21
  - 72-26-07: Tupelo
  - 72-20-10: Jackson County code table
  - 72-26-02, 72-26-03, 72-26-04, 72-26-11: 2026 levy updates
  - 72-26-09: ENDS permit
  - "Online Seller Guidance"
- **Census 2020 places** (only to fill `county_name` and the city/town/village type): census/national_place2020.txt

## Row counts
| Type | Rows | Code system |
|---|---|---|
| state | 2 | MS DOR rate code: 74 (in-state 7% sales tax), 75 (out-of-state 7% use tax) |
| city / town / village / municipality | 112 / 166 / 19 / 3 | MS DOR city number (3-digit) |
| county | 82 | MS DOR county number (2-digit, 01–82) |
| special | 123 | See breakdown below |

**Breakdown of the 123 special rows:**
- 9 university/college diversion recipients (city numbers 302–310)
- 1 "NonMS" (county number 83)
- Jackson Special Infrastructure Tax (rate code 21)
- Tupelo Water Procurement Facility Tax (code blank)
- 111 current tourism/economic development levies. 63 have a rate code from a DOR notice; 48 are blank.

**Checks:** rates are 0–0.08; no out-of-range values.

**Duplicate (state, code, type) keys are expected:**
- Special rate codes are reused statewide: 92 ×26, 94 ×17, 99 ×8, 91 ×4, 96 ×2.
- 49 special rows have a blank code.

The unique key for a special levy is **county/city number (`paired_code`) + rate code**, which is how the TAP "Special Tax Rates" schedule is keyed.

## What is complete
- **All 309 DOR city numbers and 83 county numbers** exactly as DOR publishes them, with DOR spellings kept:
  - "Louisiville" (Louisville), "No. Carrollton", "Sartartia" (Satartia), "Mt. Olive", "Houlka"
  - The Census names are in `notes`.
- **Both general local sales taxes:** Jackson 1% (code 21, repeal 7/1/2035) and Tupelo 0.25%.
- **Every levy on the DOR tourism page still in force on 2026-09-15.** Repealed levies are excluded:
  - Sardis Tourism Tax (repealed 7/1/2026)
  - Vaiden (7/1/2022)
  - Vicksburg Convention Tourism Promotion (9/30/2017)
  - Columbus Tourism Promotion & MUW Support (7/1/2018)
  - Como Tourism Tax (7/1/2013)
  - Horn Lake Tourism & Economic Development (7/1/2011)

## What is missing
- **The Tupelo 0.25% rate code** does not appear in any DOR notice (72-26-07 gives none). Left blank; not guessed.
- **48 current hotel/restaurant levies have no published rate code.** Most are older levies whose notices are scanned images with no text (19 PDFs, roughly 1998–2012) or were never posted. Examples: Aberdeen, Batesville, Canton, Cleveland, Oxford, Tupelo Convention & Tourism, Natchez, Tunica County, Harrison County coliseum/CVB taxes. Those rows have a blank `official_code`. TAP assigns the code to the permit account.
- **Some rate codes come from old notices**, as far back as 2014. DOR has changed codes for existing levies before: Notice 72-20-10 moved Jackson County hotels from 92 to 99. Verify against the permit's TAP return before filing.
- **Flat per-room occupancy taxes** (Horn Lake $2, Jackson $0.75, Natchez $2, Newton $1, Como $1) have blank `local_rate`. Horn Lake is filed as a separate "Occupancy Tax" account in TAP.
- **No rates for city and county rows.** Mississippi has no general city or county sales tax apart from Jackson and Tupelo.

## Code-system quirks a preparer must know
1. **Three separate numbering systems appear on the return:** 2-digit county number, 3-digit city number, and 2-digit rate code. City numbers are *not* FIPS: 001 is Jackson, 048 is Tupelo, and so on.
2. **Rate codes identify a rate or tax line, not a place.** The same code means different levies in different towns:
   - 92 is a 2% restaurant tax in dozens of cities.
   - 99 is a 2% hotel tax in Jackson County, but a 1% restaurant tax in Grenada.
   - 94 is sometimes a combined figure: Southaven hotels report the DeSoto 2% and Southaven 1% together at 94.

   So a special-tax line is always keyed by the permit location's county number and city number plus the rate code.
3. **The Sales return and the Use return use different codes:**
   - In-state retailers (Sales Tax return): 74 = 7%, 40 = 5% groceries.
   - Out-of-state retailers (Use Tax return): 75 = 7%, 41 = 5% groceries.
4. **City numbers drive diversions, not tax rates.** The "Sales Tax by Cities" TAP tab (utilities, telecom, transient vendors) and the "Unincorporated" tab allocate the tax calculated at codes 70/71/73/74. There is no extra city tax.
5. **Some city numbers are universities and colleges** (302–310), and county number 83 means "NonMS". These are typed `special`.
