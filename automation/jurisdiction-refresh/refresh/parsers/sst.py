"""The Streamlined Sales Tax rate files: 24 states, one format.

Each row is: state FIPS, jurisdiction type, jurisdiction FIPS, four rates,
begin date, end date. Names are not in the file - they come from the Census
county and place lists, which is also where the FIPS codes come from.

Only rows in force today are kept; a code whose end date has passed is not a
code you can file under.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from datetime import date

from ..rows import Row, rate

# SST jurisdiction type -> Quantum's type. 63/69/79/49/26/02 are the states'
# own special-district numbering and carry no county/city meaning.
TYPE_MAP = {
    "45": "state",
    "00": "county",
    "0": "county",
    "01": "city",
    "1": "city",
    "02": "town",
    "2": "town",
}
SPECIAL_TYPES = {"63", "69", "79", "49", "26"}

STATE_BY_FIPS: dict[str, str] = {}


def _load_census(census_dir: str) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """FIPS -> name, for counties and places, plus state FIPS -> USPS code."""
    counties: dict[str, str] = {}
    places: dict[str, str] = {}
    states: dict[str, str] = {}
    with open(f"{census_dir}/national_state2020.txt", encoding="latin-1") as fh:
        for r in csv.DictReader(fh, delimiter="|"):
            states[r["STATEFP"]] = r["STATE"]
    with open(f"{census_dir}/national_county2020.txt", encoding="latin-1") as fh:
        for r in csv.DictReader(fh, delimiter="|"):
            counties[r["STATEFP"] + r["COUNTYFP"]] = r["COUNTYNAME"]
    with open(f"{census_dir}/national_place2020.txt", encoding="latin-1") as fh:
        for r in csv.DictReader(fh, delimiter="|"):
            places[r["STATEFP"] + r["PLACEFP"]] = re.sub(
                r"\s+(city|town|village|borough|municipality|CDP)$", "", r["PLACENAME"]
            )
    return counties, places, states


def parse(body: bytes, *, source_url: str, census_dir: str, today: date | None = None) -> dict[str, list[Row]]:
    """One SST file -> rows, keyed by state (a file holds exactly one state)."""
    counties, places, states = _load_census(census_dir)
    today = today or date.today()
    text = _text(body)
    out: dict[str, list[Row]] = {}

    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 9:
            continue
        state_fips, jur_type, jur_fips, intrastate, _inter, _food, _food2, begin, end = parts[:9]
        state = states.get(state_fips.zfill(2))
        if not state:
            continue
        if not _in_force(begin, end, today):
            continue

        kind = TYPE_MAP.get(jur_type)
        if kind == "state":
            name, county = f"{state} (state)", ""
        elif kind == "county":
            key = state_fips.zfill(2) + jur_fips.zfill(3)
            name, county = counties.get(key, f"County FIPS {jur_fips}"), counties.get(key, "")
        elif kind in ("city", "town"):
            key = state_fips.zfill(2) + jur_fips.zfill(5)
            name, county = places.get(key, f"Place FIPS {jur_fips}"), ""
        elif jur_type in SPECIAL_TYPES:
            kind, name, county = "special", f"Special district {jur_fips}", ""
        else:
            continue

        out.setdefault(state, []).append(
            Row(
                state=state,
                jurisdiction_name=name,
                jurisdiction_type=kind,
                official_code=jur_fips,
                code_system="SST FIPS",
                county_name=county,
                local_rate=rate(intrastate),
                effective_from=_iso(begin),
                effective_to="" if end.startswith(("9999", "2999")) else _iso(end),
                source_url=source_url,
                notes="Streamlined Sales Tax rate file; names resolved from the Census 2020 lists.",
            )
        )
    return out


def _text(body: bytes) -> str:
    if body[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
            body = z.read(name)
    return body.decode("utf-8-sig", "replace").replace("\r\n", "\n")


def _iso(yyyymmdd: str) -> str:
    s = yyyymmdd.strip()
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}" if re.fullmatch(r"\d{8}", s) else ""


def _in_force(begin: str, end: str, today: date) -> bool:
    b, e = _iso(begin), _iso(end)
    if e and not e.startswith(("9999", "2999")) and e < today.isoformat():
        return False
    return not (b and b > today.isoformat())
