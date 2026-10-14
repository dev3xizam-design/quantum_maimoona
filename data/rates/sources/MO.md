# Missouri (MO): rate-table sources

**Intended as-of date: 2026-10-01. ⚠ The data is the July 2026 quarter (Jul–Sep), because the October 2026 chart could not be fetched.**

Builder: `scripts/rates/states/MO.ts`.

## Sources

| Data | Publisher / URL | Edition | Status |
|---|---|---|---|
| Jurisdiction directory rows (`data/jurisdictions/us-jurisdictions.csv`, MO) | MO DOR TA0300 "Sales and Use Tax Rate Tables — July, August, September 2026 (Updated 5/22/2026)", https://dor.mo.gov/pdf/rates/2026/july2026.xlsx | Q3 2026 | Used |
| October 2026 chart | https://dor.mo.gov/pdf/rates/2026/october2026.xlsx (.pdf also exists) | Q4 2026, effective 2026-10-01 | **Not retrieved** |

**Why October is missing:** dor.mo.gov sits behind Imperva/Incapsula and returns HTTP 403 to this machine for curl, WebFetch and real Chrome alike. The browser got an Imperva challenge page, which was not bypassed. The Wayback Machine has no capture of `october2026.*`.

**To fix:** from a US browser, download `october2026.xlsx` into `data/rates/raw/MO/` and rebuild. `MO.ts` picks up the newest `<month><year>.xlsx` automatically, overrides use rates code by code, and reports how many changed.

## Rate used

- A remote seller collects Missouri's **vendor's use tax** (SB 153, from 2023-01-01). That is the chart's **use** rate, not its sales rate.
- Many local sales taxes have no matching use tax, so the use rate is often lower. For example, St. Louis County's use rate is 0%.
- State rate: 4.225%.

**Mapping:**
- Each Census piece maps to its city's base chart row (code `PPPPP-CCC-000`) in its county, using county FIPS (Ste. Genevieve: Census 186 = DOR 193).
- Pieces outside any city map to the county's unincorporated row (`00000-CCC-000`).
- Where no `-000` row exists (whole area inside an ambulance or emergency district), the lowest district suffix is used: Camden, Marion, Morgan, Scott and Shelby counties, and villages such as Byrnes Mill and St. Cloud.

## Validation against Avalara (Sales Invoices 2026-07-01 → 2026-09-30)

**13 / 16 keys, 20 / 23 docs.**

### (c) Boundary ambiguity: postal city is not the incorporated city (3 keys)

| ZIP | Avalara | Ours | Explanation |
|---|---|---|---|
| 63138 "Saint Louis" | 4.225% | 9.013% | The St. Louis City row was picked by city name. The address is in unincorporated St. Louis County (4.225%, also a row in this ZIP). |
| 63303 "Saint Charles" | 5.95% | 7.95% | Avalara put the address outside St. Charles city limits. Our unincorporated St. Charles County row is 5.95%. |
| 65583 "Waynesville" | 4.225% | 6.475% | Avalara put the address outside Waynesville city limits (Pulaski County unincorporated, 4.225%). |

The ZIP table cannot settle these without address geocoding. Passing ZIP+4 does not help, because MO has no ZIP+4 rows.

### (a) Ours wrong / (b) Avalara wrong

None found among the keys.

### Other notes

- 34 small incorporated places have no chart row and are rated as unincorporated county. Examples: Peaceful Village, Lake Tekakwitha, Bellerive Acres (the chart says "BELLERIVE"), Glen Echo Park, Tarrants, Vandalia (Ralls portion).
- **Component split:** the chart publishes only combined rates. County = the county's unincorporated use rate (capped at the total); City = the rest.
