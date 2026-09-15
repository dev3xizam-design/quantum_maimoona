# West Virginia (WV): sales/use tax jurisdiction codes

**File:** states/WV.csv. **Rows:** 102 (1 state row plus 101 municipalities: 54 city, 45 town, 1 village, 1 municipality). **Status:** COMPLETE for jurisdictions in effect on 2026-09-15. The codes are SST FIPS because WV publishes no code system of its own for returns (see below).

## Sources (official, WV Tax Division)
- https://tax.wv.gov/Documents/sst/Tables/WVR2026Q3FEB25.csv : SST rate table hosted by the WV Tax Division. It is identical to sst/all/WVR2026Q3FEB25.csv and is the source of the codes and rates.
- https://tax.wv.gov/Documents/SUT/MunicipalitiesImposingSalesAndUseTaxes.pdf : "Municipalities Imposing Sales and Use Taxes", issued 4/17/2026 (PDF created 2026-08-28). Source of names, effective dates and rates for the cross-check.
- https://tax.wv.gov/Business/SalesAndUseTax/MunicipalSalesAndUseTax/Pages/MunicipalSalesAndUseTax.aspx : same list as HTML, plus links to the SST files.
- https://tax.wv.gov/Documents/CST/cst200cu.pdf : WV/CST-200CU return, Schedule M. Checked to see which code the return uses.
- https://tax.wv.gov/Documents/sst/Tables/WVB2026Q3APR29.csv : SST boundary file. Downloaded but not needed, because it carries place FIPS and no county.
- County names come from census/national_county2020 and national_place2020 (Census 2020), used only for county_name and the city/town/village type.

Build script: build/wv.py.

## Code system
- **The return has no municipal code.** CST-200CU Schedule M column A is "Municipality Name". Taxpayers reporting more than 10 municipalities must e-file on MyTaxes. The Tax Division publishes no numeric municipal code list.
- The only official code WV publishes for each municipality is the **SST FIPS place code** in its own SST rate table. `official_code` is that 5-digit place FIPS with leading zeros kept (e.g. 14600 Charleston, 00772 Alderson), and `code_system` = "SST FIPS (WV Tax Division SST rate table)". The state row is code `54`.

## Cross-check
- All 101 current SST municipal rows (type 01, begin on or before 2026-09-15, end 99991231) matched a municipality on the DOR list by name. Rates agree: 1% municipal, 7% combined.
- The DOR list has 107 entries. The 6 not in the CSV are **future-dated 2027-01-01** and so are excluded: Danville, Farmington, Gilbert, Kenova, Keyser, Wellsburg. Add them when January 2027 returns are prepared. The Feb-2026 SST table does not yet contain them.
- Three municipalities started 2026-07-01 and are included: Granville, Ronceverte, Welch.
- `effective_from` is the DOR list's effective date. For Huntington (2012-01-01), Williamstown (2011-10-01) and Rupert (2013-04-01) the SST row begins 2013-07-01 only because the table's history starts there, as noted on those rows.
- Validation: no duplicate codes, rates in range, no rows flagged unmatched.

## Quirks a preparer must know
- The state rate is 6%, and every municipal tax is currently 1%, for a 7% combined rate. The tax applies **only inside municipal boundaries**, not by ZIP. Use the SST boundary file or an address lookup.
- Municipalities that span counties: Huntington (Cabell/Wayne), Wheeling (Marshall/Ohio), Nitro (Kanawha/Putnam), Weirton (Brooke/Hancock), Montgomery and Smithers (Fayette/Kanawha), Paden City (Tyler/Wetzel), Alderson (Greenbrier/Monroe).
- Food for home consumption is 0% at both the state and municipal level (SST food rate 0).
- Historic 0.5% phases, from DOR footnotes: Charleston and Wheeling from 2013-10-01, Moorefield from 2016-07-01, White Hall from 2018-01-01. All are now 1%.
- Name spellings differ between sources: "St. Marys" (PDF) vs "Saint Marys" (HTML), and "Bath (Berkeley Springs)" in Census. Ranson is a Census "corporation", so it is typed `municipality`.
- There are no county-level or special-district sales taxes in WV.
- Out of scope: WV also levies a tobacco products excise on vapor liquid, which is not part of this dataset.

## Missing
Nothing current. The 6 municipalities starting 2027-01-01 are deliberately excluded.
