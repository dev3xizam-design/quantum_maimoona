# Illinois (IL): rate-table sources

**Rates in force on 2026-10-01.** Builder: `scripts/rates/states/IL.ts`, default mode `RATES_IL_MODE=rot`.

## Sources

| File | Publisher / URL | Edition | Fetched |
|---|---|---|---|
| `raw/IL/ordmache-current.txt` (location file, 1,596 locations) | IDOR, https://tax.illinois.gov/content/dam/soi/en/web/tax/research/taxrates/documents/salestaxrates/ordmache-current.txt | Last-Modified 2026-06-30; most changed rates take effect 2026-08-01 | 2026-10-14 |
| `raw/IL/ordmacha-current.txt` (address/district file, 44,881 records) | IDOR, same folder, `ordmacha-current.txt` | Same edition | 2026-10-14 |

**Why it is current:** IL local rate changes take effect only on Jan 1 or Jul 1, per IDOR's "Leveling the Playing Field" page. This edition's newest effective date is 2026-08-01. For Chicago it shows 10.25% (2016-01-01 to 2026-07-31) changing to 10.50% from 2026-08-01. No edition takes effect on 2026-10-01.

**Layout used:**
- **ordmache:** location code (cols 1–10), name (11–35), county (36–60), override flag (61), effective date (62–69), Receipts General Merchandise high rate (70–74, v99999).
- **ordmacha:** location code (1–10), district (11–13), name, county, address (64–98), effective date (99–106), rate (107–111).
- **Override locations:** these 200 locations carry flag `Y` and rate 0 in ordmache. Each one's rate is taken from its single blank-address ordmacha record, which is the default outside the business districts.
- **One exception:** 082-0074-2, the St. Clair County part of Columbia, is flagged but has no ordmacha records. It takes the rate of Columbia's Monroe County location 067-0003-9 (7.5%).

## Which regime applies (the main decision)

- A remote retailer over the $100,000 / 200-transaction threshold owes the **destination Retailers' Occupation Tax**: state plus all local ROT at the delivery address.
  - Rule: Leveling the Playing Field, 86 Ill. Adm. Code 131.110 (https://www.law.cornell.edu/regulations/illinois/Ill-Admin-Code-tit-86-SS-131.110).
  - IDOR: remote retailers "must use the Search by Address option to find local tax rates" (https://tax.illinois.gov/research/taxinformation/sales/level-the-playing-field.html).
- The store files 200+ IL invoices a year, so it is over the threshold.
- `RATES_IL_MODE=use` reproduces the 6.25%-only behaviour of the old Avalara account. Keep it only for reconciling past filings.

## Validation against Avalara (Sales Invoices 2026-07-01 → 2026-09-30)

- **Default (rot): 1 / 40 keys, 1 / 59 docs.**
- **use mode: 40 / 40 keys.** This proves the lookup path works; only the regime differs.

### (b) Avalara wrong per the official source: 38 keys / 57 docs

Avalara charged **6.25% only** on every IL order. RTA, county and city components were present at 0%. Under the rule above, local ROT was due. Examples, as IDOR rate (effective date) against Avalara's 6.25%:

| ZIP / city | IDOR rate (effective) |
|---|---|
| 60611, 60622, 60631, 60654, 60661 Chicago | 10.50% (2026-08-01; 10.25% before that) |
| 60016 Des Plaines; 60067 Palatine; 60130 Forest Park; 60304 Oak Park; 60487 Tinley Park | 10.25% |
| 60714 Niles; 60462 Orland Park | 10.50% |
| 60101 Addison | 9.00% |
| 61832 Danville; 62521 Decatur | 9.25% |
| 62864 Mount Vernon; 62959 Marion | 9.50% |

All 38 differences follow this pattern. The rest are in `_il-mo-co-diff.ts IL`.

### (c) Boundary or label ambiguity

- **60531 Leland (other_row_in_zip):** Leland 6.5% against the unincorporated LaSalle County row. The difference comes only from the regime (Avalara charged 6.25%).
- **Incorporated places with no IDOR location for their Census county portion,** rated as unincorporated county: Crete (Cook), New Milford (Winnebago), Bureau Junction and Peru (Bureau), Time (Pike), Clear Lake (Sangamon). These are slivers of places coded under another county.

### (a) Ours wrong

None found.

## Not modelled

- **Business-district rates** (ordmacha R01…) apply to individual addresses. The ZIP table uses each location's default rate.
- **Chicago and Cook County e-cigarette and tobacco taxes** are excise taxes, not ROT, and are out of scope for this table.
- **Component split:** IDOR publishes combined rates only. County = the county's unincorporated local rate; City = the rest.
