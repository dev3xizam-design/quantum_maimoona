#!/usr/bin/env bash
# Installs the Quantum jurisdiction refresh on the OpenClaw server.
#   curl -fsSL <this file> | bash      or      bash install.sh
set -euo pipefail

DEST="${QUANTUM_REFRESH_DIR:-$HOME/quantum-refresh}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Installing into $DEST"
mkdir -p "$DEST"
cp -R "$SRC/refresh" "$SRC/config" "$SRC/SKILL.md" "$SRC/README.md" "$SRC/requirements.txt" "$DEST/"
mkdir -p "$DEST/state/census" "$DEST/state/snapshots"

echo "==> Python virtualenv"
python3 -m venv "$DEST/.venv"
"$DEST/.venv/bin/pip" -q install --upgrade pip
"$DEST/.venv/bin/pip" -q install -r "$DEST/requirements.txt"

echo "==> Census name lists (county and place names for the Streamlined files)"
for f in national_state2020.txt national_county2020.txt national_place2020.txt; do
  if [ ! -s "$DEST/state/census/$f" ]; then
    curl -fsSL -o "$DEST/state/census/$f" "https://www2.census.gov/geo/docs/reference/codes2020/$f"
  fi
done

echo "==> Secret"
if [ -z "${JURISDICTION_REFRESH_SECRET:-}" ]; then
  cat <<'MSG'
  Set the shared secret before the first run. The SAME value must be set in
  Quantum (Vercel project env) as JURISDICTION_REFRESH_SECRET:

    openssl rand -hex 32                      # generate it once
    echo 'export JURISDICTION_REFRESH_SECRET=<value>' >> ~/.bashrc
    echo 'export QUANTUM_REFRESH_URL=https://maxvapor-tax.vercel.app/api/jurisdictions/refresh' >> ~/.bashrc

MSG
fi

echo "==> Check"
cd "$DEST" && .venv/bin/python -m refresh.run --only AL --dry-run

cat <<MSG

Installed. Next:
  1. Set JURISDICTION_REFRESH_SECRET here and in Quantum, then run:
       cd $DEST && .venv/bin/python -m refresh.run --all --dry-run
  2. Schedule it:
       openclaw automations create "0 6 * * MON" \\
         --name "Quantum jurisdiction refresh" \\
         --command ".venv/bin/python -m refresh.run --all" \\
         --command-cwd "$DEST" --timeout-seconds 3600 --announce
MSG
