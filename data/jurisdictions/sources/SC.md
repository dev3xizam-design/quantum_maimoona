# South Carolina (SC) - local sales/use tax jurisdiction codes

**File:** states/SC.csv - **248 rows** (1 state, 42 county-wide tax codes, 171 municipal Local Option codes, 32 unincorporated-county Local Option codes, 1 municipal Tourism Development code, 1 Catawba tribal row).
**Code system:** SCDOR 4-digit local tax processing codes printed on ST-575 and entered on the ST-389 Schedule for Local Taxes (filed with ST-3 / ST-455).
**As of:** 2026-09-15 (ST-575 Rev. 2/5/26, which already reflects the May 1, 2026 changes).

## Sources (all official SCDOR)
- ST-575 "South Carolina Sales Tax Rate by Municipality" (Rev. 2/5/26): https://dor.sc.gov/sites/dor/files/forms/ST575.pdf - all codes, total rates, accommodations and unprepared-food rates. Parsed programmatically: 340 location lines, 0 unparsed; every line's total = 6% + 1% x (number of local taxes).
- Local Sales Taxes page (effective dates by tax type, recent changes): https://dor.sc.gov/sales-use-tax-index/local-sales-taxes
- ST-389 Schedule for Local Taxes (Rev. 1/05/23) + instructions: https://dor.sc.gov/sites/dor/files/forms/ST389.pdf, https://dor.sc.gov/sites/dor/files/forms/ST389Inst.pdf
- ST-500 local tax map (effective May 1, 2026): https://dor.sc.gov/sites/dor/files/forms/ST500.pdf (cross-check)
- Policy Manual Ch. 18 Catawba Indian Reservation: https://dor.sc.gov/sites/dor/files/Documents/Policy%20Manuals/Chapter%2018%20-%20Catawba%20Indian%20Reservation%20-%20State%20and%20Tribal%20Sales%20and%20Use%20Taxes.pdf

## Completeness
**Complete** for all SCDOR-administered local sales & use taxes:
- Capital Projects (CP) 23 counties; Education Capital Improvement (ECI) 10; School District (SD) 3 (Dillon, Marlboro, Lexington); Transportation (TT) 6 (Richland, Charleston, Berkeley, Dorchester, Horry, Jasper); Local Option (LO) 32 counties = 32 unincorporated codes + 171 municipal codes; Tourism Development (TD) Myrtle Beach 2615.
- Counts match the Local Sales Taxes page lists (CP 23, LO 32, etc.).
- Counties with NO local sales tax (no code, no row): Beaufort, Greenville, Oconee.

Not included / gaps:
- **Catawba Tribal Tax:** SCDOR publishes no code; ST-389 section 4 is a single uncoded 7% line. Row included with blank official_code.
- **County Green Space Tax:** ST-389 section 7 exists, but SCDOR states no county currently imposes it (older Ch.12 manual listed Beaufort Green Space 5/1/23; it is not on the current ST-575). No row.
- Locally collected taxes (local accommodations, hospitality/prepared-meals, beach fees) are collected by counties/municipalities directly and are not on ST-575 - out of scope.
- ST-575 total rates for municipalities marked * (multi-county) are per county portion; boundary data is not published in the ST-575.

## Code-system quirks a preparer must know
1. **Codes are per tax type, not per place.** A delivery address can need 1-3 ST-389 entries: county-wide taxes (CP/ECI/SD/TT) use the county's code; Local Option uses the **municipal** code inside city limits or the unincorporated county code outside.
2. **The same 4-digit number can mean two different taxes.** E.g. 1010 = Charleston County Transportation Tax (section 3) AND unincorporated Charleston County Local Option (section 5); 1003 = Allendale CP and unincorporated Allendale LO. Always key on (code + ST-389 section). In the CSV these are distinguished by jurisdiction_type (county vs unincorporated).
3. Municipalities in counties with only county-wide taxes (e.g. Rock Hill, York County CP) have no code of their own - report under the county code (the county row's notes list the municipalities).
4. Multi-county municipalities (ST-575 *) have separate LO codes per county portion (e.g. Charleston 2129 Berkeley / 2130 Charleston; Summerville 2875/2876; North Charleston 2656/2658; Dorchester portions have no LO).
5. Charleston County TT (1010) is two 0.5% transportation taxes reported together at 1%.
6. Unprepared food is 0% state but local taxes may apply: LO and most TT apply to unprepared food; CP, ECI, SD and the Horry/Jasper TT exempt it (see notes per row / ST-575 food column).
7. Maximum-tax items ($500 cap) are generally exempt from local taxes (ST-389 worksheet deduction).
8. **Catawba Reservation:** tribal tax is in lieu of state+local (7%); but a remote seller outside SC registered with SCDOR delivering onto the reservation owes 6% state use tax only (Ch. 18 chart).
9. Tax rates change on May 1 (CP/LO/TT typically) and March 1 (ECI/SD) - re-pull ST-575 after each.
