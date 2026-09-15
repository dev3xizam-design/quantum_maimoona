# Illinois — IDOR location codes

**Status: COMPLETE for jurisdiction-wide locations and business districts, with gaps listed below**

## Sources (official, Illinois Department of Revenue)
- Sales Tax Rate Machine Readable Files index: https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files.html. The "current" files are the set effective 08/01/2026.
- Jurisdiction-wide location file (county/municipality): https://tax.illinois.gov/content/dam/soi/en/web/tax/research/taxrates/documents/salestaxrates/ordmache-current.txt. Layout IDR-1024 (R-11/2025): https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files/sales-tax-machine-readable-file-guide-county-municipality-01-01-2026.html
- Address-level addendum (business districts and MED portions): https://tax.illinois.gov/content/dam/soi/en/web/tax/research/taxrates/documents/salestaxrates/ordmacha-current.txt. Layout IDR-1025: https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files/sales-tax-machine-readable-file-guide-addendum-address-file-01-01-2026.html
- Location/district name list: https://www.revenue.state.il.us/TaxRates/AllCountyCityDist2026b.xlsx (district names and start/end dates)
- Full address rate file: https://www.revenue.state.il.us/taxrates/AllAddressRatesJul2026.zip (about 2 GB, Deflate64). Only the first about 6 MB (312,810 addresses) was downloaded. It was used to cross-check rates: 0 mismatches against the location file. It also supplied the rates for 2 municipalities that are missing from the location file.

## Row count: 1,870
| type | rows | what it is |
|---|---|---|
| county | 102 | `xxx-5000-x` = the **unincorporated** part of each of the 102 counties |
| municipality | 1,443 | every in-state municipal location code (1,441 from ordmache + Time/Pike 075-0038-6 and Clear Lake Village/Sangamon 084-0061-1, found only in the address file) |
| district | 325 | business districts and Metro East (MED) portions: location code in `official_code`, taxing district number (R01…R20) in `paired_code`, district name in `paired_name` |

Duplicate key check: 64 repeated `(code, district)` keys. These are legitimate: one location can hold several numbered districts (for example Collinsville 060-0006-1 has R01–R07 and R10). Each row is unique on code + paired_code. Every rate is between 6.25% and 12.25%.

## Complete
- Every location in the IDOR jurisdiction-wide file, current rate effective 08/01/2026. Duplicate record for Marion 100-0001-1 collapsed to the latest record.
- Every business-district / taxing-district combination in the address addendum, with its rate.
- `combined_rate` = IDOR "Receipts General Merchandise **High** rate", the rate for vapor products and other general merchandise. `local_rate` = combined minus 6.25%.

## Missing / limitations
- **No component breakdown.** IDOR's files give only the combined rate per location. They do not split out home rule, non-home rule, RTA, MED, county public safety/facilities, school facility or business district pieces. The location code is the reporting unit, so a return does not need the split.
- **34 locations have a blank rate.** All are Madison/St. Clair County Metro East locations such as Alton, Belleville, Collinsville and Caseyville. IDOR sets the over-ride flag, zeroes the location rate, and publishes no "outside any district" (R00) rate, because every address sits in a numbered district. Use that location's district rows.
- **200 locations have over-ride flag Y** (a business district covers part of the location). For the 166 that have an R00 rate, that rate is shown and flagged in notes. The exact address still has to be resolved with the address file or the MyTax Illinois Tax Rate Finder (https://mytax.illinois.gov/?Link=TaxRateFinder).
- **Excluded on purpose:**
  - 52 out-of-state location codes (200-0099-5 ALABAMA … ), which Illinois retailers use for out-of-state locations and which are not Illinois jurisdictions.
  - 1,839 "(U)" unincorporated place-name entries in AllCountyCityDist2026b.xlsx. None of them appears as a location code in the address data checked, where unincorporated addresses carry the county `xxx-5000-x` code.
  - 126 legacy "(Bus. Dist. nn)" alias rows in the xlsx that have no rate in any current file.
  - 10 xlsx place codes with no rate anywhere checked: Chanute Field, Garden Prairie, Urbain, Central City (Grundy), Barnard Mill, Green Rock, National City, Birds, Hamletsburg, Whiteash.
  - Two xlsx districts show end date 06/30/2026: Maryville R01 and Belleville R03.
- Trenton R02 "South Trenton Business District" (2020-) is named in the xlsx but has no rate row in the address addendum, so it was not added.
- No "state" row: Illinois has no state-level location code (6.25% statewide).

## Quirks a preparer must know
- **Codes are county-specific.** A municipality that spans counties has one code per county, with different rates. Examples: Chicago 016-0001-1 (Cook) at 10.5% vs Chicago 022-0068-6 (DuPage) at 8.5%; Peoria Heights has three codes.
- Codes print as `CCC-MMMM-K` (county, municipality, check digit). The xlsx prints the same code without dashes plus the district, e.g. `00100013R01`.
- **Metro East (Madison/St. Clair):** the "high" rate applies only where the MED tax applies, and the "low" rate applies elsewhere. Both rates are given in notes.
- County code `xxx-5000-x` = unincorporated area only. Do not use it for an address inside a municipality.
- Rate changes normally take effect Jan 1 / Jul 1. This file set carries 338 locations re-dated 08/01/2026 (for example Chicago is now 10.5%), so re-pull every release.
- Grocery (the 1% local grocery tax after the state grocery repeal on 1/1/2026), drug & medical, and cannabis rates are separate files and were not loaded. They are not relevant to vapor products.
- Vapor products also bear Illinois's Tobacco Products Tax, plus Cook County and Chicago e-cigarette taxes. Those are separate excise returns, not ROT location codes.
