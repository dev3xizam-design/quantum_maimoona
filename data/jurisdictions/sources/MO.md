# Missouri (MO) — jurisdiction codes

## Sources
- Missouri DOR, Taxation Division report TA0300 "Sales and Use Tax Rate Tables — July, August, September 2026 (Updated 5/22/2026)"
  - XLSX (primary, parsed): https://dor.mo.gov/pdf/rates/2026/july2026.xlsx
  - PDF (same report, used to cross-check every row): https://dor.mo.gov/pdf/rates/2026/july2026.pdf
- Item code 0010 meaning: MO DOR Remote Seller and Marketplace Facilitator FAQ, https://dor.mo.gov/faq/taxation/business/remote-seller-and-marketplace-facilitator.html

**How the files were retrieved:** dor.mo.gov is behind Imperva/Incapsula, and it returns HTTP 403 ("Request unsuccessful") to this machine's IP. That happened with curl, with WebFetch, and with a real Chrome over CDP, so it is an IP block rather than a bot check. I downloaded the official DOR files, unmodified, from Internet Archive captures of the exact dor.mo.gov URLs:
- xlsx: web.archive.org/web/20260906083629id_/https://dor.mo.gov/pdf/rates/2026/july2026.xlsx (SHA-1 base32 55JJE5QGB3N3MSXI35XMZNMQZONIEKSA, which matches the archive's digest for the dor.mo.gov response)
- pdf: web.archive.org/web/20260821050929id_/https://dor.mo.gov/pdf/rates/2026/july2026.pdf

These are the DOR's own files, not third-party data. From a US IP, re-download them directly from dor.mo.gov before relying on them.

## Output
`states/MO.csv`: **2,550 rows**, one per DOR jurisdiction code on the chart.
- city: 1,538. The code has a city FIPS and district seq 000. This includes St. Louis City, 65000-510-000.
- district: 903. The district seq is not 000, so the code is a city or unincorporated-county area plus a special-district combination (CID, TDD, TCED, PID, ambulance, fire, emergency services, zoo and so on).
- county: 109. These are unincorporated county areas, 00000-CCC-000.
- Coverage: 115 county codes (114 counties plus St. Louis City) and 1,493 distinct city FIPS.

Validation:
- The xlsx and PDF agree on all 2,550 codes and all 6 rate columns (0 mismatches).
- No duplicate codes.
- Use rates run from 0.04225 to 0.11725, and sales rates max out at 0.12238, so all rates are within 0 to 0.15.
- Five counties (Camden 029, Marion 127, Morgan 141, Scott 201, Shelby 205) have no -000 unincorporated row. The whole unincorporated area of each is in an ambulance or emergency district, so it only appears under -001, -002 and so on. This is correct, not a gap.

## Completeness
**Complete** for the current quarter chart: every jurisdiction code the DOR published for 7/1/2026 to 9/30/2026.
- **Missing: the October 2026 chart.** It takes effect 10/1/2026 and could not be fetched: no archive capture exists and the live site is blocked. Refresh the file every quarter.
- No state-only row. MO publishes no separate code for the state; the 4.225% state rate is included in every combined rate.
- Not included: Domestic Utility (3200) and AMJ (7004) rate columns. They don't apply to vape sales.

## Code system and preparer quirks
- **Code format `CCCCC-CCC-DDD`**:
  - CCCCC is the city FIPS place code, or 00000 for an unincorporated area.
  - CCC is the county FIPS code; 510 is St. Louis City.
  - DDD is the DOR's district-combination sequence.
- One code equals one unique city, county and district combination. A code is not one taxing body.
- The chart's name block (in `notes`) lists every city, county and district bundled into the code.
- The name `ST LOUIS` with county code 510 is the independent City of St. Louis. It is not St. Louis County (189).
- **Item (tax-type) code suffix:** the 4 digits after the jurisdiction code on the return.
  - 0000: general sales tax (Form 53-1) or general use tax (Form 53-V).
  - 0010: vendor's use tax on sales made as a marketplace facilitator.
  - 1001 / 1011: food.
  - 3200: domestic utility.
  - 7004: AMJ.
- **Remote seller:** Maximum Vapor files **vendor's use tax (Form 53-V)**, not sales tax. That's why `combined_rate` holds the chart's **USE tax rate**. The sales tax rate is in `notes`.
  - Many districts, including most CIDs and TDDs and some ambulance and fire districts, levy sales tax but no use tax, so the use rate is often lower than the sales rate.
  - `local_rate` is the use rate minus the 4.225% state rate.
- Economic nexus threshold: $100,000 in taxable Missouri sales over the prior 12 months, checked quarterly. Collection must start by the first day of the quarter after the next one (DOR FAQ).
- 55 cities span more than one county, so they appear under several county codes. Choose the code that matches the delivery address. The DOR boundary database (address or ZIP+4 lookup) is the authority for which code applies.
- Many CIDs and TDDs cover only part of a city. A city code with DDD 000 is the city outside those districts.
- A few cells in the DOR xlsx are stored as numbers, not "x.xxxx%" text. Both forms were parsed and matched to the PDF.
