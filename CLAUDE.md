@AGENTS.md

---

# Community Intelligence Platform — Lakepointe Church

Internal demographic research dashboard for identifying DFW expansion opportunities. Used by church leadership to evaluate potential campus sites by ZIP code growth, income, household composition, and race/ethnicity.

## What's been built

### Pages (all live)
| Route | Status | Description |
|---|---|---|
| `/` | ✅ | Overview: aggregate stats, Mapbox choropleth growth map, age/income charts, growth table |
| `/demographics` | ✅ | Per-ZIP: 8 stat cards + Dual-Earner HH + Long Commute cards, YFI/WFI indexes, race donut, education bars, age bars, household type donut, college scorecard |
| `/compare` | ✅ | Multi-select ZIP comparison: combined stats, race donut, income chart, summary table |
| `/ses-classes` | ✅ | SES tier breakdown: 4 stat cards, distribution bar chart, scatter plot (SES score vs income), filterable/sortable table with ZIP/Class/HHI/Bachelor+/Mgmt+Prof/Unemployment/Trend |
| `/religious` | ✅ | DFW religious landscape: stat cards, faith distribution bar chart, top Islamic ZIPs table, per-ZIP org breakdown, Islamic org panel with ruling year + NEW badge |
| `/employers` | ✅ | Census CBP 2022: DFW metro stat cards, industry mix bar chart, top ZIPs list, per-ZIP donut chart + employer size distribution chart |
| `/community-needs` | ✅ | CDC PLACES health metrics + CFPB complaints: DFW metro averages, scrollable ZIP rankings table, per-ZIP health profile vs DFW avg |
| `/site-scorer` | 🔲 | Not built |

### Data sources (all routed through Neon DB)
- **Census ACS 5-Year (2023)** — per-ZIP: population, income, home value, race/ethnicity, education, household type, age distribution, income brackets, SES class score, fertility rate, dual-earner %, commute 30+ %, occupation mgmt/prof %
- **Census CBP 2022 (County Business Patterns)** — per-ZIP: total establishments, employment, payroll, sector breakdown (20 NAICS sectors), employer size distribution. Loaded via `/api/refresh`
- **BLS LAUS** — DFW metro unemployment + labor force
- **FRED** — DFW metro population + housing permits
- **College Scorecard** — `/api/scorecard?zip=&radius=` direct API call (not cached); trade schools (iclevel=3) filtered from display
- **Census TIGERweb** — ZCTA polygon boundaries for Mapbox map (24hr server cache)
- **IRS BMF (NTEE X)** — DFW religious orgs from `eo_tx.csv`; 7,040 orgs loaded via `scripts/import-bmf.ts`. Refresh: re-run script (IRS publishes monthly)
- **CDC PLACES (2023)** — per-ZIP health rates: diabetes, obesity, smoking, uninsured, high BP, depression, mental distress, physical inactivity, poor general health. Loaded via `scripts/import-places.ts` (run annually)
- **CFPB Consumer Complaints** — per-ZIP complaint counts. Loaded via `POST /api/refresh-community` (run monthly, separate from main refresh to avoid timeout)

## Architecture

```
External APIs (Census ACS, Census CBP, BLS, FRED)
        ↓
  POST /api/refresh            ← run annually (Census) or monthly (BLS/FRED) — ~8 min for 370 ZIPs
  POST /api/refresh-community  ← run monthly for CFPB complaints (separate to avoid timeout)
  scripts/import-bmf.ts        ← run monthly for IRS BMF religious orgs
  scripts/import-places.ts     ← run annually for CDC PLACES health data
        ↓
   Neon PostgreSQL              ← single source of truth
        ↓
  /api/census?zip=             ← single ZIP read (Demographics page)
  /api/census/batch?zips=      ← multi-ZIP read (Compare page)
  /api/overview                ← aggregates all ZIPs + computes weighted averages
  /api/religious               ← DFW overview stats + per-ZIP orgs
  /api/ses-classes             ← all ZIPs sorted by SES score with tier counts
  /api/employers?zip=          ← CBP employer data (overview or per-ZIP)
  /api/community-needs?zip=    ← CDC PLACES + CFPB health data (overview or per-ZIP)
  /api/scorecard?zip=&radius=  ← College Scorecard (direct, not cached in Neon)
  /api/boundaries              ← ZCTA polygon GeoJSON from TIGERweb (24hr cache)
        ↓
  Next.js pages (client components fetch on load)
```

## Database schema

**`zip_demographics`** — one row per ZIP, upserted on refresh
Key columns: `zip`, `population`, `population_2020`, `population_growth` (NUMERIC(8,1) — widened to handle extreme rural growth rates), `median_household_income`, `median_home_value`, `total_households`, `avg_household_size`, `hh_with_children_pct`, `unemployment_rate`, `bachelors_rate`, `ses_label`, `ses_score`, `race_*`, `edu_*`, `age_*`, `hh_married_with_children`, `hh_married_no_children`, `hh_single_parent`, `hh_living_alone`, `hh_other_type`, `income_lt25k` through `income_150k_plus`, `fertility_rate`, `dual_earner_pct`, `commute_30plus_pct`, `occ_mgmt_prof_pct`, `updated_at`

**`metro_stats`** — single row (id=1), BLS + FRED metro data

**`religious_orgs`** — one row per EIN, loaded via `scripts/import-bmf.ts`
Columns: `ein` (PK), `name`, `street`, `city`, `state`, `zip`, `ntee_cd`, `ntee_category` (Christian/Islamic/Jewish/Hindu/Buddhist/Unitarian/Other), `ntee_label`, `ruling_year`, `status`, `subsection`, `updated_at`
Indexes: `idx_religious_orgs_zip`, `idx_religious_orgs_ntee`

**`zip_employers`** — one row per ZIP, upserted via `/api/refresh` (CBP pass)
Columns: `zip` (PK), `total_estab`, `total_emp`, `total_payroll` (BIGINT, in $1000s), `sectors` (JSONB — `[{label, estab}]` sorted by estab DESC), `size_dist` (JSONB — `[{label, estab}]` by employee size band), `updated_at`

**`community_health`** — one row per ZIP, loaded via scripts + `/api/refresh-community`
Columns: `zip` (PK), `diabetes`, `obesity`, `smoking`, `uninsured`, `high_blood_pressure`, `depression`, `mental_distress`, `phys_inactivity`, `gen_poor_health` (all NUMERIC(5,1), % of adults), `cfpb_complaints` (INT), `updated_at`

## SES class scoring
Composite 0–100 score: income (50%) + bachelor's rate (30%) + home value (20%)
- Upper: 78–100 · Upper Middle: 58–77 · Middle: 40–57 · Lower Middle: 25–39 · Lower Income: 0–24

## Brand / design system
- Background: `#0d0f14` · Surface: `#13161f` · Border: `#232940` · Border-sub: `#1e2b3c`
- Gold (primary): `#E8B84B` · Blue: `#4EAEFF` · Teal: `#2DD4BF` · Coral: `#FF6B6B` · Purple: `#A78BFA`
- Muted text: `#8A98AE` · Label text: `#A8B4C5` · Footer text: `#5a6478`
- Fonts: Bebas Neue (display/numbers), IBM Plex Mono (labels/data), IBM Plex Sans (body)
- No chart library — all charts are custom SVG inline in each page component
- No UI component library — all inline styles

### Stat card pattern (radial glow)
```tsx
// Default state
background: `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.1) 0%, transparent 55%), linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`
border: `1px solid #232940`
// Hovered state
background: `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.22) 0%, transparent 60%), linear-gradient(145deg, rgba(${rgb},0.08) 0%, rgba(255,255,255,0.01) 100%)`
border: `1px solid rgba(${rgb},0.4)`
```
`rgb` is a comma-separated RGB string e.g. `'232,184,75'` for gold.

### Bar chart pattern (SVG, multi-color gradient bars)
- `padTop = 22` — all y-coordinates offset by this amount to prevent label clipping in overflow containers
- Per-bar `<linearGradient>` defs with unique IDs `bGrad-${i}` (or `ageGrad-${key}`, `incGrad-${i}`)
- `barColors` prop accepts a `string[]` — one color per bar; gradient fades to `${color}80` at bottom
- Age colors: `['#4EAEFF','#2DD4BF','#E8B84B','#A78BFA','#FF6B6B']`
- Income colors: `['#8A98AE','#FF6B6B','#4EAEFF','#2DD4BF','#A78BFA','#E8B84B']`

### Nav active pill
```tsx
background: 'rgba(232,184,75,0.12)', padding: '5px 10px', borderRadius: 4,
border: '1px solid rgba(232,184,75,0.2)'
```
Inactive links use `#8A98AE` with `.nav-link-item` CSS class (hover → `#C8D4E4`).

## ZIP coverage
**370 ZIPs** across the full DFW metro (75-mile radius from Dallas center). Defined in `src/lib/zips.ts`.
30 groups: East Corridor · North Dallas · Central/Richardson · Irving/Las Colinas · Denton County · Tarrant/Mid-Cities · Fort Worth Suburbs · Fort Worth City Core · Grand Prairie · Garland · Dallas City · Dallas City Core · South Dallas Suburbs · Ellis County · Johnson County · Parker County · Wise County · Hood County · Cooke/Montague County · Collin County North · Grayson County · Fanin County · Hunt County · Kaufman County · Van Zandt/Rains County · Henderson County · Navarro County · Hill County · Hopkins/Wood County · Suburban Fill

To add ZIPs: append to `src/lib/zips.ts`, then run `POST /api/refresh` from the dev server or production URL.

To remove a ZIP with no ACS data: it will fail silently during refresh and simply won't appear in the DB — just remove it from `src/lib/zips.ts`.

## Running locally
```bash
npm run dev           # start dev server on :3000
vercel env pull       # sync Neon + API keys from Vercel
```

## Refreshing data
```bash
# Step 1: ACS + CBP + BLS/FRED (~8 min for 370 ZIPs — runs from production, Vercel timeout is 300s)
curl -X POST https://community-demographic-tool.vercel.app/api/refresh

# Step 2: CFPB complaints (separate endpoint to avoid timeout)
curl -X POST https://community-demographic-tool.vercel.app/api/refresh-community

# Step 3: CDC PLACES health data (annual, run from local dev server)
npx tsx scripts/import-places.ts

# Step 4: IRS BMF religious orgs (monthly, run from local dev server)
npx tsx scripts/import-bmf.ts
```

Run cadence:
- **Census ACS + CBP** — annually (ACS data updates once/year; CBP is 2022 vintage)
- **BLS/FRED** — monthly if you want current metro stats
- **CFPB complaints** — monthly (cumulative all-time counts)
- **CDC PLACES** — annually (releases once/year)
- **IRS BMF** — monthly (IRS publishes updates monthly)

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
src/lib/zips.ts                        — ZIP list (edit here to add/remove ZIPs)
src/lib/census.ts                      — Census ACS fetch logic (all variables); handles sentinel values
src/lib/cbp.ts                         — Census CBP fetch logic: 20 NAICS sectors + size distribution
src/lib/db.ts                          — Neon client
src/components/TopNav.tsx              — Shared nav with active-link routing (do NOT also render in page files)
src/components/MapboxChoropleth.tsx    — Mapbox choropleth map component
src/app/page.tsx                       — Overview page
src/app/demographics/page.tsx          — Per-ZIP demographics + YFI/WFI + college scorecard
src/app/compare/page.tsx               — Multi-ZIP comparison
src/app/ses-classes/page.tsx           — SES tier breakdown: scatter, distribution chart, sortable table
src/app/religious/page.tsx             — Religious landscape (IRS BMF data)
src/app/employers/page.tsx             — CBP employer data: sector donut, size distribution
src/app/community-needs/page.tsx       — CDC PLACES + CFPB: DFW metro averages + per-ZIP profile
src/app/api/refresh/route.ts           — Main refresh: ACS + CBP + BLS/FRED (~8 min, 370 ZIPs)
src/app/api/refresh-community/route.ts — CFPB complaint refresh (separate to avoid Vercel timeout)
src/app/api/overview/route.ts          — Aggregates all ZIPs for Overview page
src/app/api/census/route.ts            — Single ZIP read from DB
src/app/api/census/batch/route.ts      — Multi-ZIP read (Compare page)
src/app/api/ses-classes/route.ts       — All ZIPs sorted by SES score + tier counts
src/app/api/religious/route.ts         — DFW overview + per-ZIP orgs from religious_orgs table
src/app/api/employers/route.ts         — CBP employer data (overview or per-ZIP)
src/app/api/community-needs/route.ts   — CDC PLACES + CFPB health data (overview or per-ZIP)
src/app/api/boundaries/route.ts        — ZCTA polygon GeoJSON from TIGERweb
scripts/import-bmf.ts                  — IRS BMF loader (re-run monthly; IRS publishes monthly)
scripts/import-places.ts               — CDC PLACES loader (re-run annually)
scripts/find-missing-zips.ts           — Census Gazetteer-based ZIP radius discovery tool
scripts/label-missing-zips.ts          — Fetches city names for unlabeled ZIPs via zippopotam.us
```

## Slash commands
- `/ship` — stage modified files, commit, push to origin main (triggers Vercel deploy)
- `/doc` — review key files and update this CLAUDE.md to reflect current state

## Planned next data sources (ordered by priority)
These are the next APIs to wire in, from Paul's Technical Specification v1.1 (April 2026).

### High — free, no new keys needed
| Source | What it unlocks | Notes |
|---|---|---|
| **YFI (Young Family Index)** | Site Scorer | Composite from ACS already in DB — no refresh needed |
| **WFI (Working Family Index)** | Site Scorer | Same — all ACS variables already in DB |
| **BLS QCEW** | `/employers` page | Avg wage by sector; uses existing BLS key |
| **IRS SOI** | Site Scorer (tithe potential) | Annual download, no key |

### High — free, nonprofit application in progress
| Source | What it unlocks | Notes |
|---|---|---|
| **GreatSchools API** | Site Scorer | Nonprofit application required (~1–2 wk lead time) |

### Medium — free, no key
| Source | What it unlocks | Notes |
|---|---|---|
| **HMDA** | `/community-needs` page | Mortgage denial rates = financial health proxy. Complex — full TX CSV download required |
| **CDC/ATSDR SVI** | Future page | Social Vulnerability Index — tract-level only, no ZIP crosswalk |

### Low — Phase 3 / paid / requires application
PRRI, ARDA, Zillow, Data Axle, MissionInsite, County Appraisal Districts, NCTCOG

## Lakepointe-specific indexes (from spec §9)
**Young Family Index (YFI)** — composite 0–100
- Young children share (B09001), family HH rate (B11003), fertility signal (B13016), HH size (B25010)

**Working Family Index (WFI)** — composite 0–100
- Dual-earner rate (B23007), working parent rate (B11003), commute burden (B08303), occupational diversity (C24010)

**Lakepointe Fit Score** = YFI + WFI + SES alignment → feeds Site Scorer

## Notion tracker
Full task tracker (ordered by priority): https://www.notion.so/e94e55e73b55430bb9646e37600e4998

## Deployed
- **Production**: https://community-demographic-tool.vercel.app
- **GitHub**: https://github.com/Lakepointe-Church/community-demographic-tool
- **Vercel project**: `community-demographic-tool` under `plafatas-projects`
- **Neon DB**: `community-demographic-tool` integration on Vercel
