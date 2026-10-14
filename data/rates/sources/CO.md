# Colorado (CO): rate-table sources

**Rates in force on 2026-10-01.** Builder: `scripts/rates/states/CO.ts`.

## Sources

| Data | Publisher / URL | Edition | Notes |
|---|---|---|---|
| Rates: state, state-collected county/city, RTD, CD, RTA, MTS, HSD, FPD, LID, MDT… | CDOR **DR 1002 Colorado Sales/Use Tax Rates**, published as a Data Studio report at https://lookerstudio.google.com/reporting/b987b537-d28e-4429-a74d-c5db9ade7e9c (embedded at tax.colorado.gov/DR1002) | **July 2026** | Captured into the jurisdiction directory |
| Location codes | CDOR DR 0800 dated 06/13/25 (Wayback capture) | 2025 | Via the directory |
| Which taxes apply at each location code | CDOR "Colorado_Jurisdiction_Codes_Rates_Jan-June2025_REV.xlsx" (Wayback capture) | Jan–Jun 2025 | Used for **which** taxes apply at a code, not their rates |

**Current as of 2026-10-01: confirmed on 2026-10-14.**
- The live DR 1002 report is still headed "July 2026" and says: "All state-collected city/county sales taxes or rate changes may become effective only on January 1 or July 1."
- So no state-collected change can take effect on Oct 1.
- tax.colorado.gov itself is geo-blocked from this machine (Cloudflare challenge / 403).

## How a rate is built

1. **Location code:** each Census piece maps to a DR 0800 code for its county and place.
   - When a place has several codes (RTD vs CD-only, LID, PIF zones), the plain one is used.
   - Pieces outside any city use the county's "Unincorporated" code, or a code named after the CDP (e.g. Highlands Ranch, Pueblo West).
2. **Rates and districts:**
   - State 2.9% applies everywhere.
   - County uses the DR 1002 July 2026 rate. A county DR 1002 does not list (e.g. Weld, Denver) has 0.
   - Each district named at the code takes its current DR 1002 rate. The district is identified by the location code named in DR 1002, or by a boundary text naming the place or county.
   - **Fallback:** 2025 spreadsheet values are used only for Roaring Fork RTA members outside Aspen and Snowmass (Glenwood Springs, Carbondale, New Castle) and for Green Mountain Falls. DR 1002's RFTA row lists Aspen, Snowmass and unincorporated Pitkin only.
3. **"Rate includes" counties:** DR 1002 rates for Eagle, Pitkin and Summit already include MTS, and Rio Grande and Mineral include the HSD. The county figure is reduced by that district, so it isn't counted twice.
4. **New districts:** DR 1002 districts that the 2025 code list predates are added where the boundary names a whole county or one place.
   - Added: Delta HSD, Montezuma HSD, and the Evans, Aspen, Carbondale, Cimarron Hills, Clifton and Lake City FPDs.
   - Not mapped, because the boundaries are vague: Southeast Jefferson LIDs, South Park and Ute Pass HSDs, Pueblo Rural FPD, South Adams County FPD, Upper Pine River FPD, Confluence ECD.
   - Not mapped: **La Veta FPD**. DR 1002 prints its boundary as "Lake City area…", an apparent CDOR copy error.
5. **Home-rule self-collected city taxes are left out:** Denver, Aurora, Arvada, Lakewood, Colorado Springs, Pueblo, Grand Junction and others.
   - These are not collected through CDOR.
   - Each city has its own economic-nexus threshold, generally $100,000 of sales into that city, which this store is unlikely to meet in any one city.
   - This is a policy choice, not a rate question. Revisit it if sales into any home-rule city approach its threshold.

## Validation against Avalara (Sales Invoices 2026-07-01 → 2026-09-30)

**25 / 32 keys, 29 / 41 docs.**

### (a) Ours wrong: found and fixed

- **Vail / Eagle County, 81657:** we were 5.4%, Avalara and DR 1002 give 4.9%. We counted Eagle's MTS twice; fixed by step 3.
- **Evans, 80620:** we were 2.9%, Avalara and DR 1002 give 3.9%. The Evans FPD (1%, DR 1002 July 2026) was missing because the 2025 code list predates it; fixed by step 4.

### (b) Avalara wrong per the official source

**Scientific & Cultural Facilities District (CD) charged at 10% instead of 0.1%.** DR 1002 July 2026 gives "CD tax 0.1%". These are Avalara rate errors on individual invoices:

| ZIP | Invoice date | Avalara total | CD as charged | Correct total |
|---|---|---|---|---|
| 80202 Denver | 2026-09-12 | 13.9% | 0.1 | 4.0% |
| 80232 Lakewood | 2026-08-28 | 14.4% | 0.1 | 4.5% |
| 80130 Highlands Ranch | 2026-07-08 | 14.9% | 0.1 | 5.0% |

Other invoices to the same ZIPs (80232 on 2026-09-30, 80130 on 2026-08-25) carry the correct 0.001.

### (c) Boundary ambiguity: the ZIP/city pick cannot see the address (6 keys)

| ZIP | Avalara | Ours | Explanation |
|---|---|---|---|
| 80123 Littleton (Jefferson) | 5.0% | 4.25% | Postal Littleton in unincorporated Jefferson County inside the SE Jefferson LID. The city pick took Littleton / Arapahoe. |
| 80129 Highlands Ranch | 4.0% | 5.0% | Address outside RTD. Highlands Ranch has both RTD/CD and CD-only codes, and the ZIP table carries the RTD one. |
| 80134 Parker | 4.0% | 5.0% | Same issue: "Parker (Incorporated, CD)" is outside RTD. |
| 80465 Morrison | 5.0% | 8.25% | Postal Morrison in unincorporated Jefferson County with the LID. Ours used the Town of Morrison (state-collected 3.75%). |
| 80831 Peyton | 3.9% | 5.13% | The ZIP spans El Paso and Elbert counties. The address is in Elbert; the city pick took the Peyton CDP in El Paso. |
| 81007 Pueblo | 5.9% | 3.9% | Postal "Pueblo" inside Pueblo West Metropolitan District (2%). Our Pueblo West row is 5.9%, but the address was labelled Pueblo. |

### Other notes

Four incorporated pieces have no location code for that county and are rated as unincorporated: Central City (Clear Creek), Thornton (Weld), Williamsburg (Fremont), Carbonate (Garfield).
