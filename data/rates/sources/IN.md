# IN - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the IN revenue department: INB2005Q1JAN6.csv, INR2008Q4MAY7.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for IN on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

IN has no local sales taxes; INR2008Q4MAY7 / INB2005Q1JAN6 are the current files on SST (7% unchanged since 2008-04-01).

## Validation against Avalara (Sales Invoices since 2026-07-01)

38 / 38 (state, ZIP, city) keys match (100.0%); 38 / 38 with the invoice's ZIP+4.
