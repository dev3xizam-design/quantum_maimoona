# Pennsylvania

**Status: COMPLETE.** 3 rows: state, Allegheny County, Philadelphia.

## Sources (official, PA Department of Revenue)
- Sales, Use and Hotel Occupancy Tax overview: https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax. Rates: 6% state, plus 1% local in Allegheny County and 2% local in Philadelphia.
- Local Sales Tax page (Act 21 of 2026): https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/local-sales-tax
- REV-717 Retailer's Information Guide (02-26): https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforbusinesses/sut/documents/rev-717.pdf

## Rows
| row | code | rate |
|---|---|---|
| Pennsylvania (state) | 42 | 6% |
| Allegheny County local tax | 42003 | +1% = 7% |
| Philadelphia (City/County) local tax | 42101 | +2% = 8% |

## Code system caveat
PA DOR does **not** publish numeric jurisdiction codes for the local taxes. They are reported as the Allegheny County and Philadelphia local tax amounts on the sales, use & hotel occupancy tax return in myPATH. The `official_code` column holds **Census FIPS**, labelled as such, only so the rows have a stable key. They are not PA return codes.

## Quirks a preparer must know (important for a remote vape seller)
- **Act 21 of 2026** (enacted 7/12/2026, retroactive to tax years beginning after 12/31/2025) made PA local sales tax **destination-based**. A vendor already collecting PA state tax must collect Philadelphia's 2% and Allegheny's 1% on sales **delivered** into those counties.
- **DOR will not enforce the new local rules until 10/1/2026.** Before the Act, the local tax generally followed the vendor's location, and out-of-county vendors could only collect it voluntarily.
- No other PA county or municipality levies sales tax.
- PA's separate Other Tobacco Products tax on electronic cigarettes is a different return.
