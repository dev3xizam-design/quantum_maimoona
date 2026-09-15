# quantum-jurisdiction-refresh

Downloads each state revenue department's own jurisdiction-code file, parses it
with fixed parsers, and posts the result to Quantum.

## What it does
1. Finds the current file on the state's site (most states rename it every
   quarter, so the link is discovered, not hardcoded).
2. Downloads it — plain HTTP, falling back to OpenClaw's Chromium for the few
   sites that refuse anything else.
3. Parses it into Quantum's row shape and writes a local copy under
   `state/snapshots/`.
4. Posts each state to Quantum, signed with a shared secret. Quantum applies it,
   or keeps the data it already had and says why.

## What it deliberately does NOT do
- **No model reads tax data.** Codes and rates come from the states' files
  through fixed parsers. A model that paraphrases a rate chart is worse than no
  refresh at all; Ollama is here for the run summary and chat, nothing else.
- **It does not hold the database.** Quantum has the connection string; this
  machine only posts rows to one endpoint.
- **It does not touch hand-entered codes**, and never switches on a rate.
- **It does not log in anywhere.** Public published files only. Portal logins
  are the separate portal-runner skill, where a person is present.

## Run it
```
cd ~/quantum-refresh
.venv/bin/python -m refresh.run --all --dry-run     # download and parse, send nothing
.venv/bin/python -m refresh.run --all               # the real run
.venv/bin/python -m refresh.run --only AL,TX        # a few states
```

## On a schedule
```
openclaw automations create "0 6 * * MON" \
  --name "Quantum jurisdiction refresh" \
  --command ".venv/bin/python -m refresh.run --all" \
  --command-cwd "$HOME/quantum-refresh" \
  --timeout-seconds 3600 \
  --announce
```
Weekly is right: states publish quarterly, but mid-quarter corrections happen,
and a weekly run keeps each change small enough to read.

## Reading a run
`state/last-run.json` holds the last result per state. In Quantum, Config → US
directory shows the same thing with what changed. Three statuses matter:
- **applied** — loaded; the message says how many codes were added or closed.
- **rejected** — Quantum refused it (usually a state's file lost most of its
  rows, which means the file changed, not the jurisdictions). The old data
  stands. Look at the state's site before forcing anything.
- **failed** — the download or the parser broke. The state keeps its data.

## Adding a state
Add its source to `config/sources.json`, write a parser in `refresh/parsers/`
returning `Row` objects, set the source's `status` to `ready`, and add the state
to `_refreshableStates` once its parser reproduces the code system that state's
return actually uses. Until then the state is parsed for review but never sent —
an SST-only refresh of Oklahoma would replace its COPO codes with FIPS codes and
break the return.
