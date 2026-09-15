# Tennessee — local sales/use tax jurisdiction codes

**File:** `states/TN.csv` — **484 rows** (1 state, 95 county, 380 city, 8 transit). Effective as of 2026-09-15.
**Code system:** TN DOR **situs code** (4 digits, text, leading zeros). The first two digits are the county number (counties in alphabetical order, 01 Anderson to 95 Wilson). The last two are `00` for the county, which covers its unincorporated area, or the city number.
**Built by:** `build_TN_parse.py`, `build_TN.py` (downloads are in `raw/TN/`).

## Access problem (read first)
Every tn.gov host (`www.tn.gov`, `revenue.support.tn.gov`, `data.tn.gov` Tableau, `tnmap.tn.gov`) returned **HTTP 403 or timed out** from this machine's network. WebFetch got 403 too. So I could not download anything live from tn.gov. All TN DOR documents below are **byte-for-byte Internet Archive (Wayback `id_`) copies of the official tn.gov files**, with the original tn.gov URL recorded. No third-party tax sites were used.

## Sources
| Purpose | Official URL | Copy used |
|---|---|---|
| Situs codes, names, FIPS cross-reference (main source) | https://www.tn.gov/content/dam/tn/revenue/documents/taxes/sales/taxlist.pdf ("Tennessee Sales and Use Tax County and City Local Tax Rates", revised Nov 2022) | Wayback capture 2023-03-23 (latest distinct version; tn.gov removed the file by Feb 2025) |
| Independent check of the situs code list | https://www.tn.gov/content/dam/tn/revenue/documents/pubs/situs01.pdf ("County & City Situs Codes") | Wayback capture 2025-10-22, so still hosted on tn.gov in Oct 2025 |
| **Current rates** (and FIPS keys) | TN SST rate file TNR2026Q4AUG21.csv | `sst/all/TNR2026Q4AUG21.csv` (already downloaded) |
| Transit surcharge mapping | https://www.tn.gov/content/dam/tn/revenue/documents/taxes/sales/streamlined/TNB2026Q3MAY22.zip (SST boundary file) | Wayback capture 2026-07-28 |
| Davidson transit surcharge | https://www.tn.gov/content/dam/tn/revenue/documents/notices/sales/sales24-11.pdf | Wayback |
| Out-of-state dealer local reporting | https://www.tn.gov/content/dam/tn/revenue/documents/notices/sales/sales19-05.pdf ; Sales & Use Tax Manual June 2025 https://www.tn.gov/content/dam/tn/revenue/documents/tax_manuals/june-2025/Sales-Use-Tax-Manual.pdf (p.206 and fn 606) | Wayback |
| Rate-change notices cross-checked | sales24-10 (Johnson Co.), 24-12 (Giles Co.), 24-13 (Hendersonville food), 25-01 (Gallatin), 25-27 (Nashville CBID) | Wayback |

## Validation
- taxlist.pdf (475 situs codes) and situs01.pdf (475 codes) contain **exactly the same set of codes**.
- All 475 FIPS keys in taxlist match the 475 current county, city and type-63 rows in the Aug-2026 SST rate file, in both directions. One typo in the list's main table is fixed: situs 5502 Adamsville (McNairy) is printed with FIPS 66940, which belongs to Selmer. Page 6 of the same PDF and the SST file both give 95502.
- No new situs jurisdictions have appeared since the Nov 2022 list, since every current SST jurisdiction maps to a listed code.
- **Rates come from the current SST file, not the 2022 PDF.** 14 rates changed after 2022: Cannon Co. and its cities, Somerville, Giles Co. and its cities, Johnson Co. and Mountain City, Gallatin, Portland (Sumner part, 2026-08-01) and Hendersonville. Each of these agrees with a DOR notice where I found one.
- No duplicate keys. All rates are between 0 and 0.15. `local_rate` is the jurisdiction's total local option rate (1.5% to 2.75%). `combined_rate` = 7% + local, plus 0.5% in the eight Davidson surcharge areas.

## Complete / missing
- **Complete** for every county, city and county-portion-of-a-city situs code, plus the Davidson transit surcharge.
- **Transit rows:** these use the SST code (91950–91958, `code_system = SST FIPS`), because no DOR-published surcharge code was reachable. Notice 24-11 says the surcharge goes on "a new schedule" but does not print codes. Each row's `paired_code` is the situs code of the jurisdiction it overlays. I derived that pairing from the official boundary file, where each surcharge code appears only together with one place or county FIPS. Check the actual TNTAP schedule labels before relying on these codes.
- **Not included (not a remote-seller item):** the Nashville Central Business Improvement District 0.5% fee (Schedule D). It applies only to retailers *located* in the district and has no rate or boundary-file code. Also excluded are the special flat local rates for specified digital products and telecom (2.5%), vending (2.25%) and interstate common carriers (1.5%).

## Quirks a preparer must know
1. **There is no flat local rate option for remote sellers.** The 2.25% "uniform local rate" option was **repealed effective 2019-10-01** (Notice 19-05; Manual fn 606). The "2.5% local" figure people often quote applies only to specified digital products and intrastate telecom. It is **not** a remote-seller election. An out-of-state dealer uses one out-of-state location profile with **situs code 9900** (shown as `paired_code` on the state row). It reports local tax on **Schedule B of the SLS 450** under the **delivery-destination situs code**.
2. **City sales must be reported under the city's situs code, not the county's**, even when the rates are the same (Notice 19-05's example: Chattanooga must not be reported as Hamilton County).
3. **Cities in more than one county** (marked with `*` on the DOR list) have **one situs code per county portion**. Most of those portions use a pseudo-FIPS of "9" + situs code (e.g. Goodlettsville: 1905 in Davidson, 8307 in Sumner). Their rates can differ by portion (e.g. Johnson City 2.5%, 2.75% or 2.25% depending on county).
4. **Single-article rule:** local tax applies only to the first $1,600 of any single article of TPP. Hamblen Co. caps at $300 and Hancock Co. at $375. On top of that, state single-article tax of 2.75% applies to the portion from $1,600.01 to $3,200. Services are not capped.
5. **Food rates:** the state rate on food is 4%. Some localities have reduced local food rates, flagged in `notes` (Hendersonville 2.25%). The SST file schedules Davidson County and its cities to a 1.75% local food rate from 2026-11-01 (general rate unchanged).
6. **Davidson County transit surcharge:** 0.5% from 2025-02-01 in Davidson County's unincorporated area, Nashville, Belle Meade, Berry Hill, Forest Hills, Oak Hill, and the Davidson portions of Goodlettsville and Ridgetop. It is reported on a separate schedule and is subject to the $1,600 single-article limit. It is not charged in the Sumner or Robertson portions of Goodlettsville and Ridgetop.
7. `effective_from` is the begin date of the current SST rate row.
