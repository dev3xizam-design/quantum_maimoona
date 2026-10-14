# OK - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the OK revenue department: OKB2026Q4AUG28.csv, OKR2026Q4AUG17.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for OK on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Validation against Avalara (Sales Invoices since 2026-07-01)

10 / 13 (state, ZIP, city) keys match (76.9%); 12 / 13 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 73013 | EDMOND | 0.08625 | 0.08250 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 73012 | EDMOND | 0.08625 | 0.08250 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 73099 | YUKON | 0.08975 | 0.08850 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
