# WA - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Streamlined Sales Tax rate + boundary files published by the WA revenue department: WAB2026Q4AUG27.csv, WAR2026Q4AUG27.csv (https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/). Confirmed to be the latest files SST lists for WA on 2026-10-14.
- ZIP population weights for split ZIPs: Census 2020 PL 94-171 + ZCTA520 block relationship file.

## Notes

Local rates come from WA DOR's own quarterly table Q426_Excel_LSU-rates-alpha.xlsx ("Effective October 1 - December 31, 2026", https://dor.wa.gov/sites/default/files/2026-08/Q426_Excel_LSU-rates-alpha.xlsx), keyed by the location code on each SST boundary record. Q326 (https://dor.wa.gov/sites/default/files/2026-05/Q326_Excel_LSU-rates-alpha.xlsx) is used only for the Oct-1 change report.

**Fixed (a):** the SST rate file's L-code entry is not the whole local rate for unincorporated PTBA codes (e.g. L0666 Clark Unincorp. PTBA = 0.7% in the SST file; DOR table and DOR address API both give 2.2% -> 8.7%). Previously 98682 Vancouver came out 7.2% and 98240 Custer (L3737) 7.1%; DOR says 8.7% / 8.9%. Verified against https://webgis.dor.wa.gov/webapi/AddressRates.aspx (0666 -> .087, 0605 -> .089, 3737 -> .089, 3403 -> .100).

## Validation against Avalara (Sales Invoices since 2026-07-01)

27 / 33 (state, ZIP, city) keys match (81.8%); 31 / 33 with the invoice's ZIP+4.

## Mismatches

(a) ours wrong -> fixed; (b) Avalara wrong per the official source; (c) boundary ambiguity (ZIP holds several rates; resolved only by the exact address).

| ZIP | city | Avalara | ours | classification |
|---|---|---:|---:|---|
| 98604 | BATTLE GROUND | 0.08000 | 0.08900 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 98502 | OLYMPIA | 0.09600 | 0.10000 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 98292 | STANWOOD | 0.09300 | 0.07900 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 98632 | LONGVIEW | 0.07700 | 0.08200 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 98626 | KELSO | 0.08100 | 0.07700 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
| 98611 | CASTLE ROCK | 0.07900 | 0.07700 | (c) another row in this ZIP carries Avalara's rate; the address sits on a jurisdiction boundary inside the ZIP |
