"""Alabama: ALDOR's own taxrates_current.csv.

Ported from the verified build that produced Alabama's rows in Quantum's
directory, so a refresh reproduces the same shape rather than a second opinion:

- one row per locality code PER TAX TYPE (ST sales, SU sellers use, CU consumers
  use) - a remote seller collects the sellers use rate, and some localities levy
  no sellers use tax at all;
- the general-merchandise rate only (GENER). AUTO, MFG, FARM, WDFEE and the rest
  are recorded in the notes, never as the rate;
- a separate row for a municipality's police jurisdiction, which has its own
  rate under the same code;
- ALDOR county numbers are its own alphabetical numbering, not FIPS ("ST CLAIR"
  sorts after "SHELBY"), so county names are mapped through that ordering;
- the state row and the flat 8% Simplified Sellers Use Tax row, neither of which
  has a locality code.
"""
from __future__ import annotations

import collections
import csv
import io
import re

from ..rows import Row, rate

SRC = "https://www.revenue.alabama.gov/wp-content/uploads/2024/03/taxrates_current.csv"
SSUT = "https://www.revenue.alabama.gov/sales-use/simplified-sellers-use-tax-ssut/"
STATE_RATES = "https://www.revenue.alabama.gov/sales-use/state-sales-use-tax-rates/"

TAXNAME = {"ST": "Sales Tax", "SU": "Sellers Use Tax", "CU": "Consumers Use Tax"}
ADMIN = {
    "STATE": "state-administered (ALDOR)",
    "SELF": "self-administered by the locality",
    "AVENU": "non-state administered, agent Avenu Insights & Analytics",
    "STACS": "non-state administered, agent STACS",
    "PREMA": "non-state administered, agent PReMACORP",
    "LGREC": "non-state administered, agent LGREC",
    "RCS": "non-state administered, agent Revenue Collection Services",
    "RDS": "non-state administered, agent RDS",
    "CROCK": "non-state administered, agent Crocker's",
}


def county_numbering(census_dir: str) -> dict[int, str]:
    """ALDOR county number -> county name, by ALDOR's alphabetical ordering."""
    names = []
    with open(f"{census_dir}/national_county2020.txt", encoding="latin-1") as fh:
        for r in csv.DictReader(fh, delimiter="|"):
            if r["STATE"] == "AL":
                names.append(r["COUNTYNAME"])
    ordered = sorted(names, key=lambda s: s.upper().replace(".", ""))
    numbering = {i + 1: n for i, n in enumerate(ordered)}
    # The ordering is what makes the county names right; if Alabama ever gains or
    # renames a county, say so rather than mislabelling every locality.
    if numbering.get(1) != "Autauga County" or numbering.get(67) != "Winston County":
        raise ValueError("ALDOR county numbering no longer matches the Census county list")
    return numbering


def _iso(d: str) -> str:
    return f"{d[:4]}-{d[4:6]}-{d[6:8]}" if re.fullmatch(r"\d{8}", (d or "").strip()) else ""


def parse(body: bytes, source_url: str = SRC, *, census_dir: str) -> list[Row]:
    rows = list(csv.DictReader(io.StringIO(body.decode("utf-8-sig", "replace"))))
    if not rows:
        raise ValueError("ALDOR rate file came back empty")
    cnum = county_numbering(census_dir)

    groups: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    county_codes: dict[str, set[str]] = collections.defaultdict(set)
    for r in rows:
        if r.get("Inactive Date"):
            continue  # a locality whose levy has ended is not a code to file under
        if r.get("County Code"):
            county_codes[r["Locality Code"]].add(r["County Code"])
        if r.get("TaxType") in TAXNAME:
            groups[(r["Locality Code"], r["TaxType"])].append(r)

    out: list[Row] = [
        Row(
            state="AL", jurisdiction_name="ALABAMA (STATE)", jurisdiction_type="state", official_code="",
            code_system="ALDOR state level (no locality code)",
            local_rate="0.04", combined_rate="0.04", source_url=STATE_RATES,
            notes="State general rate 4%. Local rows carry ALDOR 4-digit locality codes and the local rate only.",
        ),
        Row(
            state="AL", jurisdiction_name="ALABAMA SIMPLIFIED SELLERS USE TAX (SSUT) PROGRAM",
            jurisdiction_type="special", official_code="",
            code_system="ALDOR SSUT (statewide flat; no locality code)",
            combined_rate="0.08", source_url=SSUT,
            notes="Approved remote sellers collect a flat 8% on all sales into Alabama with no locality coding; "
                  "relieves the transaction of all other state and local sales/use tax.",
        ),
    ]

    for (code, tt), grp in sorted(groups.items()):
        first = grp[0]
        name = first["Locality Name"]
        is_county = code.startswith("7")
        gen = next((r for r in grp if r["Rate Type"] == "GENER"), None)
        admin = first.get("Administered", "")

        nums: set[int] = set()
        n = int(first["County Number"] or 0)
        if 1 <= n <= 67:
            nums.add(n)
        if not is_county:
            for k in county_codes.get(code, ()):
                if k[2:].isdigit() and 1 <= int(k[2:]) <= 67:
                    nums.add(int(k[2:]))
        cnames = sorted(cnum[x] for x in nums)

        notes = [f"TaxType {tt} ({TAXNAME[tt]}); administered: {admin} = {ADMIN.get(admin, admin)}"]
        if not gen:
            notes.append("no general-merchandise rate on this code - not applicable to vape/general retail sales")
        other = sorted({(r["Rate Type"], r["Rate"]) for r in grp if r["Rate Type"] not in ("GENER", "WDFEE")})
        if other:
            notes.append("other rate types: " + ", ".join(f"{a} {float(b):g}%" for a, b in other))
        if len(cnames) > 1:
            notes.append("spans counties: " + "; ".join(cnames))
        if name.startswith("UNABA"):
            notes.append("UNABATED code: education-earmarked tax for abatement certificate holders, not ordinary retail")

        out.append(Row(
            state="AL",
            jurisdiction_name=name,
            jurisdiction_type="county" if is_county else "municipality",
            official_code=code,
            code_system=f"ALDOR locality code ({tt} {TAXNAME[tt]})",
            county_name=cnames[0] if len(cnames) == 1 else "",
            local_rate=rate(float(gen["Rate"]) / 100) if gen and gen["Rate"] else "",
            effective_from=_iso(gen["Active Date"]) if gen else "",
            source_url=source_url,
            notes="; ".join(notes),
        ))

        if gen and gen.get("PJ") == "Y" and gen.get("PJ_Rate"):
            out.append(Row(
                state="AL",
                jurisdiction_name=f"{name} - POLICE JURISDICTION",
                jurisdiction_type="district",
                official_code=code,
                code_system=f"ALDOR locality code ({tt} {TAXNAME[tt]}) - PJ rate",
                county_name=cnames[0] if len(cnames) == 1 else "",
                local_rate=rate(float(gen["PJ_Rate"]) / 100),
                effective_from=_iso(gen["Active Date"]),
                source_url=source_url,
                notes=f"Police jurisdiction rate for locality code {code} - the area outside the corporate limits.",
            ))
    return out
