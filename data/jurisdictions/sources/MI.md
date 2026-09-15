# Michigan

**Status: COMPLETE.** 1 row: state only.

## Sources
- SST rate file `sst/all/MIR2023Q1DEC22.csv`: a single current state row, 6%, 1994-01-01 to 2999-12-31.
- Michigan Treasury, Sales and Use Taxes: https://www.michigan.gov/taxes/business-taxes/sales-use-tax. Blocked (HTTP 403) for direct download here. The official page text confirmed "6%" and that Michigan has no city, county or local sales tax.

## Rows
- **Michigan (state)**: code 26 (SST FIPS), 6%.

## Notes
- Michigan has no local sales tax, so it has no local jurisdiction codes. Every Michigan sale is reported at 6% on the state return.
- The SST file is dated Dec 2022, but the rate has not changed since 1994.
