# Alaska (AK) - local sales tax jurisdictions

As of 2026-09-15. Built by `build_ak_hi.py`. Raw downloads are in `raw/AK/`.

## Sources (all official)
- ARSSTC Sales Tax Rate Sheet, as of 9/1/2026 (primary source for codes and rates): https://arsstc.org/wp-content/uploads/2026/08/ARSSTC-Sales-Tax-Rate-Sheet-9-1-26.xlsx
  - It has three tabs: General Remote Sales Tax, Alcohol Remote Sales Tax, and Tax Caps.
- ARSSTC Rate Sheet with ZIP Codes, 9/1/2026 (used to cross-check): https://arsstc.org/wp-content/uploads/2026/08/ARRSTC-Sales-Tax-Rate-Sheet-with-Zip-Codes-9-1-2026.xlsx
- ARSSTC member jurisdictions page (codes and rates, plus the pending list dated 8/26/2026; used to cross-check): https://arsstc.org/business-sellers/member-jurisdictions/
- ARSSTC seasonal communities, 4/27/2026: https://arsstc.org/wp-content/uploads/2026/04/1-ARSSTC-Seasonal-Sales-Tax-Communities-4.27.26.pdf
- ARSSTC guide to filing nested jurisdictions, Oct 2025: https://arsstc.org/wp-content/uploads/2025/10/ARSSTC-How-to-File-for-Nested-Jurisdictions_Oct2025.pdf
- ARSSTC guide to reading the rate tables: https://arsstc.org/wp-content/uploads/2022/01/ARSSTC-How-to-Read-the-Tax-Rate-Tables.pdf
- DCCED Office of the State Assessor, *Alaska Taxable 2024*, Table 1B (non-member municipal sales tax rates): https://www.commerce.alaska.gov/web/Portals/4/pub/OSA/2024%20Alaska%20Taxable%20Report.pdf
  - The DCCED HTML pages are behind DataDome bot protection, but the PDF downloads directly. We could not find a 2025 edition at a guessable URL.

ARSSTC is the Alaska Remote Seller Sales Tax Commission. It is an intergovernmental commission of Alaska municipalities that administers the Uniform Remote Seller Sales Tax Code. There is no state revenue department involved, because Alaska has no state sales tax.

## Row counts (116 total)
| type | rows | code |
|---|---|---|
| state | 1 | none (Alaska has no state sales tax) |
| borough | 8 | ARSSTC code (Juneau, Kenai Peninsula, Ketchikan Gateway, Petersburg, Sitka, Skagway, Wrangell, Yakutat) |
| district | 3 | ARSSTC code (Haines Townsite 800032, Haines Rural 800034, Excursion Inlet 800036) |
| city with a code (ARSSTC general sales tax) | 45 | ARSSTC code |
| special (ARSSTC alcoholic beverage tax lines) | 9 | ARSSTC code (800xxx) |
| city/borough without a code (non-member or pending) | 50 | blank |

ARSSTC codes: 65 codes in total, 56 for general sales tax and 9 for alcohol. The 56 general codes are the 8 boroughs, 3 districts and 45 cities above. No code is duplicated, and every rate is between 0 and 0.15. All 65 codes and rates were cross-checked against the member-jurisdictions page. The only mismatch is Kake's alcohol code (see Quirks).

## Completeness
- **ARSSTC members: complete.** This covers every jurisdiction a remote seller must collect for (the general and alcohol tabs as of 9/1/2026). This is the part that matters for Maximum Vapor as a remote seller.
- **Non-member municipal sales taxes: rate list only, no codes.** There are 45 non-member municipalities (for example Akutan, Hoonah, Klawock, King Cove, Sand Point, Utqiagvik and Whittier). No filing code exists for them in any official source, because each city administers its own tax. Their rates come from *Alaska Taxable 2024*, and some report data years 2022 or 2023. These rates may be stale.
- **Pending ARSSTC members: 5 cities with no code yet.** Gambell, Koyuk, Nunapitchuk, Teller and Wales have joined ARSSTC but have not adopted the remote-seller rules. They are listed with a blank code and a note.
- **Missing:**
  - Bettles, Deering and Marshall show "NO DATA" in Alaska Taxable 2024, so they are not included.
  - Borough-level non-sales taxes are not included: bed, tobacco/e-cigarette excise, marijuana and raw fish.
  - Anchorage and Fairbanks have no general sales tax, so they only appear through Anchorage's alcohol line.

## Quirks a preparer must know
1. **One consolidated return.** Remote sellers file one return on arsstc.munirevs.com with a line for each ARSSTC tax filing code. Most codes are 4 digits (`9xxx`). Newer codes and alcohol codes are 6 digits (`800xxx`). Keep all codes as text.
2. **Nested jurisdictions.**
   - Kenai Peninsula Borough (9036) contains Homer 9028, Kenai 9035, Seldovia 9084, Seward 9085 and Soldotna 9091.
   - Ketchikan Gateway Borough (9038) contains Ketchikan 9037 and Saxman 9081.
   - Sales in a nested city go on **both** the city line and the borough line. The borough's net taxable amount must be at least the sum of its nested cities, or the portal rejects the return.
   - `paired_code` holds the borough code for these cities. `combined_rate` is city plus borough.
3. **Seasonal rates.** `local_rate` shows the rate in effect on 2026-09-15, which is the high season. These rates change on 2026-10-01:

   | Jurisdiction | Rate from 2026-10-01 |
   |---|---|
   | Craig | 6% |
   | Haines Townsite | 4.5% |
   | Haines Rural | 3% |
   | Excursion Inlet | 2.5% |
   | Ketchikan City | 3% |
   | Seldovia | 2% |
   | Sitka | 5% |
   | Skagway | 3% |
   | Pelican | 4% |
   | Chignik (from Nov 1) | 0% |

   Seasonal food exemptions:
   - Haines areas: non-prepared food is exempt October to March.
   - Homer and Kenai Peninsula Borough: non-prepared food is taxable only June to August.
4. **Alcohol lines are separate codes.** They are not for vapor products. For Juneau 800012 and Kake the alcohol tax is "in addition to" the general tax. For the others it is "in lieu of" it.
5. **Code discrepancy (not resolved).** Kake's alcohol tax is 800039 on the 9/1/2026 rate sheet and ZIP sheet, but 800040 on the member-jurisdictions page. The CSV uses 800039 and flags the conflict. Check in MuniRevs before filing.
   - Chignik appears as 80042 on the ZIP sheet, but the rate sheet and member page both say 800042. The CSV uses 800042.
6. **Tax caps.** Many members cap tax per item, per transaction or per service. For example, Bethel taxes only the first $10,000 of a single item. Amounts above a cap are reported under the "Over Threshold" exemption. See the Tax Caps tab of the rate sheet.
7. **ZIP codes are unreliable.** In the ZIP sheet, a ZIP that straddles a boundary is listed twice, once marked I (inside) and once O (outside). ARSSTC says to use the address lookup instead.
8. **Borough labels.** `county_name` uses the borough or census-area label from the ARSSTC sheet. Census areas are not taxing jurisdictions.
9. **Vapor products.** Local tobacco and e-cigarette excise taxes are separate from sales tax and are not administered by ARSSTC. Examples in Alaska Taxable 2024 include Anchorage, Juneau, Bethel, Kodiak Island Borough, Mat-Su and Petersburg. They are not in this file.
