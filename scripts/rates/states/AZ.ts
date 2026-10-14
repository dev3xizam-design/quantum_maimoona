/**
 * Arizona TPT for remote sellers (business code 605 "Marketplace facilitated or
 * remote retail sales"), destination-sourced. See data/rates/sources/AZ.md.
 *
 * Rates: data/rates/raw/AZ/TPT_RATETABLE_ALL_10012026_code605.csv - the code-605
 * rows of ADOR's TPT_RATETABLE_ALL_10012026.csv (azdor.gov, last-modified
 * 2026-09-11). Region (3-letter) rates include the 5.6% state rate; city
 * (2-letter) rates are the city's own rate. Names and the city -> county region
 * pairing (ADOR Table 2) come from Quantum's jurisdiction directory.
 *
 * Per Census piece: State 5.6% + county excise (county region rate - 5.6%) + the
 * city's 605 rate when the piece is in an ADOR city of that county.
 * Reservation regions, the Maricopa stadium/tourism districts and Rio Nuevo
 * follow boundaries Census places don't carry and are not applied.
 *
 * County excise: ADOR's 605 region rates include it (MAR 6.3% = 5.6% + 0.7%),
 * so it is charged. This store's Avalara history reports every AZ county at 0%;
 * per the official table that is Avalara under-collecting (sources/AZ.md).
 */
import { AS_OF, isoDate, mustExist, rawFile, readCsv, round6, type Juris, type StateBuild } from "../lib/common";
import { zipRowsFromPieces, type Piece } from "../lib/geo";
import { byName, forCounty, nameKey, stateRates, type DirRate } from "./_tx-az-nm-util";

const STATE_RATE = 0.056;
const RATE_FILE = "TPT_RATETABLE_ALL_10012026_code605.csv";

/**
 * Cities in the 605 table that the directory (built from the Sep table) lacks.
 * San Tan Valley incorporated after Census 2020, which still has it as a CDP.
 */
const NEW_CITIES: { code: string; name: string; countyCode: string; county: string }[] = [
  { code: "SZ", name: "SAN TAN VALLEY", countyCode: "PNL", county: "Pinal" },
];

export async function build(): Promise<StateBuild> {
  const rates = new Map<string, { rate: number; from: string }>();
  for (const r of readCsv(mustExist(rawFile("AZ", RATE_FILE)))) {
    const from = isoDate(r.RateStartDate)!;
    const to = isoDate(r.RateEndDate);
    if (from > AS_OF || (to && to < AS_OF)) continue;
    rates.set(r.RegionCode, { rate: round6(Number(r.TaxRatePercent) / 100), from });
  }

  const all = stateRates("AZ");
  const counties = new Map<string, DirRate>();
  for (const r of all.filter((x) => x.type === "county" && x.code)) counties.set(r.county, r);
  const cityRows: DirRate[] = all.filter((x) => x.type === "city" && x.code);
  for (const n of NEW_CITIES)
    cityRows.push({ name: n.name, type: "city", code: n.code, county: nameKey(n.county), local: null, combined: null, includesState: false, pairedCode: n.countyCode, notes: "", effectiveFrom: "" });
  const cities = byName(cityRows);
  const newCityKeys = new Set(NEW_CITIES.map((n) => nameKey(n.name)));

  const noRate = new Set<string>();
  const noCity = new Set<string>();

  function rate(p: Piece) {
    const j: Juris[] = [{ type: "State", name: "Arizona", code: "AZ", rate: STATE_RATE }];
    let from = "2019-10-01";
    const county = counties.get(nameKey(p.countyName));
    const cr = county ? rates.get(county.code!) : undefined;
    if (county && !cr) noRate.add(county.code!);
    if (county && cr) {
      j.push({ type: "County", name: county.name, code: county.code, rate: round6(cr.rate - STATE_RATE) });
      if (cr.from > from) from = cr.from;
    }
    const isCity = p.placeType === "incorporated" || (p.placeType === "cdp" && newCityKeys.has(nameKey(p.placeName)));
    const city = isCity ? forCounty(cities.get(nameKey(p.placeName)), p.countyName) : null;
    const ct = city ? rates.get(city.code!) : undefined;
    if (isCity && !city) noCity.add(`${p.placeName} (${p.countyName})`);
    if (city && !ct) noRate.add(city.code!);
    if (city && ct) {
      j.push({ type: "City", name: city.name, code: city.code, rate: ct.rate });
      if (ct.from > from) from = ct.from;
    }
    return {
      jurisdictions: j.filter((x) => x.type === "State" || x.rate > 0),
      cityName: city ? city.name : p.placeType === "none" ? null : p.placeName,
      effectiveFrom: from,
    };
  }

  const source = `ADOR ${RATE_FILE.replace("_code605.csv", ".csv")} (code 605), Census 2020 ZCTA pieces`;
  const { rows, unrated } = zipRowsFromPieces("AZ", source, rate);
  const notes: string[] = [];
  if (unrated.length) notes.push(`${unrated.length} pieces unrated`);
  if (noRate.size) notes.push(`directory codes with no 605 rate on ${AS_OF}: ${[...noRate].join(", ")}`);
  if (noCity.size) notes.push(`incorporated places with no ADOR city (no city TPT): ${[...noCity].join("; ")}`);
  return { state: "AZ", source, rows, notes };
}
