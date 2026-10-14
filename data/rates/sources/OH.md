# OH - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the OH revenue department: OHB2026Q4SEP17.csv, OHR2026Q4SEP17.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for OH on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Validation against Avalara (Sales Invoices since 2026-07-01)

30 / 32 (state, ZIP, city) keys match (93.8%); 32 / 32 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 45140 | LOVELAND | 0.07800 | 0.06750 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 44460 | SALEM | 0.07500 | 0.07250 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
