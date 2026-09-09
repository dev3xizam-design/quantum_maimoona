# Multi-State Tax Automation — Maximum Vapor Inc.

Upload the period's Avalara export, and the system produces **filled, ready-to-file
worksheets** — one per state per tax type — for sales/use tax, vapor excise and PACT Act
reports, with a filing calendar that shows what's due and what's overdue.

Every number is a formula or a lookup. Nothing is guessed, and every figure traces back
to transactions × a rate in a table you can edit yourself.

---

## What it does

| | |
|---|---|
| **Ingest** | Avalara `SalesTaxDocumentLineDetail` CSV or ZIP, parsed in the browser and streamed in. The export is pre-exploded by jurisdiction; the engine dedupes sale lines and sums tax across every jurisdiction row. |
| **Sales tax** | Gross / exempt / taxable / tax per state, jurisdiction allocation with official filing codes, and a **collected-vs-computed delta** that catches Avalara under-collection before you file. |
| **Excise** | Five structures (% wholesale, % retail, per mL, per unit, bifurcated open/closed) plus **SALES vs RECEIPTS basis** — Kansas EC-2 taxes mL *purchased*, not sold. |
| **PACT Act** | Per-shipment ENDS line list, due the 10th, from the shipment feed (or the sales export, flagged as incomplete). |
| **Worksheets** | One `.xlsx` per return with five tabs: Filing Sheet (type-these-into-the-portal steps), Return (form mirror), Jurisdiction Detail, Reconciliation, Notes. |
| **Calendar** | Frequency **per state per tax type**, effective-dated. Overdue backlogs surfaced in red. |
| **Config** | Every rate, code, frequency, portal and due day is editable with an effective date. Change one row; future returns use it, past returns don't move. |
| **Audit** | Every rule change (who / when / old → new / effective from) and every generation run. |

### The rules that make it reconcile

- **Dedupe sale lines**, never tax lines. Gross/exempt/taxable come from the State-level row only, keyed on `(documentId, lineNo, itemCode, ref1)`. Tax sums across *all* jurisdiction rows.
- **`Taxable + Exempt = Gross`** is enforced to the cent. A worksheet is never emitted when it fails.
- **Returns net the period** regardless of whether the export signs them negative.
- **Effective dating** on every rule row, so WA→95% (Jan 2026) and SC→$0.05/mL (Oct 2026) just work.

---

## Setup

### 1. A Postgres database

Any provider works — [Neon](https://neon.tech) (free tier, recommended for Vercel),
Supabase, or Vercel Postgres. Copy the **pooled** connection string.

```bash
cp .env.example .env.local
# fill in DATABASE_URL and a long random AUTH_SECRET
openssl rand -base64 48   # <- use this for AUTH_SECRET
```

### 2. Schema and seed

```bash
npm install
npm run db:push        # create the tables
npm run db:seed        # load every state's rates, frequencies, portals and codes
```

Optionally create the first user from the CLI instead of the sign-up screen:

```bash
npm run db:seed -- --email you@example.com --password 'a long passphrase' --name 'Your Name'
```

### 3. Run it

```bash
npm run dev            # http://localhost:3000
```

The first visit to `/login` offers to create the initial admin when no user exists.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo. Framework auto-detects as Next.js.
3. Add the environment variables (Project → Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your **pooled** Postgres connection string |
   | `AUTH_SECRET` | a long random string |
   | `COMPANY_NAME` | `Maximum Vapor Inc.` |
   | `COMPANY_FEIN` | `82-1098441` |

4. Deploy. Then run `npm run db:push && npm run db:seed` **locally against the production
   `DATABASE_URL`** once, to create and populate the tables.

Large Avalara exports are parsed in the browser and streamed to the API in 400-row batches,
so they never hit Vercel's request-body limit.

---

## Everyday use

1. **Upload** the month's Avalara export. The validation report shows rows, unique lines,
   per-state gross/exempt/taxable/tax, and a `Taxable + Exempt = Gross` check per state.
   Re-uploading a period is safe — duplicates are ignored.
2. For excise: upload the **product master** (mL per SKU, wholesale cost, OPEN/CLOSED) and,
   for receipts-basis states, the month's **purchase import**.
3. For PACT: upload the **shipment feed** from the order system (the sales export has no
   customer names or street addresses).
4. On the **Calendar**, press **Run this period**. Everything with activity is computed.
5. Open each return, check the warnings, **Download worksheet**, file it on the portal, then
   **Mark filed** with the confirmation number.

### When a state changes a rate

Config → find the row → Edit → set the new rate and the **effective date** → Save.
That closes the old row and opens a new one. Future returns use the new rate; anything
already filed keeps the rate that applied then. No code change, no redeploy.

---

## Commands

```bash
npm run dev              # dev server
npm run build            # production build
npm test                 # engine unit tests (no database needed)
npm run test:integration # full stack against in-process Postgres (PGlite)
npm run test:all         # both
npm run db:push          # sync schema to the database
npm run db:generate      # generate a SQL migration from schema changes
npm run db:seed          # (re)load the rule tables
npm run db:studio        # browse the database
```

---

## Layout

```
src/
  db/schema.ts              tables: transactions, effective-dated config, filings, audit
  lib/
    ingest/avalara.ts       column mapping, normalization, dedupe key, ingest stats
    ingest/persist.ts       idempotent inserts
    engine/sales.ts         gross/exempt/taxable/tax, allocation, collected-vs-computed
    engine/excise.ts        five structures, SALES vs RECEIPTS basis
    engine/pact.ts          per-shipment ENDS line list
    excel/workbook.ts       five-tab workbook builder
    excel/forms/sales.ts    per-state form mirrors + filing steps (FL, IL, NJ, KY, LA,
                            PA, OK, AZ, NV, TN, WY + a generic fallback)
    config.ts               effective-dated rule resolution
    compute.ts              orchestration + persistence
    calendar.ts             what's due, what's overdue
    seed-data.ts            the starting rule set (editable in the UI afterwards)
  app/                      dashboard, upload, returns, config, audit
scripts/                    seed, tests, workbook smoke test
```

---

## Security

- **Never** store state-portal passwords, PINs, card numbers, CVVs or bank credentials —
  not in the database, not in the notes fields, not in env vars. They belong in a password
  manager. The app only stores non-secret identifiers (FEIN, account and license numbers).
- PACT shipment rows contain customer PII. They are written to the worksheet only, never
  rendered in the dashboard and never logged.
- Sessions are signed JWTs in httpOnly cookies, 12-hour expiry.

## Scope

This system **prepares** returns. A human files them on the state portal using the Filing
Sheet. Auto-submission is deliberately out of scope: most states have no filing API, portal
automation is fragile, and some portals' terms prohibit it — and 95% of the time saved is in
the calculation and worksheet generation anyway.

The figures are only as correct as the rules loaded into it. This is an accounting tool, not
tax advice — a CPA should sign off on the rule set and spot-check filings each quarter.
