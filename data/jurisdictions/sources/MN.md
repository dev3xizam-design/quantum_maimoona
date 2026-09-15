# Minnesota — local tax type codes

**Status: COMPLETE except one jurisdiction (Worthington, see Missing)**

## Sources (official, Minnesota Department of Revenue)
- **Tax Type Codes** spreadsheet, "Last Updated: 8/25/2026": https://www.revenue.state.mn.us/sites/default/files/2026-08/tax-type-codes.xlsx. It gives the tax line code used on the MN sales & use tax return, a description, the FIPS or MN special code, the rate, and effective dates.
- Local Sales and Use Tax Rate Guide, 10/1/2026–12/31/2026: https://www.revenue.state.mn.us/sites/default/files/2026-08/local-sales-and-use-tax-rate-guide-2026-q4.pdf (cross-check)
- Fact Sheet 164S, Special Local Taxes, Q4 2026: https://www.revenue.state.mn.us/sites/default/files/2026-07/164s-2026-4th-quarter_0.pdf
- Index page: https://www.revenue.state.mn.us/local-sales-tax-information. The page is behind a Radware captcha for curl, but the files download directly.
- SST rate file `sst/all/MNR2026Q4AUG18.csv`: reconciled FIPS by FIPS. Every current SST jurisdiction (63 city, 62 county-type, 11 special-code rows) matches a tax type code with the same rate, except Worthington.

## Row count: 322
| type | rows | notes |
|---|---|---|
| state | 2 | 100 General Rate Sales Tax 6.875%, 200 Use Tax Purchases |
| city | 124 | city general local sales and use taxes |
| transit | 120 | county transit sales and use taxes (e.g. Hennepin County Transit 432/433) |
| county | 18 | county general local taxes (Hennepin 430/431, Cook, Itasca, Jackson, Clay, Carlton, Beltrami, Stearns, Winona) |
| region | 6 | Metro Area Housing 392/393 and Transportation 394/395 (7-county metro); St. Cloud Area 360/365 |
| district | 2 | Garrison, Kathio, West Mille Lacs Sanitary Sewer District 588/589 |
| special | 50 | lodging, food & beverage, liquor, entertainment, admissions, and $20 local vehicle excise taxes |

No duplicate codes. Every rate is between 0.15% and 7%.

## Code system
MN does **not** use jurisdiction codes on the return. Each local tax has its own **tax type code**, and **sales and use are separate codes** (e.g. Rochester Sales 300 / Rochester Use 305). There is one row per code. Notes give the paired sales/use code plus the FIPS or MN special code (800xx).

## Complete
- Every local tax in the sheet that is in effect on 2026-09-15. Excluded as ended: Lyon Co. Transit (2020), Transit Improvement Area (2017), Worthington 470/471 (2018), Lanesboro (2024), New London (12/31/2025), Scanlon (3/31/2026).
- **Ending 9/30/2026, still included:** Albert Lea 330/331 and Blackduck 403/404, with effective_to set.
- **Not yet effective, excluded:** Northfield Lodging 694 (10/1/2026).
- State-level non-local codes are excluded: solid waste, cannabis/liquor gross receipts, retail delivery fee, dry-cleaning solvent fees, car rental, prepaid wireless, aircraft, mobile home.

## Missing
- **City of Worthington (Nobles Co., FIPS 71734), 0.5%.** It appears in the SST file (from 2020-01-01) and in the DOR Q4-2026 Rate Guide ("Worthington, City of 0.50%"). The Tax Type Codes sheet lists only the **ended** Worthington codes 470/471 (4/1/2009–9/30/2018) and no code for the current tax. The row was left out rather than guessing a code. Confirm with MN DOR or the e-Services return screen.
- Combined rates are not given per city. MN local taxes stack (state + city + county + transit + metro/area), so the total depends on the address. Use the DOR Sales Tax Rate Calculator or the zip spreadsheet (`/sites/default/files/2026-08/mn-zip-code-search-2026q4.xlsx`).

## Quirks a preparer must know
- A Twin Cities address can owe **4–5 separate local codes**: e.g. Minneapolis Sales 400 + Hennepin County Sales 430 + Hennepin County Transit 432 + Metro Housing 392 + Metro Transportation 394.
- Several county-level taxes carry MN special codes (800xx) instead of the county FIPS in the rate file. Examples: Carlton County 80006, Beltrami 80011, Stearns 80012, Winona 80013, Hennepin Transit 80004.
- Special local taxes (lodging, food & beverage, liquor, entertainment) do not apply to vape retail sales but are listed with their codes.
- Minnesota's tobacco products tax on vapor products is a separate return, not a local sales tax code.
