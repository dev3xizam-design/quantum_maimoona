# WV - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the WV revenue department: WVB2026Q3APR29.csv, WVR2026Q3FEB25.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for WV on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

WVR2026Q3FEB25 / WVB2026Q3APR29 are still the latest WV files on SST (checked 2026-10-14).

## Validation against Avalara (Sales Invoices since 2026-07-01)

3 / 4 (state, ZIP, city) keys match (75.0%); 3 / 4 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 24954 | MARLINTON | 0.06000 | 0.07000 | (b) Avalara wrong. WV SST WVR2026Q3FEB25: Marlinton municipal sales tax 1% (01-51676), effective 2025-07-01. Avalara charged state 6% only on 2026-09-03. |
