# Idaho (ID) - jurisdiction codes

**File:** states/ID.csv - **24 rows** (1 state, 23 resort cities)
**Code system:** none. Idaho has no local jurisdiction codes on the state sales tax return.
**Status:** PARTIAL by nature. The state row is complete. The 23 resort cities are listed with county names but no codes and no rates, because no official state source publishes either.

## Sources
- The Idaho State Tax Commission (tax.idaho.gov) and legislature.idaho.gov were **unreachable from this network** on 2026-09-15: TCP connections timed out and WebFetch got ECONNREFUSED. The DNS lookup itself worked. I read the official pages from Internet Archive captures instead:
  - ISTC "City Sales Taxes" page, captured 2026-07-25: http://web.archive.org/web/20260725141514/https://tax.idaho.gov/taxes/sales-use/sales-tax/local-sales-tax/city-sales-tax/ (page footer says last updated January 13, 2026)
  - Idaho Code 63-3619 (6% rate), captured 2026-03-17: http://web.archive.org/web/20260317094737/https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH36/SECT63-3619/
- Census 2020 place file, used for county names.

## What's included
- State: 6% sales/use tax.
- Resort cities with a local option sales tax, per ISTC: Bellevue, Bonners Ferry, Cascade, Crouch, Donnelly, Driggs, Hailey, Harrison, Irwin, Kellogg, Ketchum, Lava Hot Springs, Mackay, McCall, Ponderay, Riggins, Salmon, Sandpoint, Stanley, Sun Valley, Swan Valley, Tetonia, Victor.

## What's missing
- **Rates and codes for the resort cities.** ISTC says to "contact the following cities directly". It does not administer these taxes and publishes no rate or code, so I left them blank rather than use third-party rates.
- **Auditorium district taxes.** These are lodging-room taxes, not relevant to retail vape sales. ISTC's auditorium district page was 404 in the archive.
- **Tribal taxes:** not researched.

## Quirks a preparer must know
- **The ISTC return has no local lines.** A remote seller files state 6% only with ISTC.
- **Resort city taxes are imposed and collected under each city's ordinance.** Many cities limit the tax to lodging, liquor by the drink, and restaurant food. Whether a city's tax reaches retail goods such as vapor products, and whether remote sellers must register, has to be confirmed with that city.
- **Refresh when the site is reachable.** Re-download from tax.idaho.gov when it can be reached, to confirm the list has not changed since July 2026.
- **Blank codes:** duplicate (state, blank code, type) combinations exist only because codes are blank by design.
