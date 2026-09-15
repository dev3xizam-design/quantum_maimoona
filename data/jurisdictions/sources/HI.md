# Hawaii (HI) - General Excise Tax (GET) taxation districts

As of 2026-09-15. Built by `build_ak_hi.py`. Raw downloads are in `raw/HI/`.

## Sources (all Hawaii Department of Taxation)
- Schedule GE instructions, which contain the district codes: https://files.hawaii.gov/tax/forms/current/g45ge_i.pdf
  - The exact wording is: "Enter the Tax District in which the exemption/deduction is claimed. (Oahu enter "1"; Maui enter "2"; Hawaii enter "3"; Kauai enter "4")".
- County surcharge page (rates, effective dates, sunset dates, maximum pass-on rates): https://tax.hawaii.gov/geninfo/countysurcharge/
- Form G-45 (Rev. 2025): https://files.hawaii.gov/tax/forms/current/g45_f.pdf
- Form G-49 (Rev. 2025): https://files.hawaii.gov/tax/forms/current/g49_f.pdf
- Form G-45/G-49 instructions: https://files.hawaii.gov/tax/forms/current/g45ins.pdf
- Form G-75 (Rev. 2025): https://files.hawaii.gov/tax/forms/current/g75_f.pdf
- Maui surcharge announcement: https://files.hawaii.gov/tax/news/announce/ann23-05.pdf

## Row counts (5 total)
| type | rows | code |
|---|---|---|
| state | 1 | none. GET is 4% on retailing. |
| county (taxation district) | 4 | 1 = Oahu, 2 = Maui, 3 = Hawaii, 4 = Kauai |

No code is duplicated, and every rate is between 0 and 0.15.

## Completeness
**Complete.** Hawaii has no local sales tax jurisdictions below the county level. The only local tax is the 0.5% county surcharge, and it is reported by taxation district. There are exactly four districts.

## Quirks a preparer must know
1. **GET is not a sales tax.** It is a tax on the seller's gross receipts. The rates are:
   - 4% on retailing (line 8)
   - 0.5% on wholesale activities
   - 0.15% on insurance commissions
2. **County surcharge.** All four counties levy a 0.5% surcharge, and all four are in force on 2026-09-15:

   | District | Surcharge in effect |
   |---|---|
   | Oahu | from 2007-01-01 |
   | Kauai | from 2019-01-01 |
   | Hawaii County | 0.25% in 2019, 0.5% from 2020-01-01 |
   | Maui | from 2024-01-01 |

   - All four surcharges run until 2030-12-31, so the rate on a retail sale is 4.5% in every district.
   - The surcharge applies only to activities taxed at 4%.
   - The maximum a seller may visibly pass on to customers is **4.7120%** in all four counties.
3. **How districts appear on the forms.**
   - Paper Form G-45 (periodic) and G-49 (annual), Rev. 2025, have no numeric codes. Part V is a box to mark (Oahu / Maui / Hawaii / Kauai / MULTI).
   - The county surcharge amounts go on Part IV: line 19 Oahu, line 20 Maui, line 21 Hawaii, line 22 Kauai.
   - A seller who does business in more than one district marks MULTI and attaches Form G-75, which has columns a to d for Oahu, Maui, Hawaii and Kauai.
   - The numeric codes 1 to 4 are used on Schedule GE, in the "District" column.
   - If Part V is missing or wrong, the penalty is 10%.
4. **Sourcing.** A sale of tangible personal property is sourced to the district where it is delivered.
5. **Remote-seller relief.**
   - If a seller has no nexus in a surcharge district, sales assigned to that district are exempt from the surcharge. Claim this with Schedule GE ED Code 109.
   - Sales to Kalawao County (on Molokai) are also exempt from the surcharge, under ED Code 159.
6. **Maui district** covers the islands of Maui, Lanai and Molokai.
7. **Form version.** Use the Rev. 2025 forms for periods beginning on or after 2026-01-01.
