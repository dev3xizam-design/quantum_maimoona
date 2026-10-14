# NJ - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the NJ revenue department: NJB2019Q2MAR27.csv, NJR2018Q1OCT16.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for NJ on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

NJ: NJR2018Q1OCT16 / NJB2019Q2MAR27 are the current files on SST (6.625%, statewide; UEZ / Salem County reduced rates apply to sellers located there, not to remote sellers).

## Validation against Avalara (Sales Invoices since 2026-07-01)

45 / 45 (state, ZIP, city) keys match (100.0%); 45 / 45 with the invoice's ZIP+4.
