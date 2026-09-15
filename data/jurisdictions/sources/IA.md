# Iowa — local option sales tax (LOST) by return county number

**Status: COMPLETE**

## Sources (official, Iowa Department of Revenue)
- **Local Option Rates and Sunsets** xlsx, "Effective Jul 1, 2026": https://revenue.iowa.gov/media/195/download?inline, linked from https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/local-option-sales-tax-lost. It lists every city and unincorporated area by county: LOST yes/no, LOST start date, sunset date.
- **Iowa Sales and Use Tax Return 32-028 (08/28/2025)**: https://revenue.iowa.gov/media/2654/download?inline. Section E prints the **county numbers 01–99** used to report LOST. All 99 match the xlsx county numbers.
- New LOST jurisdictions notice (6/18/2026): https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/new-iowa-local-option-lost-tax-jurisdictions. Johnson County cities Coralville, Iowa City, North Liberty, Oxford and Shueyville imposed LOST on 7/1/2026. Conway (Taylor Co.) disincorporated 4/1/2026.
- SST file `sst/all/IAR2025Q3MAY30.csv` was **only cross-referenced**. It is stale (5/30/2025) and predates the Johnson County impositions. Its 1,013 city and 100 county rows are all 0.000 placeholders. The actual 1% LOST sits in 100 type-63 rows numbered `98` + county FIPS; 98199 matches no county FIPS.

## Row count: 1,236
| type | rows |
|---|---|
| state | 1 (6%, SST FIPS 19) |
| county | 99 (return Section E county no. 01–99) |
| city | 1,037 (every city in the IDR list: 7% if LOST applies, 6% if not) |
| unincorporated | 99 (unincorporated area of each county) |

Duplicate key check: `(county no., city)` repeats 99 times **by design**. Iowa reports LOST only by county number, so each city row carries its county's number. Every rate is between 6% and 7%.

## Complete
- All 99 counties and all 1,136 city/unincorporated jurisdictions in the IDR list.
- LOST status as of 7/1/2026 (975 city rows + 95 unincorporated areas have LOST), with start and sunset dates. No sunset date falls before 2026-09-15.

## Missing / caveats
- **4 unincorporated rows** (including Johnson County) have "Jurisdiction has LOST" = NO. The sheet's own Total Rate formula still returns 7% for them, because the formula keys off the "Unincorporated Jurisdiction" column. The CSV follows the NO flag and says so in notes. Confirm with IDR.
- Hotel/motel tax (sheet tabs "Hotel Motel Rates…") is a separate tax and was not loaded. It does not apply to vape sales.
- Iowa has no numeric code for individual cities. Cities not in the IDR list fall under the unincorporated county rate, per the sheet's note.

## Quirks a preparer must know
- The Iowa return reports **one LOST amount per county** (Section E): all taxable sales in LOST jurisdictions of that county × 1%. Sales into cities without LOST are not entered.
- A city spanning counties can have LOST in one county and not the other, e.g. Ackley: Hardin YES, Franklin NO.
- The 911 prepaid wireless surcharge (line 12) is separate.
