# Kansas (KS) — sales/use tax jurisdiction codes

**File:** `states/KS.csv`. **Rows:** 1,072 (1 state, 105 county, 645 city/county-portion, 321 special district).
**Code system:** KDOR jurisdiction code from Pub. KS-1700 "Sales & Use Tax Jurisdiction Codes". It is a 5-character code, kept as text.
**Rates as of:** July 1, 2026 edition (current on 2026-09-15).

## Sources
- KDOR Pub. KS-1700, July 2026 (xlsx). This is the source of every code, rate, date and address range:
  https://www.ksrevenue.gov/pdf/pub17000726.xlsx
  - Linked from https://www.ksrevenue.gov/salesratechanges.html
  - **Retrieval note:** ksrevenue.gov refused or timed out every connection from this machine (curl and WebFetch, even with correct DNS). The unmodified file was fetched from the Internet Archive's capture of that exact URL:
    `https://web.archive.org/web/20260713110756id_/https://www.ksrevenue.gov/pdf/pub17000726.xlsx`
  - SHA-1 of the file: 3d5e9dff9294d04a679504b89a13f777e5697410.
  - Its cover sheet reads "effective July 1, 2026". It cross-validates against the independent SST file (see below).
  - Re-download from ksrevenue.gov on a US connection before production use.
- SST rate file `KSR2026Q4AUG19.csv`, used for cross-validation and the FIPS codes in `notes`.
- Census 2020 place/county files, used for FIPS name matching.

## Validation
- For every row, total rate = state + county + city + special. No mismatches.
- 1,067 of the 1,071 KDOR food-item codes appear in the SST file as type-79 records with an identical local rate. This independently confirms the codes and rates.
- 642 of 645 city rows name-match an SST place FIPS with an equal city rate. The 3 without a match are Gove, Le Roy and The Highlands.
- All 105 counties match an SST county FIPS with an equal rate.
- No duplicate codes. Combined rates run 6.5%–12%.

## Complete / missing
- **Complete:** everything in Pub. KS-1700 July 2026.
  - County rows: 105.
  - City rows: 645. A city in more than one county has one row per county portion.
  - Special districts: 321 CIDs, TDDs and STAR bond districts, with their address ranges in `notes`.
- **Missing: the Oct 2026 KS-1700 edition** (`pub17001026.xlsx`) could not be reached.
  - The SST file shows changes on 10/01/2026 for Ashland, Edgerton, Hutchinson and several Hutchinson, Edgerton, Overland Park and Merriam CIDs. They are not reflected here.
- **4 KDOR codes are not in SST:** 17KAN, 18KAN, 19KAN, MFKCI. They are included, because KDOR is authoritative.
- **41 SST type-79 codes are not in KS-1700 July 2026.** Most look like expired TDDs/CIDs that SST still marks current. They were **not** added, since they have no name or KDOR listing. Verify with KDOR if any of these appear on a return:
  C14WI, C18OV, C1EDW, C1GEA, C1GOO, C1KIN, C1OLA, C1ROE, C1SHA, C2HUT, C3MIS, C5KAN, C6DOD, C6WIC, C7KAN, CKTRE, CTHAY, MMHUT, MMREN, N12KA, N13KA, N17KA, N18KA, N19KA, STATF, STOLA, T2KAN, T2LEA, T2OLA, T2WRA, T3KAN, T3MAN, T3OVE, T4MAN, TDELL, TDHAY, TDLAN, TDMAN, TDMER, TDMIS, TDOTT.
- **State row:** KDOR assigns no code to the state, so the row carries SST FIPS `20`.

## Quirks a preparer must know
1. **Every jurisdiction has two codes.** `official_code` is the non-food code, the one to use for vape products, e.g. `ABIDK`. The food code is the same letters reversed in order, e.g. `DKABI`, and is recorded in `notes`.
   - Since 1/1/2025 the state food rate is 0%, so food lines carry only the local rate.
2. **One code per combination, not per taxing body.**
   - `ABIDK` = city of Abilene (ABI) + Dickinson County (DK). The code already bundles the city and county tax; report one line per code with the **total** rate (`combined_rate`, which includes 6.5% state).
   - `XXXCO` codes (e.g. `ALLCO`) are the **unincorporated** area of the county.
3. **Cities split across counties** have one code per portion, with different totals (e.g. Manhattan MANRL 9.15% vs MANPT 9.45%).
4. **Special districts (CID/TDD/STAR bond) replace the city code** for the addresses listed.
   - The code includes state + county + city + district, so do not also report the city code.
   - Most apply to only a few street addresses. The address list is in `notes`, and address-level lookup is required.
   - `local_rate` = county + city + district.
5. `county_name` for cities without "(X County)" in their name comes from the 2-letter county suffix of the code. The suffix→county map was built from the explicit "(X County)" rows plus Census single-county places; all 105 suffixes map one-to-one.
   - 77 special districts have a blank `county_name` because their parent city is ambiguous.
6. Pub. KS-1700 codes are also used on the VR-36, TE-36 and DC-36 returns, but its rates apply only to sales/use tax.
