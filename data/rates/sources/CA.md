# California (CA): sales-tax rate table sources

**As of 2026-10-01** (CDTFA Q4 2026 rates). Builder: `scripts/rates/states/CA.ts`. Refetch: `data/rates/raw/CA/fetch.sh` (fetched 2026-10-14).

## Sources (all CDTFA, the California Department of Tax and Fee Administration)

| File (data/rates/raw/CA) | What | Publication |
|---|---|---|
| `tac-layer.json` | **Primary.** CDTFA "Find Your Tax Rate" ArcGIS layer `California_Sales_and_Use_Tax_Rates/FeatureServer/0` (https://services6.arcgis.com/snwvZ3EmaoXJiugR/arcgis/rest/services/California_Sales_and_Use_Tax_Rates/FeatureServer/0). 558 tax area codes (TACs), each with StateRate 7.25% + CountyRate + CityRate. | DateStamp 2026-10-01 |
| `SalesTaxRates10-1-26.xlsx` | Cross-check. CDTFA "Effective Sales and Use Tax Rates, October 2026" city and county list, linked from https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm | October 2026 |
| `data/jurisdictions/us-jurisdictions.csv` (Quantum directory) | Only the Q3 2026 rate of each area, which goes into `prev_total_rate` for validation. | CDTFA data as of 2026-09-15 |

Checks run on every build (any failure stops the build):
- The layer's DateStamp must be 2026-10-01.
- In every TAC, StateRate + CountyRate + CityRate must equal RATE, and StateRate must be 7.25%.
- Sub-area TACs of one local code must carry identical rates.
- All 540 local tax areas (483 cities + 57 unincorporated areas) must agree with the October 2026 xlsx.
  - Result: 540/540 agree.
  - "City of Commerce" and "City of Industry" are the xlsx names for the layer's Commerce and Industry.

**Freshness.** 91 of the 540 areas changed rate on 2026-10-01. Most of them are Los Angeles County Measure ER, which raised the countywide district tax by 0.5%: LA County went from 2.5% to 3.0%, so the City of LA and the unincorporated area went from 9.75% to 10.25%. A few other cities also changed, for example Perris, Red Bluff, Alhambra and Calabasas. All 91 changes match what the directory's notes said would happen on 2026-10-01. The directory's Q3 combined rates are therefore stale for those 91 areas. This table uses the Q4 rates.

## How a ZIP is rated

- Each Census 2020 block piece of a ZIP (ZCTA) is mapped to a tax area:
  - an incorporated place goes to that CDTFA city, matched by name within the same county first;
  - a CDP or a piece with no place goes to the county's unincorporated area.
- Each distinct area becomes a ZIP row. The row with the most population is `is_primary`.
- Name aliases: the Census name "Angels" is CDTFA's "Angels Camp".
- Components follow Avalara's itemisation:

  | Type | Name | Rate |
  |---|---|---|
  | State | California | 6% |
  | County | `<county>` | 0.25% |
  | Special | `<county>` local tax (Bradley-Burns) | 1% |
  | Special | `<county>` district tax | CountyRate |
  | City | `<city>` | CityRate |

- Avalara names the 0.25% and the 1% after the seller's county (ORANGE). That reflects the seller's place-of-business allocation. This table names the ship-to county instead.

## Validation against Avalara (cross-check, not target)

Answer key: Avalara Sales Invoices, 2026-07-01 to 2026-09-30, CA. 156 (ZIP, city) keys, 218 documents, 153 ZIPs.

| class | keys | docs |
|---|---:|---:|
| match (the Q4 rate equals Avalara) | 99 | |
| oct1_change (the Q3 rate equals Avalara; the invoice predates the 2026-10-01 change) | 45 | |
| **subtotal: consistent with official rates** | **144 / 156 (92.3%)** | **202 / 218 (92.7%)** |
| (c) boundary: the ZIP straddles areas | 11 | 15 |
| missing ZIP (PO box) | 1 | 1 |

### (a) Ours wrong

None found. Every mismatching key has a row in the same ZIP that carries Avalara's rate (old or new). The pick differs only because the rate depends on the address, not on the ZIP.

### (b) Avalara wrong per the official source

None found in this period. Every Avalara rate equals a valid CDTFA rate for some area of the invoice's ZIP.

### (c) Boundary ambiguity

The address's postal city is an incorporated city, so we pick that city's row. Avalara geocoded the street address into the unincorporated area or a neighbouring area. The USPS city name is not the taxing jurisdiction. CDTFA publishes rates by polygon only, with no ZIP+4 file, so a ZIP-level table cannot separate these addresses.

| ZIP | Postal city | Avalara | Ours (Q4) | Avalara's area per CDTFA |
|---|---|---:|---:|---|
| 90247 | Gardena | 9.75% | 11.25% (Gardena) | City of Los Angeles or unincorporated LA County (West Athens); both were 9.75% in Q3 and are 10.25% in Q4 |
| 90606 | Whittier | 9.75% | 11.00% (Whittier) | unincorporated LA County (West Whittier-Los Nietos) |
| 91214 | La Crescenta | 9.75% | 11.00% (Glendale) | unincorporated LA County (La Crescenta-Montrose CDP). The postal name doesn't match the hyphenated CDP name, see the note below. |
| 91722 | Covina | 9.75% | 11.25% (Covina) | unincorporated LA County |
| 92021 | El Cajon | 7.75% | 8.25% (El Cajon) | unincorporated San Diego County |
| 93245 | Lemoore | 7.25% | 8.25% (Lemoore) | unincorporated Kings County (Lemoore Station / NAS Lemoore) |
| 94019 | Half Moon Bay | 9.375% | 9.875% (Half Moon Bay) | unincorporated San Mateo County |
| 94952 | Petaluma | 9.25% | 10.25% (Petaluma) | unincorporated Sonoma County |
| 95062 | Santa Cruz | 9.50% | 9.75% (Santa Cruz) | unincorporated Santa Cruz County (Live Oak) |
| 95476 | Sonoma | 9.25% | 10.25% (Sonoma) | unincorporated Sonoma County |
| 95829 | Sacramento | 7.75% | 8.75% (Sacramento) | unincorporated Sacramento County (Vineyard) |

### Missing ZIP

92822 (Brea) is a PO-box ZIP with no Census ZCTA, so the table has no row for it. Avalara charged 7.75%, which is the Orange County unincorporated rate and also Brea's rate. This needs a shared fallback for non-ZCTA ZIPs, such as a USPS ZIP to city list.

## Known limits

- **Over-collection risk.** Addresses outside city limits that carry a city's postal name are charged the city rate. Address-level accuracy would need a point-in-polygon lookup against the layer's geometry, or CDTFA's address API.
- **Hyphenated CDP names.** Postal "La Crescenta" doesn't match the CDP row "La Crescenta-Montrose", so the lookup falls back to the primary row. A prefix match in `pickRate` would fix it (shared change).
