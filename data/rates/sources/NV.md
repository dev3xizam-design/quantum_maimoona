# NV - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the NV revenue department: NVB2025Q4NOV05.csv, NVR2025Q4NOV05.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for NV on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

SST NV files carry the full combined rate on the county code (state component 0); totals are correct, Avalara splits 4.6% state + county remainder.

**Fixed (a):** primary row per ZIP was wrong because Census weighting excluded incorporated places (Carson City, Fernley) when the boundary file codes no places - 89706 picked Lyon (7.1%) instead of Carson City (7.6%), 89408 picked Churchill instead of Lyon. Fixed in sst.ts (countiesWithPlaces).

## Validation against Avalara (Sales Invoices since 2026-07-01)

13 / 13 (state, ZIP, city) keys match (100.0%); 13 / 13 with the invoice's ZIP+4.
