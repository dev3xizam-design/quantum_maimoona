# Wyoming (WY) - jurisdiction codes

**File:** states/WY.csv - **126 rows** (1 state, 23 county, 2 resort district, 100 city/town rows: 19 city + 81 town)
**Code system:** WY Department of Revenue "Jurisdiction Digit Code" (4 digits, CCcc) plus the paired 4-letter "Jurisdiction Name Code" (e.g. NATR / 0100). Both codes are entered on Forms 41/42/43/44 (Part II/III), so the name code is in `paired_code`.
**Status:** COMPLETE for all sales/use tax jurisdictions: 23 counties and 2 resort districts. All city/town codes from the DOR jurisdiction table are included for completeness, but they are used for lodging tax only.

## Sources (official, WY DOR Excise Tax Division; files are hosted on Google Drive links posted on the division's site)
- Sales/Use and Lodging Tax Jurisdiction Table: https://drive.google.com/open?id=17MYiyln5KFxgck4QQymVmeQHc7wLj1AK (linked from https://excise-tax-div.wyo.gov/salesuselodging-tax/salesuselodging-returns)
- Sales/Use and Lodging Tax Rates by Locality, effective 07/01/2026 (current): https://drive.google.com/file/d/1WZgbqFyWhd1kwnjIkI0mnCJ9w4ktkFuM/view. Also the 10/01/2026 chart: https://drive.google.com/file/d/1rANAjDSulvnNa-bbluT-Vv3vdxhlowrz/view (both linked from https://excise-tax-div.wyo.gov/sales-use-tax-rate-charts)
- Form 41 instructions (Revised 7.10.24): https://drive.google.com/file/d/1Ct78ny_aFjSe-nYSsAeewIykbyuRa3XD/view. These explain how the codes are used.
- SST rate file WYR2026Q4AUG20.CSV, used for effective dates and a cross-check. All 23 county rates and both resort district rates (SST type 69: 02290 and 02291) match the 07/01/2026 chart.

## Quirks a preparer must know
- **Sales/use tax uses the county code only.** Form 41 instructions: "sales/use tax due will be reported using only the county level jurisdiction name and digit code as tax is only imposed at the state and county level ... The last two digits (city code) will always be 00 unless reporting lodging tax or resort district tax." A sale delivered to Cheyenne is reported as LARA / 0200, not CHEY / 0201.
- **Resort districts are the exception.** Teton Village (TVRD / 2290) and Grand Targhee (GTRD / 2291) each levy 2% on all taxable sales, for 9% combined. Report those sales under the district code, not under Teton County (2200, 7%).
- **County numbers are DOR's own sequence, not FIPS and not alphabetical.** 01 Natrona, 02 Laramie, 03 Sheridan, 04 Sweetwater, 05 Albany, 06 Carbon, 07 Goshen, 08 Platte, 09 Big Horn, 10 Fremont, 11 Park, 12 Lincoln, 13 Converse, 14 Niobrara, 15 Hot Springs, 16 Johnson, 17 Campbell, 18 Crook, 19 Uinta, 20 Washakie, 21 Weston, 22 Teton, 23 Sublette.
  - **Correction to the task brief:** the example "Goshen 0800" is wrong. Goshen is **0700**, and 0800 is **Platte**. Natrona 0100 and Sweetwater 0400 are correct.
- **Upcoming rate change:** Albany County goes from 1% to 2% (6% combined) on 2026-10-01. The current row has effective_to 2026-09-30 and a note with the new rate. No new codes start on 2026-10-01.
- **Casper:** SST shows a Casper city rate of 1% that ended 2026-06-30. The 07/01/2026 DOR chart shows Casper at 5%, the same as Natrona County. As of 2026-09-15 there is no separate Casper sales tax.
- **Frannie has two codes:** Park County portion FRAN / 1103 and Big Horn County portion FRNB / 0915.
- **Code gaps are normal.** City digit codes are not contiguous (e.g. Midwest 0114, Bar Nunn 0118, Wright 1719). Use them exactly as listed.
- **Local rates on city rows:** city rows carry `local_rate` 0 (no municipal sales tax) and the county's combined rate.
- **Lodging taxes** (statewide 5% plus local 1-2%) are in the chart but are not part of this dataset's rates.
- **City vs town:** the type (city/town) comes from Census 2020 place names. The DOR table does not distinguish them.
