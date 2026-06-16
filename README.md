# Community Intelligence Platform — Lakepointe Church

Internal demographic research dashboard for identifying DFW campus expansion opportunities. Displays ZIP-level Census, employer, health, and religious-landscape data alongside Lakepointe attendee density for site-selection decisions.

**Production:** https://community-demographic-tool.vercel.app  
**Access:** Basic auth required (credentials in 1Password / Vercel env vars)  
**Internal use only** — `noindex` is set; do not share the URL publicly.

---

## Local development

```bash
# 1. Clone and install
git clone https://github.com/Lakepointe-Church/community-demographic-tool.git
cd community-demographic-tool
npm install

# 2. Pull env vars from Vercel (requires Vercel CLI and project access)
vercel env pull

# 3. Start dev server
npm run dev        # http://localhost:3000
```

`vercel env pull` writes `.env.local` with `DATABASE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `CRON_SECRET`, `BASIC_AUTH_USER`, and `BASIC_AUTH_PASS`. Never commit `.env.local`.

---

## Environment & database mapping

All three Vercel environments (Production, Preview, Development) connect to the **same Neon PostgreSQL database** — there is no separate preview or staging database on the current Hobby plan.

| Environment | URL | Database |
|---|---|---|
| Production | community-demographic-tool.vercel.app | Neon `main` branch |
| Preview | *.vercel.app (per-PR) | Neon `main` branch (same data) |
| Local dev | localhost:3000 | Neon `main` branch (via .env.local) |

**Consequence:** an attendee CSV uploaded from a preview deployment writes to the same production database. Always upload through the production admin page or local dev, never from an unverified preview URL.

---

## Auth

The site uses two auth layers:

| Layer | Who it covers | Credential |
|---|---|---|
| Basic auth (browser) | All humans visiting any page | `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` |
| Bearer token (automation) | Cron jobs, curl scripts, POST/DELETE endpoints | `CRON_SECRET` |

Both are set in Vercel → Project Settings → Environment Variables. Run `vercel env pull` to sync locally.

---

## Data refresh runbook

### Quick reference

| Source | Script / endpoint | Cadence | Owner |
|---|---|---|---|
| Census ACS + CBP (all ZIPs) | `POST /api/refresh` | Annually (ACS releases Dec) | Jolie |
| BLS / FRED metro stats | `POST /api/refresh` (same call) | Monthly if current stats matter | Jolie |
| CFPB complaints | Auto-cron (1st of month) | Monthly — automatic | Vercel |
| CDC PLACES health | `npx tsx scripts/import-places.ts` | Annually | Jolie |
| IRS BMF religious orgs | `npx tsx scripts/import-bmf.ts` | Monthly | Jolie |
| Census BPS permits | `npx tsx scripts/import-permits.ts` | Annually (after May release) | Jolie |
| TEA PEIMS enrollment | `npx tsx scripts/import-tea.ts` | Annually (after ~March release) | Jolie |
| TDC population projections | `npx tsx scripts/import-tdc.ts` | Every ~2 years (new vintage) | Jolie |
| LEHD LODES commute corridors | `npx tsx scripts/import-lodes.ts` | Annually (after ~Dec release) | Jolie |
| Attendee density | Admin upload page | After each Rock RMS export | Jolie |

### Census ACS + CBP (~8 min for all 370 ZIPs)

Run manually — this exceeds the Vercel Hobby plan's function timeout and cannot be a cron job.

```bash
# From local shell with .env.local present
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://community-demographic-tool.vercel.app/api/refresh
```

Or from the dev server at `http://localhost:3000/api/refresh` (same command, change the URL).

### CFPB complaints (automatic)

Runs on the 1st of each month at 07:00 UTC via `vercel.json` cron. To trigger manually:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://community-demographic-tool.vercel.app/api/refresh-community
```

### CDC PLACES health data (annual)

Download is built into the script — no manual file step needed.

```bash
npx tsx scripts/import-places.ts
```

### IRS BMF religious orgs (monthly)

IRS publishes updated exempt organization files monthly. The script re-downloads from the IRS server.

```bash
npx tsx scripts/import-bmf.ts
```

### Census Building Permits Survey (annual, after May release)

```bash
npx tsx scripts/import-permits.ts
```

### TEA PEIMS enrollment (annual, after ~March release)

1. Download the **TAPR Summary** enrollment CSV from [tea.texas.gov](https://tea.texas.gov/reports-and-data/school-performance/accountability-research/performance-reporting) for the most recent school year.
2. Save as `data/tea-enrollment-YYYY.csv` (e.g. `data/tea-enrollment-2025.csv`).
3. Run the import:

```bash
npx tsx scripts/import-tea.ts
```

### Texas Demographic Center projections (every ~2 years)

1. Download the latest vintage from [demographics.texas.gov/Projections/](https://demographics.texas.gov/Projections/).
2. Save as `data/tdc-projections-YYYY.csv`.
3. Run the import:

```bash
npx tsx scripts/import-tdc.ts
```

### LEHD LODES commute corridors (annual, after ~Dec release)

Fully automated — the script fetches the Texas OD file and geography crosswalk directly from the Census LODES8 endpoint, streams ~12M block-pair rows, aggregates intra-DFW flows to home-ZIP → work-ZIP, and writes `commute_flows` + `commute_summary` plus `data/dfw-zip-centroids.json`.

```bash
npx tsx scripts/import-lodes.ts          # add DRY_RUN=1 to preview without DB writes
```

Notes:
- Source files are cached to `data/lodes-*.csv.gz` (gitignored, ~80 MB) so re-runs skip the download. Delete them to force a fresh fetch.
- When a newer LODES vintage lands, bump `YEAR` at the top of the script.
- `data/dfw-zip-centroids.json` **is** committed (small runtime asset read by `/api/commute`); the `.gz` caches are **not**.

---

## Attendee upload runbook

### Overview

Lakepointe attendee data comes from Rock RMS and is uploaded manually through the admin page after each export. The data never lives in the Git repository — only in the database.

**Who runs it:** Jolie (or whoever pulls the Rock RMS report)  
**Cadence:** After each Rock RMS export — typically monthly or before a site-selection meeting  
**Upload page:** https://community-demographic-tool.vercel.app/admin/attendee-upload

### Step 1 — Pull the report from Rock RMS

In Rock RMS, run the **"Family Count by Campus and Postal Code"** report. Export as CSV.

The expected column names (Rock RMS default):

| Column | Description |
|---|---|
| `Campus` | Campus name (e.g. "Lakepointe - Rockwall") |
| `PostalCodeLeft5` | 5-digit ZIP code |
| `FamilyCount` | Number of households in that ZIP attending that campus |

The parser also accepts generic column names: `zip`, `campus`, `households`. Campus names containing commas are handled correctly.

### Step 2 — Upload via the admin page

1. Go to https://community-demographic-tool.vercel.app/admin/attendee-upload  
2. Enter the **source date** (the date the Rock RMS export was pulled, not today's date).  
3. Select the CSV file.  
4. Click **Upload**.

The upload page will show a skip report:
- **Online / streaming** rows are excluded automatically.
- **Out-of-coverage** ZIPs (outside the 370-ZIP DFW metro area) are excluded automatically.
- **Invalid ZIP** or **invalid count** rows are reported.

A successful upload shows the number of ZIPs upserted, total households, and the source date.

### Step 3 — Verify on the map

1. Go to the Overview page.
2. Toggle **Attendees** in the map controls.
3. Confirm circles appear, colored by primary campus.
4. The attendee toggle button shows the last upload date — confirm it matches.

### Privacy rules (enforced server-side)

- ZIPs with **fewer than 5 attendee households** are suppressed and never displayed (`households = -1` in the API response). This applies to both the map and the Campus Draw Areas panel.
- The raw CSV is **never stored** — only aggregated ZIP-level counts are written to the database.

### DB-only policy — never commit the CSV

Attendee CSV files must **never be committed to Git**. Reasons:
- Git history is permanent and repo access is broader than database access.
- The privacy suppression boundary (< 5 HH) is enforced by the server, not by the CSV content.
- Aggregated-by-ZIP with server-side suppression is the intended privacy boundary.

If you accidentally stage a CSV file, remove it before committing:
```bash
git reset HEAD data/FamilyCount*.csv
echo "data/FamilyCount*.csv" >> .gitignore
```

### Resetting bad data

If a bad upload needs to be reversed, use the **Truncate** button on the admin upload page, then re-upload the correct file. This wipes all rows in `attendee_density` — there is no partial rollback.

---

## Adding or removing ZIP codes

ZIP codes are defined in `src/lib/zips.ts`. To add a ZIP:
1. Append it to the appropriate group in `ZIP_GROUPS`.
2. Run `POST /api/refresh` to fetch its Census data.

To remove a ZIP with no ACS data: delete it from `zips.ts`. It will simply not appear in the database after the next refresh.

---

## Database migrations

If a new column is needed, add it to the schema in `src/app/api/db/migrate/route.ts` and run an `ALTER TABLE` directly:

```bash
DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'"' -f2) node -e "
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  sql\`ALTER TABLE zip_demographics ADD COLUMN IF NOT EXISTS new_col NUMERIC(5,1)\`
    .then(() => console.log('done'));
"
```

---

## Deploying

Push to `main` to trigger a Vercel production deployment automatically.

```bash
git push origin main
```

Or use the `/ship` slash command in Claude Code, which stages modified files, commits, and pushes.
