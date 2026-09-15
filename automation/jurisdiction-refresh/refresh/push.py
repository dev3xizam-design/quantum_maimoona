"""Sending one state's rows to Quantum.

Quantum holds the database; this machine never does. The body is signed with a
shared secret so the endpoint knows the delivery came from this server.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.request

DEFAULT_URL = "https://maxvapor-tax.vercel.app/api/jurisdictions/refresh"


def _sign(secret: str, body: str) -> str:
    return "sha256=" + hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def _post(url: str, secret: str, payload: dict) -> tuple[int, dict]:
    body = json.dumps(payload)
    req = urllib.request.Request(
        url,
        data=body.encode(),
        headers={"Content-Type": "application/json", "X-Quantum-Signature": _sign(secret, body)},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:  # noqa: S310 - our own endpoint
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:  # rejected deliveries answer 409 with a reason
        return e.code, json.loads(e.read() or b"{}")


def push_state(state: str, csv_text: str, *, source: str, source_urls: list[str], fetched_at: str) -> tuple[int, dict]:
    url = os.environ.get("QUANTUM_REFRESH_URL", DEFAULT_URL)
    secret = os.environ["JURISDICTION_REFRESH_SECRET"]
    return _post(url, secret, {
        "state": state,
        "csv": csv_text,
        "source": source,
        "sourceUrls": source_urls,
        "fetchedAt": fetched_at,
    })


def current_state_counts() -> dict:
    """What Quantum holds now - used to report what a run changed."""
    url = os.environ.get("QUANTUM_REFRESH_URL", DEFAULT_URL)
    secret = os.environ["JURISDICTION_REFRESH_SECRET"]
    req = urllib.request.Request(url, headers={"X-Quantum-Signature": _sign(secret, "")})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
        return json.loads(resp.read() or b"{}").get("states", {})
