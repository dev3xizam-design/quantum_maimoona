# Arizona (AZ) - rate table sources

**As of:** 2026-10-01. Builder: `scripts/rates/states/AZ.ts`. Tax: Transaction Privilege Tax for remote sellers / marketplace facilitators, **business code 605**, destination-sourced.

## Sources (official, fetched 2026-10-14)
| File | Official URL | Notes |
|---|---|---|
| `data/rates/raw/AZ/TPT_RATETABLE_ALL_10012026_code605.csv` | https://azdor.gov/sites/default/files/document/TPT_RATETABLE_ALL_10012026.csv (HTTP Last-Modified 2026-09-11) | The 147 business-code-605 rows of ADOR's full rate table (RegionCode, rate %, start, end). azdor.gov is behind a Cloudflare challenge, so the CSV was fetched from a real browser session and the 605 rows extracted. The Nov-1 table (TPT_RATETABLE_ALL_11012026.csv, posted 2026-10-02) is byte-identical. |
| Quantum jurisdiction directory (`data/jurisdictions/us-jurisdictions.csv`) | built from ADOR TPT_RATETABLE_ALL_09012026.csv + Table 2 | Region names and the city -> county region pairing (ADOR Table 2). Rates are NOT taken from it. |

Region (3-letter) 605 rates include the 5.6% state rate; city (2-letter) rates are the city's own.

Changes effective 2026-10-01 vs the Sep table (in the directory): **SZ San Tan Valley** new, 2.25% (town incorporated after Census 2020, still a CDP there - treated as the city); **TY Tusayan** 2% -> 4%.

## Method
Per Census 2020 piece: State 5.6% + county excise (county region 605 rate - 5.6%) + the city's 605 rate when the piece is in an ADOR city of that county. Not applied (boundaries Census places don't carry): Indian-reservation regions, MCB/MCZ (Maricopa stadium/tourism districts), PAD (Rio Nuevo).

## Validation vs Avalara (Sales Invoices since 2026-07-01)
**0 / 30 keys match.** 14 of the 30 match exactly once the county excise is removed; every other difference is classified below. Avalara's AZ history is below the official 605 rates almost everywhere.

### (b) Avalara wrong per the official ADOR table - kept ours
| Case | Avalara | Official (TPT_RATETABLE_ALL_10012026.csv, code 605) | Keys |
|---|---|---|---|
| **County excise charged at 0% in every county** (Avalara lists each county jurisdiction with rate 0) | Maricopa 0, Pinal 0, Pima 0, Cochise 0, Gila 0, Coconino 0, Yavapai 0, Mohave 0 | MAR 6.3% (= 5.6 + 0.7), PNL 6.7% (+1.1), PMA 6.1% (+0.5), COH 6.6% (+1.0, eff 2026-07-01), GLA 6.6%, COC 6.9%, YAV 6.35%, MOH 5.6% (+0) | all 30 |
| Scottsdale city rate | 1.5% (85251, 85255) | SC 1.7%, effective 2025-07-01 | 2 |
| Avondale city rate | 1.5% (85323) | AV 2.5%, effective 2019-10-01 | 1 |

### Oct-1 change (expected)
| ZIP | City | Avalara | Ours | Why |
|---|---|---:|---:|---|
| 85140, 85143 | San Tan Valley | 5.6% | 8.95% | San Tan Valley's 2.25% (SZ) starts 2026-10-01, after these invoices; plus Pinal excise 1.1% (b). |

### (c) Boundary / address-level
| ZIP | City | Avalara | Ours | Why |
|---|---|---:|---:|---|
| 85254 | Scottsdale | 8.4% (Phoenix city 2.8%) | 8.0% | Postal Scottsdale, address inside Phoenix city limits. |
| 85310 | Glendale | 8.4% (Phoenix 2.8%) | 9.2% | Postal Glendale, address in Phoenix. |
| 85742 | Tucson | 8.1% (Marana 2.5%) | 6.1% | Postal Tucson, address in Marana; ZIP mostly unincorporated Casas Adobes. |
| 85305 Glendale, 85340 Litchfield Park, 85602 Benson, 85643 Willcox, 86046 Williams, 86409 Kingman, 85741 Tucson | | 5.6% (state only) | city rate applied | Avalara charged no city tax; consistent with addresses outside city limits (large rural ZIPs / unincorporated pockets). Not provable without the street address. |
| 85144 | Queen Creek | 5.6% | - | ZIP created after the 2020 Census ZCTAs - no row (needs a post-2020 ZIP fallback in the shared geo step). |
