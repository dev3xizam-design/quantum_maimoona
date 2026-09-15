# Louisiana (LA): jurisdiction codes

**Status: COMPLETE for the local domicile codes and rates on the Remote Sellers Commission return, for the Sep-2026 filing period.** The state rate row comes from the Commission's 1/1/2025 listing and could not be re-checked against a 2026 source.

## Access notes
Cloudflare blocks this machine's IP for all of these, so none of them could be fetched live:
- remotesellers.louisiana.gov (the Commission's website)
- revenue.louisiana.gov
- parishe-file.revenue.louisiana.gov
- latap.revenue.louisiana.gov
- the doa.louisiana.gov board pages

On 2026-06-14 the Commission's Documents page (Wayback capture) linked `Domicile Rate Listing 08-25-25.xlsx`. That file was never archived, and the site cannot be reached.

What did work is the **Commission's own filing portal, https://remotesellersfiling.louisiana.gov**, run for the Commission by Avenu Insights. Its public page `lookup/lookup.aspx` ("Authority: Louisiana Remote Sellers Sales Tax Authority; Return: Louisiana Remote Seller's Sales Tax Return") lists every domicile code, rate, V.C. rate, delinquent rate and interest rate for each of the 64 parish tax jurisdictions and each filing period.

All 64 parishes were read for the **Sep-2026** period (current on 2026-09-15). **Aug-2026** and **Oct-2026** were read as well, to find changes.

The portal does apply the selected period. For Jan-2025 it omits the East Baton Rouge codes 1712–1718, which do appear in Sep-2026.

## Sources
| Use | URL |
|---|---|
| Domicile codes and local rates, Sep-2026 (plus Aug and Oct 2026 for change detection) | https://remotesellersfiling.louisiana.gov/lookup/lookup.aspx |
| State rate row, historic names, code format "0000" | http://web.archive.org/web/20250524083448/https://remotesellers.louisiana.gov/Documents/Domicile%20Rate%20Listing%201-01-25.xlsx |
| Name of the current listing file (not retrievable) | http://web.archive.org/web/20260614062933/https://remotesellers.louisiana.gov/Document |
| Optional exemption / reduced-rate codes (context, not loaded) | http://web.archive.org/web/20250524083452/https://remotesellers.louisiana.gov/Documents/Reduced%20Rate%20Codes%20Table%20WEBSITE%202020_11_13.xlsx |
| Town / city / village classification only | census/national_place2020.txt |

Raw data and scripts are in `work/LA/`: `lookup_raw/lookup_{08,09,10}-01-2026.json`, `scrape_lookup.py`, `build_la.py`.

## Row counts (440 total)
| type | rows |
|---|---|
| state | 1 (code `0000`) |
| parish (parish-level domicile `PP00`) | 57 |
| city | 65 |
| town | 111 |
| village | 65 |
| district (EDDs, school, fire, hospital, drainage and ward tax districts) | 117 |
| unincorporated (wards or areas outside a city) | 14 |
| special (named areas that couldn't be classified) | 10 |

- The file has 439 domicile lines covering 431 distinct domicile codes, all 4 digits and kept as text.
- There are 64 parish tax jurisdictions.
- There are 57 rather than 64 "parish" rows because 7 parishes have **no parish-level domicile**: Ascension 0300, Calcasieu 1000, Cameron 1200, Evangeline 2000, Lafourche 2900, St. Martin 5000 and St. Mary 5100. Their unincorporated areas are split into sub-codes, for example Cameron `1201` "Parish Sales", Lafourche `2911`/`2912` North/South Unincorporated, and St. Mary wards. Never assume a `PP00` code exists.
- Every row has a rate, and all rates are between 0 and 0.15.
- No rate changed between Aug-2026 and Sep-2026 or between Sep-2026 and Oct-2026, and no codes were added or dropped. `effective_from`/`effective_to` are therefore blank except on the state row.
- 17 domicile codes are new since the 1/1/2025 listing: 0111, 0916, 1015, 1712–1718, 2820, 2821, 3709, 5104–5106 and 5904. 16 codes from that listing no longer appear, including 5900, 2601 and 3214.

## Missing or uncertain
- **The state rate (5%)** comes from the 1/1/2025 listing, where it is "Louisiana State", code 0000. The portal shows local rates only.
- **combined_rate** is blank on local rows because no source publishes a combined figure. Combined = the domicile's local total + the state rate.
- **Occupancy (hotel) tax authority** (Authority 2000 on the portal) was not captured, because it doesn't apply to vape sales.
- **Optional exemption / reduced-rate codes** (food & drug, manufacturing machinery and similar) are not loaded. They don't apply to vapor products.

## What a preparer must know
- **Filing options for a remote seller** (no physical presence in LA, such as Maximum Vapor):
  - File **one return with the Louisiana Sales and Use Tax Commission for Remote Sellers**, the "Louisiana Remote Seller's Sales Tax Return" on remotesellersfiling.louisiana.gov. It covers state and all local tax at the delivery address's domicile rate.
  - The alternative collects state and local tax by filing separately with LDR and each of the 64 parish collectors. The Commission route avoids that.
  - Parish E-File and LaTAP are for in-state dealers.
- **Codes work at two levels.**
  - *Jurisdiction code* = the parish tax collector: `0100` Acadia … `6400` Winn. Washington Parish's jurisdiction and parish-wide domicile are both **`5906`**, not 5900; the 1/1/2025 listing used 5900.
  - *Domicile code* = the rate area inside it, for example `0101` for Crowley.
  - Both are in the file: the domicile in `official_code`, the collector parish in `paired_code`/`paired_name`.
- **The domicile rate is the total local rate for that area** (parish + school + city + district). It is not just the city's levy. Examples: unincorporated Acadia `0100` = 4.25%; Crowley `0101` = 5.5%.
- **Shared domicile codes.** Where a city straddles parishes, one domicile code appears under two collectors, each carrying part of the rate:
  - `0108` Eunice-in-Acadia: Acadia 3.25% + St. Landry 2.45%
  - `0110` Duson: Acadia + Lafayette
  - `0809` Shreveport in Bossier: Bossier + Caddo
  - `0913` Bossier City in Caddo
  - `5001` Arnaudville
  - `5008` Broussard
  - `5807` DeRidder

  The domicile's total local rate is the **sum of its lines**; the notes give the total. Each line goes on the return under its own collector. These are the only duplicate (state, code, type) keys, and they are legitimate.
- **Same code on two lines in one parish.** Orleans `3601` French Quarter EDD appears twice: 5.0% Orleans sales tax plus a 0.245% special EDD tax.
- **Portal names are not cleaned up.** Examples: "City of Cowley" is spelled "City of Crowley" in the 2025 listing, "Camptie", "Goldanna". Where the 2025 name differs, the notes give it. Always match on the code, never the name.
- **Other portal columns** (V.C. rate 2%, delinquent 5%, interest 1%) are in the notes exactly as the portal displays them. Check vendor's compensation rules for remote sellers before relying on the V.C. rate.
- **Address-to-domicile lookup:** the Commission points users to its "Sales Tax Explorer" (salestaxexplorer.com, run by the same contractor). It was not used as a code source.
