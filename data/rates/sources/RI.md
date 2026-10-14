# RI - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the RI revenue department: RIB2019Q2MAR27.csv, RIR2019Q2MAR27.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for RI on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

RI has no local sales taxes; RIR2019Q2MAR27 / RIB2019Q2MAR27 are the current files on SST (7%).

## Validation against Avalara (Sales Invoices since 2026-07-01)

7 / 7 (state, ZIP, city) keys match (100.0%); 7 / 7 with the invoice's ZIP+4.
