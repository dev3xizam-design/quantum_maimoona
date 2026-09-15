# Nevada (NV) - jurisdiction codes

**File:** states/NV.csv - **18 rows** (1 state, 17 county)
**Code system:** NV Department of Taxation county line codes `01`-`17` as printed on the Combined Sales/Use Tax Return REV-F013 (V2026.1). SST FIPS county codes are in each row's notes.
**Status:** COMPLETE. Every local sales tax jurisdiction in Nevada is a county (or Carson City). There are no city-level or special-district sales tax rates that get their own line.

## Sources (official)
- REV-F013 Combined Sales/Use Tax Return, V2026.1: https://tax.nv.gov/wp-content/uploads/2026/01/REV-F013-Sales-and-Use-Tax-Return.pdf. Gives the 17 county line codes and the rate printed on each line.
- Components of Sales and Use Tax Rates: https://tax.nv.gov/wp-content/uploads/2024/12/Components-of-Sales-Tax.pdf. Breaks down the 6.85% statewide minimum and each county's add-on tax.
- SST rate file NVR2025Q4NOV05.csv (local copy sst/all/). Used for rates and effective_from, and as a cross-check. All 17 county rates on REV-F013 match the current SST county records exactly.

## Code list (return order is alphabetical, but Carson City sits at 13)
01 Churchill, 02 Clark, 03 Douglas, 04 Elko, 05 Esmeralda, 06 Eureka, 07 Humboldt, 08 Lander, 09 Lincoln, 10 Lyon, 11 Mineral, 12 Nye, 13 Carson City, 14 Pershing, 15 Storey, 16 Washoe, 17 White Pine.

## Quirks a preparer must know
- **Return codes are not FIPS codes.** For example, return 02 = Clark = FIPS 32003, and 13 = Carson City = FIPS 32510.
- **Report by county of sale, or county of delivery for shipped goods.** Enter sales on the county line for the delivery destination.
- **Rates on the return are combined rates.** They include the 6.85% state portion, and there is no separate state line. `local_rate` in the CSV is the combined rate minus 6.85%.
- **SST rate file layout:** the file gives the state (type 45) a 0% rate and carries the full combined rate on each county record.
- **Collection allowance:** 0.25% of sales tax for timely filing. It does not apply to use tax.
- **SST file age:** the SST file is dated Nov 2025. The 2026 return form confirms the rates had not changed as of V2026.1. I found no official notice of a 2026 NV rate change.
- **Unresolved SST type-63 rows:** the SST file has 9 type-63 codes (32601, 32603 ... 32617) with rates of 8.265% or 8.375% and start dates in 2025. The rate file does not name them, they do not map to Census county or place FIPS codes, and they are not on REV-F013. They are excluded. A boundary file is needed to identify them, and they do not change what is reported on the return, which is by county.
- **Tourism Improvement Districts:** REV-F013 has no TID lines.
