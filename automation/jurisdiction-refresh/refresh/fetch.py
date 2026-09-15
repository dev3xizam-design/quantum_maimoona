"""Getting a file from a state revenue department.

Plain HTTP first. A few sites refuse anything that is not a real browser
(Utah, Kansas, Missouri); for those the runner asks OpenClaw's Chromium to
fetch the page instead. Government sources only, one polite request at a time.
"""
from __future__ import annotations

import os
import re
import subprocess
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass

DEFAULT_UA = "Quantum tax automation (Maximum Vapor Inc.) - jurisdiction code refresh"


class FetchError(RuntimeError):
    pass


@dataclass
class Fetched:
    url: str
    body: bytes
    via: str  # "http" | "browser"


def _request(url: str, ua: str, timeout: int) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": ua,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed government URLs
        return resp.read()


def fetch(url: str, *, ua: str = DEFAULT_UA, timeout: int = 120, retries: int = 3, delay: float = 2.0) -> Fetched:
    """One URL, with retries, then a browser fallback if the site blocks us."""
    last: Exception | None = None
    for attempt in range(retries):
        try:
            return Fetched(url=url, body=_request(url, ua, timeout), via="http")
        except Exception as exc:  # noqa: BLE001 - every failure is reported per state
            last = exc
            time.sleep(delay * (attempt + 1))
    try:
        return Fetched(url=url, body=browser_fetch(url, timeout=timeout), via="browser")
    except Exception as exc:  # noqa: BLE001
        raise FetchError(f"{url}: http failed ({last}); browser failed ({exc})") from last


def browser_fetch(url: str, *, timeout: int = 120) -> bytes:
    """Fetch through OpenClaw's Chromium, for sites that refuse plain requests.

    Uses the same browser profile the portal runner drives, so the machine keeps
    one browser identity rather than looking like a scraper farm.
    """
    profile = os.environ.get("OPENCLAW_BROWSER_PROFILE", "openclaw")
    out = subprocess.run(  # noqa: S603
        ["openclaw", "browser", "--browser-profile", profile, "fetch", url],
        capture_output=True,
        timeout=timeout,
    )
    if out.returncode != 0:
        raise FetchError(out.stderr.decode("utf-8", "replace")[:400])
    return out.stdout


def discover(index_url: str, pattern: str, *, ua: str = DEFAULT_UA, timeout: int = 120) -> str:
    """Newest file on an index page matching `pattern`.

    Most states republish quarterly under a new name (pub17000726.xlsx,
    Q426_Excel_LSU-rates-alpha.xlsx), so the link has to be found, not guessed.
    "Newest" is the last match in sorted order, which is what dated filenames
    give us; a file dated in the future is skipped.
    """
    page = fetch(index_url, ua=ua, timeout=timeout).body.decode("utf-8", "replace")
    rx = re.compile(pattern)
    hits: list[str] = []

    def absolute(href: str) -> str:
        # A bare filename on a directory listing belongs INSIDE that directory:
        # ".../Rates" + "OKR2026Q4.zip" is ".../Rates/OKR2026Q4.zip", which
        # urljoin alone would turn into ".../OKR2026Q4.zip".
        if "/" not in href and not index_url.endswith("/"):
            return urllib.parse.urljoin(index_url + "/", href)
        return urllib.parse.urljoin(index_url, href)

    for m in re.finditer(r'(?:href|src)="([^"]+)"', page):
        href = m.group(1)
        if rx.search(href):
            hits.append(absolute(href))
    # Some listings write bare filenames rather than links.
    for m in rx.finditer(page):
        hits.append(absolute(m.group(0)))
    if not hits:
        raise FetchError(f"no file matching {pattern!r} on {index_url}")
    return sorted(set(hits))[-1]
