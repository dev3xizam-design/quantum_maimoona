# Montana (MT) - jurisdiction codes

**File:** states/MT.csv - **11 rows** (1 state, 10 resort communities/areas)
**Code system:** none. Montana has no general sales tax, and its local resort taxes are administered locally with no state-issued codes.
**Status:** COMPLETE for the list of resort taxes that MT DOR publishes. There are no codes because none exist.

## Sources (official)
- MT DOR "Local Resort Tax" page, with the table of current resort areas and tax rates: https://revenue.mt.gov/taxes/miscellaneous/local-resort-tax
- Big Sky Resort Area District, the local government that administers Big Sky's tax, "1% for Infrastructure" page: https://resorttax.org/about/1-for-infrastructure/
- Census 2020 place file, used for incorporated vs unincorporated status and county names.

## Rows
- **Incorporated:** Red Lodge (city), Whitefish (city), Virginia City (town), West Yellowstone (town).
- **Unincorporated resort areas** (type `district`): Big Sky, Cooke City, Craig, Gardiner, St Regis, Wolf Creek.
- **Rates:** the DOR table shows 3% for all 10. Big Sky is set to **4%**: 3% + 1% infrastructure, effective 2020-07-01, per the District's own page. The 1% lasts until project commitments end or the district expires in 2032.

## Quirks and gaps
- **MT DOR does not administer resort taxes.** Its table "is informational only and may be inconsistent with local laws". Registration and filing are with each community.
- **Possible 1% infrastructure add-ons elsewhere.** Since SB 241 (2019), resort communities may add up to 1% for infrastructure. Other sources say West Yellowstone and Virginia City adopted it. I could not reach an official page to confirm (townofwestyellowstone.com timed out), so those rows keep the DOR 3% with a note. **Verify locally.**
- **What the tax covers:** lodging, food service, bars, destination recreation, and "luxuries" sold in the area (7-6-1501 and 7-6-1503 MCA). Whether it applies to out-of-state sellers shipping into these areas is a local-ordinance question.
- **Blank codes:** duplicate (state, blank code, type) combinations exist only because codes are blank by design.
