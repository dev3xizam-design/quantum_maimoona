# New Jersey

**Status: COMPLETE.** 2 rows: state, plus a Salem County reduced-rate reference row.

## Sources
- SST rate file `sst/all/NJR2018Q1OCT16.csv`: current row 6.625% from 2018-01-01. The end date 99990131 is a data typo meaning open-ended.
- NJ Division of Taxation, S&U-4 New Jersey Sales Tax Guide (Rev. 07/22): https://www.nj.gov/treasury/taxation/pdf/pubs/sales/su4.pdf. Covers the 6.625% rate, Urban Enterprise Zones and the Salem County reduced rate.
- Several nj.gov HTML pages returned 404 from this environment. The PDFs downloaded fine.

## Rows
| row | code | rate |
|---|---|---|
| New Jersey (state) | 34 (SST FIPS) | 6.625% |
| Salem County reduced-rate area | 34033 (Census FIPS; NJ assigns no code) | 3.3125% total, seller-location based |

## Complete / not included
- NJ has **no local sales taxes and no return jurisdiction codes**.
- **Urban Enterprise Zones: no rows.** The half rate (3.3125%) is available only to businesses holding a UZ-2 certificate, on sales from their zone location, with delivery at or from that location. It is not a destination rate, and NJ assigns no zone codes. UEZ is explained in the state row notes.
- **Salem County** is included only as a warning row. The half rate applies to in-person sales at a Salem County place of business and **expressly excludes cigarettes and mail-order/catalog/internet sales**.

## Quirk for a remote vape seller
Charge the full 6.625% on every NJ delivery, including into UEZ cities and Salem County. NJ's separate liquid nicotine / container excise is a different return.
