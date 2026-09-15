# Quantum — automatic jurisdiction refresh

Keeps Quantum's US jurisdiction directory and filing codes current from the
states' own published files, on a schedule, with no one downloading anything by
hand.

```
jurisdiction-refresh/
  config/sources.json      # where each state publishes its codes
  refresh/run.py           # the run: discover -> download -> parse -> post
  refresh/fetch.py         # HTTP, with an OpenClaw Chromium fallback
  refresh/rows.py          # the one row shape everything produces
  refresh/parsers/         # one parser per source
  refresh/push.py          # signed post to Quantum
  install.sh               # sets it up on the server
  SKILL.md                 # how to run it / schedule it
```

## The server

One small US-based Linux box. **US matters**: from outside the US, KS, MO, CO,
LA, TN, FL, OH, VT, ME, ID and ND all refused connections while this was being
built. Ubuntu 24.04, 4 vCPU / 16 GB RAM / 80 GB disk is enough.

```bash
# 1. Node (OpenClaw) and Python
sudo apt update && sudo apt install -y nodejs npm python3-venv chromium-browser
sudo npm install -g openclaw

# 2. Ollama, for chat and run summaries - never for reading tax data
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b

# 3. Point OpenClaw at Ollama (openclaw configure, or ~/.openclaw/openclaw.json)
#    provider: openai-compatible, baseUrl http://127.0.0.1:11434/v1, model llama3.1:8b
openclaw onboard        # then: openclaw gateway start

# 4. This refresh
bash install.sh
```

Why Ollama is not in the data path: a small local model paraphrases a rate chart
instead of reading it, and a paraphrased tax code goes on a return. Codes and
rates are parsed by fixed code. The model is for asking "what changed last
week?" in chat.

## The secret

One shared secret, set in two places, so the server can post to Quantum without
holding the database:

```bash
openssl rand -hex 32
# server:  export JURISDICTION_REFRESH_SECRET=<value>
# Quantum: vercel env add JURISDICTION_REFRESH_SECRET production
```

## What each run does

1. Finds the current file on each state's site (most rename it every quarter).
2. Downloads and parses it; keeps a copy in `state/snapshots/`.
3. Posts each state to Quantum, which replaces that state's directory rows, adds
   filing codes that are new, and closes codes the state has dropped (closed,
   never deleted, so past returns keep the code they were filed under).

Quantum refuses a delivery that looks broken — a state whose file suddenly holds
under 70% of the rows it had keeps its existing data, and the run says so. Every
change is written to the change log, and hand-entered codes are never touched.

## State coverage

| Source | States | Status |
|---|---|---|
| ALDOR rate file | AL | ready — verified: a live download reproduces the 2,453 rows already loaded, exactly |
| Comptroller city rates | TX | parser written, needs one verified run from the server (this Mac cannot resolve comptroller.texas.gov) |
| ADOR TPT table | AZ | parser written, needs a verified run (azdor.gov returns 403 outside the US) |
| WA DOR location codes | WA | parser written, needs a verified run |
| Streamlined Sales Tax | 24 states | ready as a supplementary source; on its own it carries FIPS codes, not the codes those states' returns use |
| Everything else | the rest | source URL recorded in `config/sources.json`, parser still to port from the original build scripts |

Only states listed in `_refreshableStates` are sent to Quantum. The rest are
downloaded and parsed for review and left alone, because replacing a state's
rows from a source that carries the wrong code system would break its return.
