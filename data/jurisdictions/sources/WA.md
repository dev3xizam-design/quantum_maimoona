# Washington (WA) — local sales & use tax location codes

**File:** `states/WA.csv` — 404 rows (1 state row + 403 location codes)
**Code system:** WA DOR 4-digit location code (the code reported on the Combined Excise Tax Return, local sales/use tax section). Stored as text with leading zeros (e.g. `0100`).
**Period:** Q3 2026 (effective July 1 – Sept 30, 2026), the quarter in effect on 2026-09-15.
**Status:** COMPLETE for every location code DOR publishes for Q3 2026.

## Sources (all official)
- Primary: WA DOR "Local Sales & Use Tax Rates", Q3 2026, alphabetical Excel —
  https://dor.wa.gov/sites/default/files/2026-05/Q326_Excel_LSU-rates-alpha.xlsx
  (listed on https://dor.wa.gov/forms-publications/publications-subject/local-sales-use-tax-rate-history-excel-file-format)
- Q4 2026 (Oct 1 – Dec 31) Excel, used only to flag upcoming changes —
  https://dor.wa.gov/sites/default/files/2026-08/Q426_Excel_LSU-rates-alpha.xlsx
- Completeness cross-check: WA DOR GIS address database, Q3 2026, all 39 county zips (1,229,531 address ranges, field `CODE`) —
  https://dor.wa.gov/taxes-rates/sales-use-tax-rates/downloadable-database/quarter-3-2026
- Rate / effective-date cross-check: SST rate file `WAR2026Q4AUG27.csv` (published by WA DOR through Streamlined Sales Tax).
- City vs town class: US Census 2020 place file (`census/national_place2020.txt`).

## Row counts by jurisdiction_type
| type | rows |
|---|---|
| state | 1 |
| city | 227 |
| town | 69 |
| unincorporated | 56 (county unincorporated areas, incl. PTBA / Non-RTA splits) |
| special | 51 (tribal location codes + Hospital Benefit Zone codes) |

## Validation
- 403 distinct codes in DOR Q3 file, no duplicate (state, code, type).
- Every row: local rate + 6.5% state = combined (checked). Local 1.10%–4.20%; combined max 10.70%.
- All 383 distinct codes in the Q3 GIS address database are in the rate file. The 20 codes in the rate file but not in the address database are all tribal codes (they are assigned by tribal agreement, not by address).
- All 403 codes exist as `L####` type-63 rows in the SST file. 386 match the DOR local rate exactly; the 17 "... Unincorp. PTBA" codes do not (see SST quirk below).
- Q4 2026 has the same 403 codes (no additions or removals). Only one rate changes: **Mattawa (1308)** goes from 1.9% to 1.8% on 2026-10-01. That row has effective_to 2026-09-30 and a note.
- 120 codes changed rate on 2026-07-01 (bold in the DOR file). Each has a note, and the SST begin date agrees (2026-07-01) for all 113 that match SST.

## Column conventions
- `local_rate` = DOR "Local rate" column. `combined_rate` = local + 6.5% state. `rate_includes_state` = true refers to combined_rate.
- `effective_from` = begin date of the current SST record for that `L####` code (the rates match). This is the start of the current record, not necessarily the last rate change: SST re-issues records at quarter starts (for example 2026-01-01 or 2026-04-01) even when the rate stays the same. It is blank for the 17 PTBA codes where SST carries a different rate.
- `effective_to` is blank unless DOR's Q4 file shows a change.
- `county_name` is taken from DOR's County column. A city that spans counties has one code per county portion, and the name says so (for example "Auburn in King County" 1702 and "Auburn in Pierce County" 2724).

## Quirks a preparer must know
1. **One code per rate area, not per city.** A city can have several codes:
   - **RTA split:** "X Non-RTA" is the part outside the Sound Transit boundary (for example Bellevue 1704 at 3.8% vs Bellevue Non-RTA 4004 at 2.4%).
   - **County split:** "X in Y County".
   - **HBZ:** Gig Harbor HBZ 2788, plus Pierce County HBZ variants 2787 and 2789.

   Unincorporated county land also splits: "Unincorp. Areas" (outside the PTBA) vs "Unincorp. PTBA" vs "Non-RTA". Always assign the code by delivery address, using DOR's GIS/address lookup or the address database. Never assign it by city name or ZIP code.
2. **Tribal codes** (Colville, Puyallup, Nisqually, Lummi, Tulalip, Swinomish, Chehalis, Squaxin Island, Suquamish, Stillaguamish, and others) apply only under tribal tax agreements. They are not in the address database, so a remote seller should normally not get them from an address lookup.
3. **Codes change every quarter.** DOR publishes the new file about 30 days before each quarter. Reload the data every quarter.
4. **SST file type-63 rows are not a list of return codes.**
   - `WAR2026Q4AUG27.csv` has 14,704 type-63 rows (1,168 distinct `L` codes, 1,153 current on 2026-09-15). None of them is a separate county/city FIPS jurisdiction.
   - About 450 of the distinct codes are `L` + a 4-digit number. That group covers all 403 DOR location codes plus 35 others that are current (0659, 0661, 1379, 1653, 1655, 2853, 2961, 2969, 2981, 3171, 3173, 3275, 3459, 3463–3469, 3759, 3767, 3773, 4300, 4302, 4304, 4314, 4315, 4324, 4325, 4335, 4336, 4339, 4400, 4401, 4403, 4405, 4427). The 35 others are not in the DOR Q3 2026, Q2 2026 or Q1 2020 location-code lists or the address database. They look like SST-internal component jurisdictions (for example PTBA or transit parts), but no DOR document names them, so they were **left out**.
   - 716 codes `L9000`–`L9742` have one row per quarter (most of the 14,704 rows). They are SST boundary/rate-area identifiers with no DOR location-code equivalent, so they were also **left out**.
   - For the 17 "Unincorp. PTBA" codes (for example 0666 Clark, 3131 Snohomish, 3232 Spokane), the SST `L` row holds only the PTBA part of the rate (0.4%–1.2%). The DOR file holds the full local rate (for example Clark 2.2%). Use the DOR rate.
   - SST type 00 (44 county) and type 01 (278 city FIPS) rows are FIPS-keyed parts of the rates. They are not what the WA return uses.
5. Vapor products: WA also has a state vapor products excise tax, filed separately from sales tax. It is not part of this local sales tax dataset.

## Missing / not included
- No codes that DOR publishes for Q3 2026 are missing.
- Left out on purpose because DOR does not publish them as location codes: the 35 extra SST `L####` codes and the 716 `L9xxx` codes.
- Lodging-only special hotel/motel and convention center taxes are not included. DOR publishes them separately in the lodging rate chart, and they do not apply to vape sales.
- City/town class for Krupp (1307) could not be matched to a Census 2020 place, so it is typed as city (with a note).
