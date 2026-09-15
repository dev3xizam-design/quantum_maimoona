"""The one row shape everything produces: Quantum's directory CSV.

Every parser returns these rows and nothing else, so adding a state is writing
a parser, not touching the pipeline. Quantum validates the same columns again
on arrival and refuses the delivery whole if a row is wrong.
"""
from __future__ import annotations

import csv
import io
from dataclasses import asdict, dataclass, field

COLUMNS = [
    "category", "state", "jurisdiction_name", "jurisdiction_type", "official_code",
    "code_system", "county_name", "paired_code", "paired_name", "local_rate",
    "combined_rate", "rate_includes_state", "effective_from", "effective_to",
    "source_url", "notes",
]

TYPES = {
    "state", "county", "parish", "borough", "city", "town", "village", "township",
    "municipality", "region", "district", "transit", "special", "school", "unincorporated",
}

# TRUE only where the state's RETURN reports a jurisdiction at a rate that already
# includes the state's own (see Quantum's directory notes). Everywhere else the
# combined_rate column carries that number instead.
RATE_INCLUDES_STATE_STATES = {"WY", "AZ", "NV"}


@dataclass
class Row:
    state: str
    jurisdiction_name: str
    jurisdiction_type: str
    official_code: str
    code_system: str
    county_name: str = ""
    paired_code: str = ""
    paired_name: str = ""
    local_rate: str = ""
    combined_rate: str = ""
    rate_includes_state: str = "false"
    effective_from: str = ""
    effective_to: str = ""
    source_url: str = ""
    notes: str = ""
    category: str = field(default="tax")

    def validated(self) -> "Row":
        if self.jurisdiction_type not in TYPES:
            raise ValueError(f"{self.state} {self.jurisdiction_name}: type {self.jurisdiction_type!r}")
        if not self.jurisdiction_name.strip():
            raise ValueError(f"{self.state} {self.official_code}: no name")
        for attr in ("local_rate", "combined_rate"):
            v = getattr(self, attr)
            if v not in ("", None) and not (0 <= float(v) < 0.2):
                raise ValueError(f"{self.state} {self.jurisdiction_name}: {attr} {v} is not a decimal rate")
        if self.state not in RATE_INCLUDES_STATE_STATES:
            self.rate_includes_state = "false"
        return self


def to_csv(rows: list[Row]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLUMNS, lineterminator="\n")
    w.writeheader()
    for r in rows:
        d = asdict(r.validated())
        w.writerow({c: ("" if d.get(c) is None else str(d.get(c, ""))) for c in COLUMNS})
    return buf.getvalue()


def rate(value: object) -> str:
    """A rate as a decimal string. Accepts 0.0125, "1.25%", "1.25" (percent) and blanks."""
    if value in (None, "", "-"):
        return ""
    s = str(value).strip().replace("%", "")
    if not s or s in {"n/a", "N/A"}:
        return ""
    n = float(s)
    if n >= 0.2:  # a whole-number percent, not a decimal
        n = n / 100
    if not 0 <= n < 0.2:
        raise ValueError(f"rate out of range: {value!r}")
    return f"{round(n, 8):g}"
