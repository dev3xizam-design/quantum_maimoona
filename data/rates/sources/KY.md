# KY - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the KY revenue department: KYB2013Q2MAR13.csv, KYR2012Q4Aug13.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for KY on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

KY has no local sales taxes; KYR2012Q4Aug13 / KYB2013Q2MAR13 are the current files on SST (6%).

## Validation against Avalara (Sales Invoices since 2026-07-01)

12 / 12 (state, ZIP, city) keys match (100.0%); 12 / 12 with the invoice's ZIP+4.
