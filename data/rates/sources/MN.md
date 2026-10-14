# MN - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the MN revenue department: MNB2026Q4AUG18.csv, MNR2026Q4AUG18.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for MN on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Validation against Avalara (Sales Invoices since 2026-07-01)

28 / 34 (state, ZIP, city) keys match (82.4%); 33 / 34 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 55423 | MINNEAPOLIS | 0.23875 | 0.09025 | Not a rate difference: our 9.025% equals Avalara's other invoices for the same ZIP (2026-07-26, 2026-08-05). The 23.875% invoice (2026-08-27) stores Hennepin County as 0.15 - a percent (0.15%) stored where a decimal was expected; the validator's norm() only rescales values > 0.15, so this one slips through. Validator artifact, not Avalara or us. |
| 55073 | SCANDIA | 0.08375 | 0.07375 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 55110 | SAINT PAUL | 0.08125 | 0.08375 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 55108 | SAINT PAUL | 0.08375 | 0.09875 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 55362 | MONTICELLO | 0.07375 | 0.07875 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 55375 | SAINT BONIFACIUS | 0.08525 | 0.08375 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
