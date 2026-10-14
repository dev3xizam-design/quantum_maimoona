# IA - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the IA revenue department: IAB2026Q4AUG31.csv, IAR2025Q3MAY30.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for IA on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

The IA SST rate file is dated 2025Q3 and is still the latest IA rate file SST lists (checked 2026-10-14); no IA rate entry begins after 2024-01-01.

## Validation against Avalara (Sales Invoices since 2026-07-01)

2 / 8 (state, ZIP, city) keys match (25.0%); 2 / 8 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 52031 | BELLEVUE | 0.06000 | 0.07000 | (b) Avalara wrong. IAR2025Q3MAY30: 63-98097 (Jackson County LOST) 1%, since 2020-01-01. Avalara lists JACKSON at 0%. |
| 52803 | DAVENPORT | 0.06000 | 0.07000 | (b) Avalara wrong. Iowa DOR SST rate file IAR2025Q3MAY30: code 63-98163 (Scott County LOST) 1% interstate, in force 2020-01-01 to open. Avalara's own record lists SCOTT/DAVENPORT at 0%. |
| 50035 | BONDURANT | 0.06000 | 0.07000 | (c) ZIP has a 6% area and a 7% (LOST) area; our ZIP-level pick is the LOST area. Avalara's 6% would be right only if the address is outside the LOST area - likely the same LOST omission as the (b) cases. |
| 52761 | MUSCATINE | 0.06000 | 0.07000 | (b) Avalara wrong. IAR2025Q3MAY30: 63-98139 (Muscatine County LOST) 1%, since 2020-01-01. |
| 52755 | LONE TREE | 0.06000 | 0.07000 | (c) as 50035 (ZIP split between LOST / no-LOST areas). |
| 52732 | CLINTON | 0.06000 | 0.07000 | (b) Avalara wrong. IAR2025Q3MAY30: 63-98045 (Clinton County LOST) 1%, since 2020-01-01. |
