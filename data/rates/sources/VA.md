# VA - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- Virginia Tax workbook sales-tax-rates.xlsx (https://www.tax.virginia.gov/sites/default/files/inline-files/sales-tax-rates.xlsx, downloaded 2026-10-14, saved data/rates/raw/VA) - read directly by the builder. 133 localities, components: state 4.3%, local 1%, NVA / HR / CVA / Historic Triangle regional, additional local option (Charlotte, Gloucester, Halifax, Henry, Northampton, Patrick, Pittsylvania, Danville). Identical to the directory. 2026 legislation lets every locality add a 1% school tax only after a referendum + 120-day ordinance lead time, so nothing new can be in force on 2026-10-01.
- Shape: 4.3% + 1% + regional/local option. Census 2020 ZCTA pieces map ZIPs to counties/cities.

## Validation against Avalara (Sales Invoices since 2026-07-01)

48 / 48 (state, ZIP, city) keys match (100.0%); 48 / 48 with the invoice's ZIP+4.
