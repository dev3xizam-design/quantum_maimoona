# NC - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the NC revenue department: NCB2026Q4AUG19.csv, NCR2026Q3APR23.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for NC on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

NCR2026Q3APR23 is still the latest NC rate file on SST (checked 2026-10-14); it already carries the 2026-07-01 Mecklenburg 1% (26-98119).

## Validation against Avalara (Sales Invoices since 2026-07-01)

50 / 54 (state, ZIP, city) keys match (92.6%); 52 / 54 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 28205 | CHARLOTTE | 0.06250 | 0.08250 | (b) Avalara wrong. NC SST NCR2026Q3APR23: state 4.75% (37-45-37, since 2011-07-01) + Mecklenburg 2% (0-119, since 2009-10-01) + transit 0.5% (79-99119, since 2005-08-01) + 1% (26-98119, effective 2026-07-01) = 8.25%. Avalara charged 6.25% on 2026-09-24 (county 1%, no 26-98119) - below NC's 6.75% statewide minimum. |
| 27592 | WILLOW SPRING | 0.06750 | 0.07250 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 28086 | KINGS MOUNTAIN | 0.07000 | 0.06750 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 28602 | HICKORY | 0.06750 | 0.07000 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
