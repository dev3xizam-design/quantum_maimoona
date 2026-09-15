# Kentucky (KY)

**Rows:** 1 (state: 1)  
**Code system:** SST FIPS state code `21` (Kentucky's Form 51A102 carries no jurisdiction code).  
**Completeness:** Complete — Kentucky has no local sales/use taxes.

## Sources
- KY DOR Sales & Use Tax page: https://revenue.ky.gov/Business/Sales-Use-Tax/Pages/default.aspx — "imposed at the rate of 6 percent ... There are no local sales and use taxes in Kentucky"; remote retailer thresholds (200 sales or $100,000).
- SST rate file `sst/all/KYR2012Q4Aug13.csv` — single state row (21, type 45, 0.06 general/food, begin 2006-06-01, end 2999-12-31).
- KY DOR Tobacco and Vapor Products Taxes: https://revenue.ky.gov/Business/TobaccoAndVaporProductsTaxes/Pages/default.aspx
- Raw copies: `raw/KY/`

## Preparer notes
- One statewide 6% rate; do not look for county/city codes.
- Remote seller registers if 200+ transactions OR $100,000+ gross receipts into KY in the previous or current calendar year.
- Vapor products also carry a KY tobacco/vapor excise (15% of the distributor's actual price for open vaping kits with liquid and liquid solutions), which is filed with the tobacco return, not the sales tax return. Who owes it depends on licensing (distributor/retail distributor) — out of scope here.
