# Utah (UT): sales and use tax jurisdiction codes

As of 2026-09-15 (Utah's Q3 2026 rate period, Jul 1 to Sep 30, 2026).

## Sources (official only)
1. **Utah State Tax Commission, Sales & Use Tax Rates page**: https://tax.utah.gov/business/sales-tax/sales/rates/
   - Section "2026 Rate Charts". The tables are built into the page:
     - "Q3 Combined Rates" (Combined Rates 2026-07). This is the **primary source**: 389 location codes, total rate and each rate component.
     - "Q3 Simple Rates" (Simple Rates 2026-07). Used to cross-check the combined rate (0 mismatches) and for the grocery-food and "Resort Exempt" rates.
     - "Q4 Combined Rates" (2026-10). Used only to flag rows whose rate changes on 2026-10-01.
   - The site sits behind a Cloudflare challenge, so curl and WebFetch both got 403. I read the page by attaching to a normal Chrome over CDP and pulled every row from each table's FooTable object. Raw copies are in `raw/UT/ninja_8799.json` (Q3 combined), `ninja_8797.json` (Q3 simple), `ninja_8803.json` (Q4 combined), and the rendered page is in `raw/UT/rates_page_rendered.html`.
   - The PDF and XLSX chart links on that page (`https://files.tax.utah.gov/tax/salestax/rate/26q3combined.xlsx` etc.) returned **HTTP 404** from every client on 2026-09-15. So did every other file on files.tax.utah.gov, including Pub 25. The page tables were the only official Q3 2026 chart I could reach.
2. **Streamlined Sales Tax rate file** `sst/all/UTR2026Q4AUG11.csv`. This is the secondary code system. Current rows are those with begin <= 20260915 <= end: 211 rows (1 state, 29 county, 181 type-01).
3. **US Census 2020** place and county gazetteer files, used only to resolve names and city/town type for FIPS codes.

## Row counts (states/UT.csv: 600 data rows)
| code_system | type | rows |
|---|---|---|
| UT Tax Commission location code | city | 152 |
| | town | 103 |
| | special (MIDA 38, UIPA 39, ULA 6, HTRZ 6, SLC special zones 4) | 93 |
| | county (xx-000 = unincorporated county) | 29 |
| | township (metro townships) | 5 |
| | transit | 3 |
| | unincorporated (Census CDPs Stansbury Park, Spring Lake) | 2 |
| | municipality (type not stated: Lincoln, Ogden Valley) | 2 |
| **TC subtotal** | | **389** |
| SST FIPS | state | 1 |
| | county | 29 |
| | city / town / unincorporated / special | 181 |
| **SST subtotal** | | **211** |

Validation: no duplicate (state, code, type) rows. Every TC code matches `\d\d-\d\d\d`. Every rate is between 0 and 0.15 (TC combined rates run from 6.35% to 10.05%).

## Completeness
- **Tax Commission location codes: complete.** All 389 locations on the Q3 2026 Combined chart are included: every city and town, the 29 unincorporated county areas, 5 metro townships, and every special area the chart lists (MIDA, UIPA, ULA, HTRZ, the Fairpark District, the Convention Center Reinvestment Zone, the SLC Convention Hotel, Point of the Mountain, and the transit areas).
- **Cross-check against SST: consistent.** For 317 TC locations I rebuilt the combined rate as 4.85% + SST county rate + SST city rate, and all 317 matched exactly. The other 72 TC locations (mostly MIDA, UIPA and HTRZ areas) could not be checked, because their SST code is not identifiable without the SST boundary file.
- **SST: partial names.** 29 current SST type-01 codes are not Census place FIPS and not TC location codes: 44975, 97012 to 97077 (various), 97203, 98005, 98007 and 98043. They are included with the placeholder name "SST jurisdiction NNNNN (unnamed in SST rate file)". To learn their names and territory you need the Utah SST boundary file, which I did not download.
- **Not in the chart:** Cedar Highlands town (Iron County, Census FIPS 11435) has no TC location code. Presumably it is filed under Iron County 11-000, but that is unverified.
- **Not included (future rows):** the Q4 2026 chart adds two codes effective 2026-10-01: **20-503 UIPA Manti (6.65%)** and **22-701 Kimball HTRZ (9.05%)**. The SST file also has 8 rows starting 20261001. Among them, Weber County (057) goes to 0.026, and there are new SST codes 18910 and 33100. In addition, 26 existing TC locations change rate on 2026-10-01: Delta, Toquerville, Washington City, Hildale, Hanksville, and all of Weber County including its MIDA and UIPA areas. Those rows carry effective_to 2026-09-30 and a note giving the new rate.

## Code-system quirks a preparer must know
- **Location code format `CC-NNN`.** CC is Utah's own county number (01 Beaver … 29 Weber, alphabetical), **not** the county FIPS. NNN = 000 means the unincorporated county area. 001 to 199 are cities and towns. 3xx = MIDA areas, 4xx = metro townships, 5xx = UIPA areas, 6xx = SLC special zones, 7xx = HTRZ, 8xx = ULA, 900 = transit areas. Returns (TC-62 series schedules) report sales by this location code.
- **Split cities have more than one code.** Examples: Santaquin (25-097 Utah County, 12-050 "Santaquin South" Juab County), Bluffdale (18-019 and 25-010), Draper (18-039 and 25-029), Park City (22-030 and 26-013 "Park City East"), and Erda (23-018 and 23-020). The code depends on the county portion.
- **Special areas carry their own codes.** MIDA, UIPA, ULA and HTRZ areas inside a city have separate codes and often a different rate (for example, 18-301 MIDA Salt Lake City is 10.05% while Salt Lake City 18-122 is 8.45%). A preparer must not roll them into the host city.
- **The Tax Commission says the charts are not meant for sourcing remote sales.** Its page says non-nexus filers must source by the buyer's ZIP+4 using the **SST boundary files**. So a remote seller like Maximum Vapor finds the jurisdiction with SST boundary and FIPS data, and reports on the return by TC location code. Both code systems are in the CSV.
- **SST codes are a mixed bag.** SST type-01 codes are mostly Census place FIPS (e.g. 67000 Salt Lake City). Some are the TC location code without its hyphen (MIDA and UIPA areas such as 02301 = 02-301 MIDA Brigham City, 18602 = 18-602 Fairpark District, and 22000 = unincorporated Summit County). Some are SST-only 97xxx and 98xxx codes. SST rates are **additive components**: state 4.85% + county SST rate + city or special SST rate. Cities with no additional rate have no SST row at all.
- **State rate is 4.85%.** Each chart row shows a 4.70% component plus a 0.15% component. local_rate in the CSV is the combined rate minus 4.85%.
- **Mislabeled component columns on the web tables.** The Q1, Q3 and Q4 2026 web tables label their columns "ST, SF (State Food), S1, LS, CO…", while the Q2 table labels the same values "ST, S1, LS, CO…, FD". The values line up with the Q2 labels (ST 4.70, S1 0.15, LS 1.00, CO 0.25). Use the **Total Rate**, not the component labels. In 13 rows the components sum to 0.01 more than the published total (rounding). The published total was used.
- **Grocery food is 3.00% everywhere** (SST: state food rate 0.03, local food rate 0). Vape products are not grocery food, so the general combined rate applies.
- **Resort Exempt.** 40 resort-community locations have a "Resort Exempt" rate, which applies only to transactions exempt from the resort communities tax. Those rows are noted in the CSV.
- **Other taxes are separate.** The "Other Rates" chart (transient room, restaurant, short-term leasing, E911 and so on) adds taxes on top of the combined rate for specific transaction types. None applies to vape retail sales, so it was not loaded as jurisdictions.
- **effective_from is blank for TC rows.** The chart gives no per-location start date, only that the Q3 chart takes effect 2026-07-01. SST rows carry the SST begin date.
