# Wisconsin — county codes, City of Milwaukee, premier resort areas

**Status: COMPLETE**

## Sources (official, Wisconsin Dept. of Revenue)
- **Sales Tax Rate Chart** (county codes 1–72 and rates), guidance doc 100047, dated Jan 16 2026: https://www.revenue.wi.gov/Pages/FAQS/pcs-taxrates.aspx
- **Publication 201** Part 18 (county codes in parentheses, used to cross-check; 0 mismatches), and ST-12 / Schedule CT reporting rules: https://www.revenue.wi.gov/DOR%20Publications/pb201.pdf
- **WI DOR Rate & Boundary file, September 2026**: https://www.revenue.wi.gov/DORReports/WIRandB092026.zip (`WIR092026.csv`). Unlike the SST copy, it includes premier resort area and local exposition rates.
- **Publication 403 (3/26)**, Premier Resort Area Tax: https://www.revenue.wi.gov/DOR%20Publications/pb403.pdf
- **Publication 410**, Local Exposition Taxes: https://www.revenue.wi.gov/DOR%20Publications/pb410.pdf
- SST file `sst/all/WIR2026Q4AUG17.csv`: cross-checked. It matches the DOR file exactly for every state, county and city row. It lacks the 14 PRA and local-exposition rows.

## Row count: 88
| type | rows |
|---|---|
| state | 1 |
| county (DOR codes 01–72) | 72 (70 with 0.5% or 0.9%; Waukesha 67 and Winnebago 70 at 0%) |
| city | 1 (City of Milwaukee 2%, FIPS place 53000) |
| special | 14 (10 premier resort areas, 4 Milwaukee County local exposition taxes) |

No duplicate keys. Every rate is between 0% and 7.9%.

## The 1,851 "city" rows in the SST/DOR rate file
**1,850 are 0.000 placeholders.** The SST layout needs a row for every FIPS place that the boundary file references. Only **City of Milwaukee (53000, 2%)** has a real city tax, which the DOR chart confirms: "the city of Milwaukee is the only municipality that imposes a city sales and use tax". The placeholders were **not** loaded.

## Complete
- All 72 counties with the DOR county code, rate and FIPS. Milwaukee County is 0.9% from 1/1/2024. Manitowoc started 1/1/2025 and Racine 4/1/2025.
- City of Milwaukee.
- All current premier resort areas: Bayfield, Eagle River, Ephraim, Lake Delton (1.25%), Rhinelander, Sister Bay, Stockholm, Wisconsin Dells (1.25%), and the two new areas effective 7/1/2026, **Sturgeon Bay** and **Town of Minocqua**.
- The stadium taxes have ended (baseball 3/31/2020, football 9/30/2015). The DOR file has no current stadium rows, so none are included.

## Missing / limitations
- The DOR chart assigns **no numeric code to the City of Milwaukee** or to premier resort areas. Those rows use the FIPS place code from the DOR rate file, labelled accordingly in `code_system`.
- County codes: the chart prints `1…72`, Pub 201 prints `(01)…(72)`. The CSV stores two digits (`01`). On ST-12 / Schedule CT the county is written as its first five letters plus the code, and Green Lake is written "GLAKE".

## Quirks a preparer must know
- The City of Milwaukee spans Milwaukee, Washington and Waukesha counties. The city 2% is added to whichever county rate applies. In the Milwaukee County part the total is 7.9%.
- **Premier resort area tax applies only to sellers in the SIC codes listed in Pub 403, and that list includes 5993 tobacco stores.** It is reported on a separate PRA return, not ST-12, and is not in the SST file. Confirm the seller's classification before collecting it.
- Local exposition taxes (Milwaukee County: room, food & beverage, car rental) do not apply to vapor-product sales. They are listed for completeness only.
- The DOR boundary files are refreshed monthly (the last 4 months are posted), and retailers must update at least quarterly.
