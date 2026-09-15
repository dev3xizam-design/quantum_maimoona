# Arizona (AZ) — TPT region / city codes

## Sources (all Arizona Department of Revenue, azdor.gov)
- Rate table index page: https://azdor.gov/business/transaction-privilege-tax/tax-rate-table
- **Primary data (parsed):** "All Business Classifications Tax Rate Table - September 2026" (CSV, effective 9/1/2026). https://azdor.gov/sites/default/files/document/TPT_RATETABLE_ALL_09012026.csv
- TPT and Other Tax Rate Tables, effective September 1, 2026 (PDF, ADOR 11249). https://azdor.gov/sites/default/files/document/TPT_RATETABLE_09012026.pdf
  - Used for Table 2 (city code to county code pairing), Table 3 (county and special district codes) and Table 4 (Indian reservation codes).
- Remote Seller and Marketplace Facilitator TPT Rate Tables, effective September 1, 2026 (PDF, ADOR 11249RS). https://azdor.gov/sites/default/files/document/TPT_RATETABLE_RSMP_09012026.pdf
  - Used to cross-check every city's 605 rate and for the remote-seller reporting rules.
  - Index page: https://azdor.gov/transaction-privilege-tax/retail-sales-subject-tpt/out-state-sellers/marketplace-facilitatorsremote
- The October 2026 CSV (TPT_RATETABLE_ALL_10012026.csv) was also downloaded, only to flag upcoming changes.

azdor.gov is behind a Cloudflare challenge. The files were fetched through a normal Chrome session attached over CDP and saved byte-for-byte.

## Output
`states/AZ.csv`: **155 rows covering 148 distinct region codes**, which is every region code in the September 2026 table that is current on 2026-09-15.
- county: 15. APA COH COC GLA GRA GRN LAP MAR MOH NAV PMA PNL STC YAV YMA.
- city: 98 rows for the 91 ADOR-administered cities and towns. Seven cities span two counties and get one row per county portion: AJ MAR/PNL, MA PMA/PNL, PE MAR/YAV, QC MAR/PNL, SE COC/YAV, WB MAR/YAV, WM GLA/PNL.
- district: 5.
  - County-level: MCB (Sports & Tourism Authority, Maricopa), MCZ (County Stadium District, Maricopa), PAD (Rio Nuevo District, Pima).
  - City-level: PZ (Special Taxing District, Phoenix, paired with MCZ), QD (Queen Creek Special District).
- special: 37.
  - 35 Indian reservation region codes (Table 4).
  - SWD: Municipal Water statewide, code 041 only, per-unit rate, so rates are left blank.
  - PH: unincorporated Pima County, transient lodging only (codes 000 and 300), so rates are left blank.

Validation:
- No duplicate (state, code, type, paired county) rows. The only repeated codes are the 7 legitimate multi-county city splits.
- All percentage rates are between 0 and 0.111.
- All 93 city and district 605 rates in the CSV match the Remote Seller PDF's Table 2. The automated pairing was off by one after PZ because of PDF layout; the shifted values all match.
- The CSV and PDF city lists agree: 94 two-letter codes (91 cities plus PZ, QD and PH).

## Completeness
**Complete** for the September 2026 table: all region, county, special district, reservation and city codes.
- No state-only row. AZ has no separate state region code; the 5.6% state TPT is built into every county, district and reservation region rate.
- **October 2026 table (effective 10/1/2026, not yet in effect):**
  - Adds new region **SZ "SAN TAN VALLEY"** at 2.25% (605/017). It is not in the CSV because it isn't effective yet.
  - Raises **Tusayan (TY)** from 2% to 4%; this is flagged in the TY row's notes.
  - Re-pull the table monthly: ADOR updates it every month.

## Code system and preparer quirks
- **Returns (TPT-2 / AZTaxes) are keyed by REGION CODE plus BUSINESS CODE.**
  - A remote seller or out-of-state marketplace facilitator uses **business code 605** ("Marketplace facilitated or remote retail sales"), not 017. 017 is only for sellers with Arizona physical presence.
  - Tiered single-item codes 607–629 exist in a few cities; see each row's notes. The CSV truncates their names, so use the PDF for the thresholds.
- **County region rows (3-letter codes) include the 5.6% state rate.** `combined_rate` is the ADOR rate and `local_rate` is that rate minus 5.6%.
- **City codes (2-letter) carry only the city privilege tax.**
  - Every sale into a city is reported twice: once under the county region code and once under the city code.
  - `paired_code` is the county code from ADOR Table 2.
  - `combined_rate` on city rows is the county 605 rate plus the city 605 rate. I added these together; ADOR does not publish a combined city figure.
- **Indian reservation codes** (e.g. MAO, NAM, GLP) replace the county code, and the remote-seller table says no city code is reported. Their rates often equal the county rate but they are separate codes.
- **Special districts:**
  - PAD (Rio Nuevo, inside Tucson) replaces PMA.
  - MCZ and PZ cover a small downtown Phoenix area (between 4th and 7th St, and between Jefferson and Buchanan St). ADOR says to use its Tax Rate Look-Up Tool, https://aztaxes.gov/Home/Address/, to pick codes there.
  - MCB is the Maricopa tourism/sports district code.
  - QD: ADOR says to call Queen Creek to confirm it applies.
- The region code **MP = City of Maricopa** (paired with PNL). Don't confuse it with **MAR = Maricopa County** or **MA = Marana**.
- Sourcing for remote sellers is the customer's shipping address, falling back to the billing address.
- PZ's single-item tier appears as both 628 and 629 in ADOR's own tables, with thresholds printed as $14,338 and $14,388. That inconsistency is ADOR's; check the current PDF if it matters.
- The CSV has two current rows for COH code 049 (jet fuel: one per-unit, one percent). They are irrelevant to retail and not used.
