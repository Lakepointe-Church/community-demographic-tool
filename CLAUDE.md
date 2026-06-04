@AGENTS.md

---

# Community Intelligence Platform — Lakepointe Church

Internal demographic research dashboard for identifying DFW expansion opportunities. Used by church leadership to evaluate potential campus sites by ZIP code growth, income, household composition, and race/ethnicity.

## What's been built

### Pages (all live)
| Route | Status | Description |
|---|---|---|
| `/` | ✅ | Overview: aggregate stats, Mapbox choropleth growth map, age/income charts, growth table |
| `/demographics` | ✅ | Per-ZIP: 8 stat cards, race donut, education bars, age bars, household type donut |
| `/compare` | ✅ | Multi-select ZIP comparison: combined stats, race donut, income chart, summary table |
| `/ses-classes` | 🔲 | Not built |
| `/religious` | 🔲 | Not built |
| `/employers` | 🔲 | Not built |
| `/site-scorer` | 🔲 | Not built |

### Data sources (all routed through Neon DB)
- **Census ACS 5-Year (2023)** — per-ZIP: population, income, home value, race/ethnicity, education, household type, age distribution, income brackets, SES class score
- **BLS LAUS** — DFW metro unemployment + labor force
- **FRED** — DFW metro population + housing permits
- **College Scorecard** — `/api/scorecard?zip=&radius=` direct API call (not cached)
- **Census TIGERweb** — ZCTA polygon boundaries for Mapbox map (24hr server cache)

## Architecture

```
External APIs (Census, BLS, FRED)
        ↓
  POST /api/refresh          ← run annually (Census) or monthly (BLS/FRED)
        ↓
   Neon PostgreSQL            ← single source of truth
        ↓
  /api/census?zip=            ← single ZIP read
  /api/census/batch?zips=     ← multi-ZIP read (Compare page)
  /api/bls                    ← metro stats
  /api/fred                   ← metro stats
  /api/overview               ← aggregates all ZIPs + computes weighted averages
        ↓
  Next.js pages (client components fetch on load)
```

## Database schema

**`zip_demographics`** — one row per ZIP, upserted on refresh
Key columns: `zip`, `population`, `population_2020`, `population_growth`, `median_household_income`, `median_home_value`, `total_households`, `avg_household_size`, `hh_with_children_pct`, `unemployment_rate`, `bachelors_rate`, `ses_label`, `ses_score`, `race_*`, `edu_*`, `age_*`, `hh_married_with_children`, `hh_married_no_children`, `hh_single_parent`, `hh_living_alone`, `hh_other_type`, `income_lt25k` through `income_150k_plus`, `updated_at`

**`metro_stats`** — single row (id=1), BLS + FRED metro data

## SES class scoring
Composite 0–100 score: income (50%) + bachelor's rate (30%) + home value (20%)
- Upper: 78–100 · Upper Middle: 58–77 · Middle: 40–57 · Lower Middle: 25–39 · Lower Income: 0–24

## Brand / design system
- Background: `#0d0f14` · Surface: `#13161f` · Border: `#1e2433`
- Gold (primary): `#E8B84B` · Blue: `#4EAEFF` · Teal: `#2DD4BF` · Coral: `#FF6B6B` · Purple: `#A78BFA`
- Fonts: Bebas Neue (display/numbers), IBM Plex Mono (labels/data), IBM Plex Sans (body)
- No chart library — all charts are custom SVG inline in each page component
- No UI component library — all inline styles

## ZIP coverage
**169 ZIPs** across the full DFW metro as of last session. Defined in `src/lib/zips.ts`.
Organized into: East Corridor · North DFW · Central · Denton County · Tarrant/Mid-Cities · Fort Worth Core · Arlington · Grand Prairie · Inner Garland · Dallas City · South Dallas Suburbs · Greenville/Hunt County · Suburban Fill

To add ZIPs: append to `src/lib/zips.ts`, then run `POST /api/refresh` from the dev server or production URL.

To remove a ZIP with no ACS data: it will fail silently during refresh and simply won't appear in the DB — just remove it from `src/lib/zips.ts`.

## Running locally
```bash
npm run dev           # start dev server on :3000
vercel env pull       # sync Neon + API keys from Vercel
```

## Refreshing data
```bash
# Run from dev server (takes ~90s for 169 ZIPs)
curl -X POST http://localhost:3000/api/refresh

# Or from production
curl -X POST https://community-demographic-tool.vercel.app/api/refresh
```

Run refresh:
- **Census ACS** — annually (data updates once/year)
- **BLS/FRED** — monthly if you want current metro stats

## DB migration (adding new columns)
If new columns are needed, add them to both the `zip_demographics` schema in `src/app/api/db/migrate/route.ts` AND run an `ALTER TABLE` directly:
```bash
# Example (uses DATABASE_URL from .env.local)
DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'"' -f2) node -e "
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  sql\`ALTER TABLE zip_demographics ADD COLUMN IF NOT EXISTS new_col NUMERIC(5,1)\`
    .then(() => console.log('done'));
"
```

## Key files
```
src/lib/zips.ts              — ZIP list (edit here to add/remove ZIPs)
src/lib/census.ts            — Census ACS fetch logic (all variables)
src/lib/db.ts                — Neon client
src/components/TopNav.tsx    — Shared nav with active-link routing
src/components/MapboxChoropleth.tsx  — Mapbox choropleth map component
src/app/page.tsx             — Overview page
src/app/demographics/page.tsx
src/app/compare/page.tsx
src/app/api/refresh/route.ts — Populates all ZIP data in DB
src/app/api/overview/route.ts — Aggregates all ZIPs for Overview page
src/app/api/census/route.ts  — Single ZIP read from DB
src/app/api/census/batch/route.ts — Multi-ZIP read (Compare page)
src/app/api/boundaries/route.ts — ZCTA polygon GeoJSON from TIGERweb
```

## Deployed
- **Production**: https://community-demographic-tool.vercel.app
- **GitHub**: https://github.com/Lakepointe-Church/community-demographic-tool
- **Vercel project**: `community-demographic-tool` under `plafatas-projects`
- **Neon DB**: `community-demographic-tool` integration on Vercel
