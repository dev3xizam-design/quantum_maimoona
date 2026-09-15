# Vermont — 1% local option sales tax municipalities

**Status: COMPLETE for local option SALES tax jurisdictions (SST FIPS). The state return's own municipality codes, if it has any, could not be checked (DOR site blocked).**

## Sources
- **Streamlined Sales Tax rate file VTR2026Q4AUG20** (`sst/all/VTR2026Q4AUG20.csv`), filed by the Vermont Department of Taxes through SST (https://www.streamlinedsalestax.org). Official, current as of 8/20/2026.
- Census 2020 county-subdivision/place files: used only to name the FIPS codes.
- tax.vermont.gov (Local Option Tax page and Local Option Tax Finder) returned **HTTP 403 / CloudFront "request could not be satisfied"** to curl, headless Chrome and WebFetch from this environment. It could not be read.

## Row count: 37
| type | rows |
|---|---|
| state | 1 (6%) |
| town | 27 |
| city | 9 (Burlington, South Burlington, Winooski, Barre, St. Albans, Rutland, Montpelier, Vergennes, Essex Junction) |

No duplicate keys. Every rate is 6% (state) or 1% local = 7% combined.

## Complete
- Every municipality with a current (2026-09-15) 1% local option sales tax in Vermont's SST filing, 36 in all. Adoptions effective **7/1/2026**: Waitsfield, Morristown, Fair Haven, Mendon, Pomfret, Vergennes, Bristol, Swanton.

## Not included / caveats
- **Peru (town, FIPS 55000) starts 10/1/2026.** It is in the file but not yet effective, so it is excluded.
- **Montgomery (town, FIPS 45850) ended 9/30/2025.** Excluded.
- The SST file shows 2023-01-01 as the begin date for the older LOT towns. That is when Vermont re-based its SST file to FIPS codes. Before 2023 the file used Vermont-specific type-02 codes 00501–00520, now expired. The actual adoption dates are older.
- **Local option meals & rooms and alcohol taxes** (also 1%) are not in the SST sales tax file and were not loaded. They do not apply to vape retail sales.
- Not verified: whether myVTax asks for a Vermont-specific municipality code rather than the town name.

## Quirks a preparer must know
- Vermont LOT is by **town/city (county subdivision)**, not by county or ZIP.
- Rutland town and Rutland city are separate LOT jurisdictions, as are St. Albans town and St. Albans city.
- Essex Junction is a separate city (listed by the Census as a village). Essex town (FIPS 24175) has **no** local option sales tax row.
- Vermont's tobacco products tax on e-cigarettes is a separate excise return, not part of these codes.
