"""The refresh run.

  python -m refresh.run --all              every ready source
  python -m refresh.run --only TX,WA       a few states
  python -m refresh.run --all --dry-run    download and parse, send nothing

For each source: find the current file on the state's own site, download it,
parse it into Quantum's row shape, keep a local copy, and post it to Quantum.
Quantum decides whether to accept it - a state whose file suddenly loses most
of its rows keeps the data it already had.

No model is involved anywhere in this path. The codes that go on tax returns
are read from the states' files by fixed parsers, because a model that
paraphrases a rate chart is worse than no refresh at all.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import sys
import traceback

from .fetch import FetchError, discover, fetch
from .parsers import alabama as al_parser
from .parsers import sst as sst_parser
from .parsers.table import ADAPTERS
from .rows import Row, to_csv

HERE = pathlib.Path(__file__).resolve().parent.parent
CONFIG = HERE / "config" / "sources.json"
SNAPSHOTS = HERE / "state" / "snapshots"
CENSUS = HERE / "state" / "census"


def load_config() -> dict:
    return json.loads(CONFIG.read_text())


def refreshable(cfg: dict) -> set[str]:
    """States this runner may replace in Quantum - see _refreshableStates."""
    return set(cfg.get("_refreshableStates", {}).get("states", []))


def ready_sources(cfg: dict, only: set[str] | None) -> list[dict]:
    out = []
    for s in cfg["sources"]:
        if s.get("status") != "ready":
            continue
        states = set(s.get("states") or ([s["state"]] if s.get("state") else []))
        if only and not (states & only):
            continue
        out.append(s)
    return out


def resolve_url(source: dict, settings: dict) -> str:
    if source.get("fileUrl"):
        return source["fileUrl"]
    return discover(
        source["indexUrl"],
        source["linkPattern"],
        ua=settings["userAgent"],
        timeout=settings["timeoutSeconds"],
    )


def parse_source(source: dict, body: bytes, url: str) -> dict[str, list[Row]]:
    if source["kind"] == "sst":
        return sst_parser.parse(body, source_url=url, census_dir=str(CENSUS))
    if source["id"] == "al-aldor":
        return {"AL": al_parser.parse(body, url, census_dir=str(CENSUS))}
    adapter = ADAPTERS.get(source["id"])
    if not adapter:
        raise RuntimeError(f"no parser for source {source['id']}")
    return {source["state"]: adapter(body, url)}


def run(only: set[str] | None, *, dry_run: bool, verbose: bool = True) -> int:
    cfg = load_config()
    settings = cfg["_settings"]
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    fetched_at = dt.datetime.now(dt.timezone.utc).isoformat()
    failures = 0
    results: list[dict] = []
    # A state's delivery is every source it has, merged: Quantum replaces that
    # state's rows wholesale, so sending one source alone would drop the others.
    collected: dict[str, list[Row]] = {}
    collected_urls: dict[str, list[str]] = {}
    collected_sources: dict[str, list[str]] = {}

    for source in ready_sources(cfg, only):
        try:
            if source["kind"] == "sst":
                # One directory listing, one file per state.
                by_state: dict[str, list[Row]] = {}
                urls: dict[str, str] = {}
                for state in source["states"]:
                    if only and state not in only:
                        continue
                    url = discover(
                        source["indexUrl"],
                        source["linkPattern"].replace("(?P<state>[A-Z]{2})", state),
                        ua=settings["userAgent"],
                        timeout=settings["timeoutSeconds"],
                    )
                    body = fetch(url, ua=settings["userAgent"], timeout=settings["timeoutSeconds"],
                                 retries=settings["retries"], delay=settings["politeDelaySeconds"]).body
                    for st, rows in sst_parser.parse(body, source_url=url, census_dir=str(CENSUS)).items():
                        by_state.setdefault(st, []).extend(rows)
                        urls[st] = url
                parsed, source_urls = by_state, urls
            else:
                url = resolve_url(source, settings)
                body = fetch(url, ua=settings["userAgent"], timeout=settings["timeoutSeconds"],
                             retries=settings["retries"], delay=settings["politeDelaySeconds"]).body
                parsed = parse_source(source, body, url)
                source_urls = {st: url for st in parsed}

            for state, rows in sorted(parsed.items()):
                if only and state not in only:
                    continue
                csv_text = to_csv(rows)
                (SNAPSHOTS / f"{state}-{source['id']}.csv").write_text(csv_text)
                collected.setdefault(state, []).extend(rows)
                collected_urls.setdefault(state, []).append(source_urls.get(state, ""))
                collected_sources.setdefault(state, []).append(source["id"])
                if verbose:
                    print(f"{state:>3} {source['id']:<16} {len(rows):>6} rows parsed")
        except (FetchError, Exception) as exc:  # noqa: BLE001 - one state failing must not stop the rest
            failures += 1
            results.append({"state": ",".join(source.get("states") or [source.get("state", "?")]),
                            "source": source["id"], "status": "failed", "message": str(exc)[:300]})
            if verbose:
                print(f"    {source['id']:<16} FAILED {exc}", file=sys.stderr)
                if os.environ.get("REFRESH_DEBUG"):
                    traceback.print_exc()

    allowed = refreshable(cfg)
    for state, rows in sorted(collected.items()):
        entry = {"state": state, "sources": collected_sources[state], "rows": len(rows), "urls": collected_urls[state]}
        if state not in allowed:
            entry["status"] = "parsed, not sent"
            entry["message"] = "this state's return uses a code system no ready adapter reproduces yet"
        elif dry_run:
            entry["status"] = "parsed (dry run)"
        else:
            from .push import push_state

            code, body_json = push_state(
                state, to_csv(rows),
                source="+".join(collected_sources[state]),
                source_urls=collected_urls[state],
                fetched_at=fetched_at,
            )
            entry["status"] = body_json.get("status", f"HTTP {code}")
            entry["message"] = body_json.get("message") or body_json.get("error", "")
            if code >= 400 and code != 409:
                failures += 1
        results.append(entry)
        if verbose:
            print(f"{state:>3} {entry['rows']:>6} rows  {entry['status']}  {entry.get('message','')}")

    (HERE / "state" / "last-run.json").write_text(
        json.dumps({"finishedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "results": results}, indent=1)
    )
    if verbose:
        applied = sum(1 for r in results if r.get("status") == "applied")
        print(f"\n{applied} state(s) updated, {failures} failure(s). Details in state/last-run.json")
    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Refresh US jurisdiction codes from the states' own files.")
    ap.add_argument("--all", action="store_true", help="every source marked ready")
    ap.add_argument("--only", default="", help="comma-separated states, e.g. TX,WA")
    ap.add_argument("--dry-run", action="store_true", help="download and parse, send nothing")
    args = ap.parse_args()
    if not args.all and not args.only:
        ap.error("pass --all or --only STATES")
    only = {s.strip().upper() for s in args.only.split(",") if s.strip()} or None
    return run(only, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
