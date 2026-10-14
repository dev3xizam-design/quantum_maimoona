# MI - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the MI revenue department: MIB2023Q1DEC15.csv, MIR2023Q1DEC22.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for MI on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

MI has no local sales taxes; MIR2023Q1DEC22 / MIB2023Q1DEC15 are the current files on SST (6%).

## Validation against Avalara (Sales Invoices since 2026-07-01)

71 / 71 (state, ZIP, city) keys match (100.0%); 71 / 71 with the invoice's ZIP+4.
