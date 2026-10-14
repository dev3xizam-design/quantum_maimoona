# TN - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the TN revenue department: TNB2026Q4AUG21.csv, TNR2026Q4AUG21.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for TN on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

TN boundary city areas carry no county FIPS; the weighting fix treats that as state-wide place coding. Note: TN rate file has a food-rate change on 2026-11-01 (not relevant to general merchandise).

## Validation against Avalara (Sales Invoices since 2026-07-01)

23 / 25 (state, ZIP, city) keys match (92.0%); 24 / 25 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 37209 | NASHVILLE | 0.07500 | 0.09750 | (b) Avalara wrong. TN SST TNR2026Q4AUG21: Nashville-Davidson local 2.25% (1-52006, since 1989-01-01) + Davidson transit improvement surcharge 0.5% (79-91951, effective 2025-02-01) = 9.75%. Avalara charged 7.5% (local 0.5%). |
| 37660 | KINGSPORT | 0.09500 | 0.09250 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
