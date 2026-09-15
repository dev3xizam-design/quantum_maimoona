# Ohio — UST-1 county codes + transit authorities

**Status: COMPLETE** (all 88 counties, all 16 transit-authority levies, and the state code)

## Sources (official)
- **UST 1 and UUT 1 Code & Rate Table** (Ohio Dept. of Taxation, Jan 1 – Mar 31 2023 edition): https://dam.assets.ohio.gov/image/upload/tax.ohio.gov/sales_and_use/rate_changes/2023/ust-uut_code___rate_table_01-2023.pdf. This is the source of the **UST-1 codes**: 01–88 counties, 89 state, 93/94/96/98 COTA portions, 187 Wood (TARTA/Rossford). It is the newest code table reachable; see limitations.
- **Streamlined Sales Tax rate file** OHR2026Q4AUG27 (`sst/all/OHR2026Q4AUG27.csv`). Source of current rates and effective/expiry dates, county FIPS and transit FIPS place codes.
- **ODT Tax Analysis "Sales and Use Tax Rate Map"**, dated Sept 9 2026, rates as of Oct 2026: https://dam.assets.ohio.gov/image/upload/tax.ohio.gov/tax_analysis/tax_data_series/sales_and_use/Salestaxmap.pdf. Used to cross-check every county's permissive + transit + total rate: 0 mismatches except the scheduled Warren change.
- **TheFinder (ODT)** county list with county numbers 1–88: https://thefinder.tax.ohio.gov/api/file-downloads?type=salesAndUse. All 88 county numbers match the UST table.
- **TheFinder transit FIPS list**: https://api.thefinder.tax.ohio.gov/finder/api/v1/tax-rates/downloads/OHTransitFIPSCodes.txt, fetched through the Finder proxy `/api/file-downloads/content?target=...`.

## Row count: 105
| type | rows |
|---|---|
| state (code 89) | 1 |
| county (codes 01–88) | 88 |
| transit | 16 |

No duplicate (code, type) keys. Every rate is between 5.75% and 8.25%.

## Complete
- Every county with its UST-1 code, current county permissive rate plus any county-wide transit levy (`local_rate`), and combined rate including the 5.75% state rate. The SST county FIPS is in notes.
- Transit rows:
  - **11 county-wide authorities** (ACRTA, GCRTA, COTA-Franklin, SORTA, LAKETRAN, TARTA-Lucas, WRTA, MVRTA, PARTA, SARTA, METRO). These have **no separate UST-1 code**; they are reported inside the county code, and the row repeats that county code.
  - **5 partial-county areas that DO have their own UST-1 code:** Fairfield (COTA) 93 at 7.75%, Licking (COTA) 94 at 8.25%, Delaware (COTA) 96 at 8.00%, Union (COTA) 98 at 8.00%, Wood (TARTA – City of Rossford) 187 at 7.25%.

## Missing / limitations
- ODT's main site (tax.ohio.gov) returned HTTP 403/404 to every request from this environment: curl, headless Chrome and WebFetch. The quarterly "Rates by County" pages and any newer UST code table could not be read. The UST-1 codes therefore come from the **Jan 2023** code table. They are structural and were re-confirmed by TheFinder's current county-number list (1–88), and the transit areas by TheFinder's current transit FIPS file. The 2023 table's **rates are stale and were not used**; rates come from the Aug-2026 SST file and the Sept-2026 ODT rate map.
- **UUT-1 (use tax return) codes are not included.** They combine the county code with rate digits (e.g. 0130 = Adams at 1.50%), so they change whenever a rate changes, and no current official UUT table was reachable.

## Quirks a preparer must know
- **Warren County (83) rises from 6.75% to 7.25% on 2026-10-01.** The row shows the rate in force today, with effective_to 2026-09-30. SST shows 1.50% from 2026-10-01 to 2027-09-30, then 1.00%.
- Many county and transit levies carry expiry dates (effective_to). Examples: Stark/SARTA 2027-06-30, Allen/ACRTA 2029-09-30, Lake/LAKETRAN 2030-03-31, Lucas and Rossford TARTA 2032-03-31. Refresh each quarter.
- For addresses in Columbus/Westerville/Dublin (Delaware Co.), Columbus/Reynoldsburg (Fairfield Co.), Reynoldsburg (Licking Co.), Dublin (Union Co.) and Rossford (Wood Co.), use the **transit code (93/94/96/98/187)**, not the plain county code. Resolve by address with TheFinder. ZIP codes cross these lines.
- On the SST side, transit authorities are jurisdiction type 63 with FIPS place codes 02000…98000 and 87100.
