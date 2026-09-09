#!/usr/bin/env bash
# One-shot setup once you have a Postgres connection string.
#
#   ./scripts/setup.sh 'postgresql://...' you@example.com 'a long passphrase' 'Your Name'
#
set -euo pipefail

DB_URL="${1:?Usage: ./scripts/setup.sh <DATABASE_URL> [email] [password] [name]}"
EMAIL="${2:-}"
PASSWORD="${3:-}"
NAME="${4:-Admin}"

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

# Write DATABASE_URL, and generate AUTH_SECRET if it is still the placeholder.
python3 - "$DB_URL" <<'PY'
import base64, re, secrets, sys
url = sys.argv[1]
s = open(".env.local").read()
s = re.sub(r'^DATABASE_URL=.*$', f'DATABASE_URL="{url}"', s, flags=re.M)
if "change-me-to-a-long-random-string" in s:
    s = s.replace("change-me-to-a-long-random-string", base64.b64encode(secrets.token_bytes(48)).decode())
open(".env.local", "w").write(s)
print("  .env.local updated")
PY

echo "Creating tables..."
DATABASE_URL="$DB_URL" npx drizzle-kit push --force

echo "Loading state rules..."
if [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  DATABASE_URL="$DB_URL" npx tsx scripts/seed.ts --email "$EMAIL" --password "$PASSWORD" --name "$NAME"
else
  DATABASE_URL="$DB_URL" npx tsx scripts/seed.ts
fi

echo
echo "Done. Run 'npm run dev' and open http://localhost:3000"
