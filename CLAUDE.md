@AGENTS.md

---

# Community Intelligence Platform — Lakepointe Church

Internal demographic research dashboard for identifying DFW expansion opportunities. Used by church leadership to evaluate potential campus sites by ZIP code growth, income, household composition, and race/ethnicity.

## What's been built

### Pages (all live)
| Route | Status | Description |
|---|---|---|
| `/` | ✅ | Overview: aggregate stats, Mapbox choropleth growth map (campus markers, isochrone controls, attendee overlay toggle, candidate-pin drop mode), age/income charts, growth table |
| `/demographics` | ✅ | Per-ZIP: 8 stat cards + Dual-Earner HH + Long Commute cards, YFI/WFI indexes, race donut, education bars, age bars, household type donut, college scorecard |
| `/compare` | ✅ | Multi-select ZIP comparison: combined stats, race donut, income chart, summary table |
| `/ses-classes` | ✅ | SES tier breakdown: 4 stat cards, distribution bar chart, scatter plot (SES score vs income), filterable/sortable table with ZIP/Class/HHI/Bachelor+/Mgmt+Prof/Unemployment/Trend |
| `/religious` | ✅ | DFW religious landscape: stat cards, faith distribution bar, top Islamic ZIPs table, county comparison (Islamic vs Christian BMF), 2020 Religion Census county adherence panel (Unclaimed/tradition breakdown, ESTIMATE-labeled), **ACS proxy layer** (PROXY-labeled ranked list: foreign-born from 20 Muslim-majority countries + Arabic speakers, per-1K, sortable, caveat callout with Iraq/Egypt/Syria flags), per-ZIP org breakdown, Islamic org panel |
| `/employers` | ✅ | Census CBP 2022: ZIP dropdown top-right (DFW metro default), industry mix + avg wage by sector side-by-side, top ZIPs grid; per-ZIP: donut + size distribution + sector wages |
| `/community-needs` | ✅ | CDC PLACES health metrics + CFPB complaints: DFW metro averages, scrollable ZIP rankings table, per-ZIP health profile vs DFW avg |
| `/site-scorer` | ✅ | Full Site Scorer: **6** adjustable weight sliders (YFI/WFI/SES/Growth/Saturation/**Enrollment Growth**) with Normalize + Reset, opportunity quadrant scatter, top-10 sidebar, sortable ranked table (incl. Enroll. column), CSV export, coverage toggle |
| `/methodology` | ✅ | Static data dictionary: all 13 sources (incl. BPS/TEA/TDC Phase 5), SES scoring, YFI/WFI weights, Site Scorer weights (6 sliders) + normalization formulas, Phase 5 leading indicators section, church saturation index, ASARB methodology, per-metric definitions, known limitations |
| `/zip/[zip]/print` | ✅ | Per-ZIP print one-pager: white-background document layout, 8 core stats, household/age/race breakdown, CDC PLACES health, employers, religious orgs — "Print / Save as PDF" button calls `window.print()`; linked from Demographics page ZIP selector |

### Data sources (all routed through Neon DB)
- **Census BPS (Building Permits Survey)** — county-level annual permit counts (SF + MF), 3 years. Loaded via `scripts/import-permits.ts` (automated). Shows on Demographics page as momentum badge.
- **TEA PEIMS** — ISD district enrollment 2020-21→2024-25, county-aggregated. Loaded via `scripts/import-tea.ts` (manual download). Drives enrollment growth score in Site Scorer + trend chart on Demographics.
- **Texas Demographic Center Projections (Vintage 2024)** — county-level 2030/2040/2050 projections (mid scenario). Loaded via `scripts/import-tdc.ts` (manual download). Context panel on Demographics only.
- **Census ACS 5-Year (2023)** — per-ZIP: population, income, home value, race/ethnicity, education, household type, age distribution, income brackets, SES class score, fertility rate, dual-earner %, commute 30+ %, occupation mgmt/prof %, proxy_born (B05006 foreign-born from 20 Muslim-majority countries), proxy_language (C16001 Arabic speakers). **2020 baseline** (`population_2020`) uses Decennial 2020 DHC (`P1_001N`), not ACS — true point-in-time count on exact 2020 boundaries.
- **Census CBP 2022 (County Business Patterns)** — per-ZIP: total establishments, employment, payroll, sector breakdown (20 NAICS sectors, now includes emp+payroll per sector), employer size distribution. Also fetches county-level CBP for 4 DFW core counties (Dallas/Tarrant/Collin/Denton) to compute avg wages by sector. Loaded via `/api/refresh`
- **BLS LAUS** — DFW metro unemployment + labor force
- **FRED** — DFW metro population + housing permits
- **College Scorecard** — `/api/scorecard?zip=&radius=` direct API call (not cached); trade schools (iclevel=3) filtered from display
- **Census TIGERweb** — ZCTA polygon boundaries for Mapbox map (24hr server cache)
- **IRS BMF (NTEE X)** — DFW religious orgs from `eo_tx.csv`; 7,040 orgs loaded via `scripts/import-bmf.ts`. Refresh: re-run script (IRS publishes monthly)
- **2020 U.S. Religion Census (ASARB)** — county-level adherent counts by tradition (Evangelical/Mainline/Black Protestant, Catholic, Orthodox, Muslim, Jewish, Buddhist, Hindu, Other, Unclaimed) for 23 DFW counties. Static data in `data/religion-census-dfw.json`; loaded via `scripts/import-religion-census.ts`. Decennial data (next ~2030). Attribution required: "2020 U.S. Religion Census (ASARB) · County level · Adherent estimates"
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
  /api/overview?coverage=      ← aggregates all ZIPs + computes weighted averages; ?coverage=core|all (default core)
  /api/religious               ← DFW overview stats (incl. saturation + county comparison) + per-ZIP orgs
  /api/religious/adherence     ← 2020 Religion Census county adherence by tradition (23 counties) + core MSA summary
  /api/religious/proxy?coverage= ← per-ZIP Muslim community proxy: proxy_born + proxy_language ranked list
  /api/site-scorer?coverage=   ← per-ZIP: church saturation + YFI + WFI + SES + growth; joins zip_demographics + religious_orgs
  /api/ses-classes?coverage=   ← all ZIPs sorted by SES score with tier counts; ?coverage=core|all
  /api/employers?zip=          ← CBP employer data (overview or per-ZIP)
  /api/community-needs?coverage=&zip= ← CDC PLACES + CFPB health data; ?coverage=core|all for overview mode
  /api/scorecard?zip=&radius=  ← College Scorecard (direct, not cached in Neon)
  /api/boundaries              ← ZCTA polygon GeoJSON from TIGERweb (24hr cache)
  /api/attendee-density        ← GET: per-ZIP Rock RMS household counts (privacy-masked); POST: CSV upload
  /api/isochrone               ← Mapbox Isochrone API proxy; ?lng=&lat=&minutes=&profile= (6hr in-memory cache)
        ↓
  Next.js pages (client components fetch on load)
```

## Database schema

**`zip_demographics`** — one row per ZIP, upserted on refresh
Key columns: `zip`, `population`, `population_2020`, `population_growth` (NUMERIC(8,1) — widened to handle extreme rural growth rates), `median_household_income`, `median_home_value`, `total_households`, `avg_household_size`, `hh_with_children_pct`, `unemployment_rate`, `bachelors_rate`, `ses_label`, `ses_score`, `race_*`, `edu_*`, `age_*`, `hh_married_with_children`, `hh_married_no_children`, `hh_single_parent`, `hh_living_alone`, `hh_other_type`, `income_lt25k` through `income_150k_plus`, `fertility_rate`, `dual_earner_pct`, `commute_30plus_pct`, `occ_mgmt_prof_pct`, `proxy_born` (INT — sum of B05006 foreign-born from 20 Muslim-majority countries), `proxy_language` (INT — C16001_033E Arabic speakers), `hhi_moe` (INT — B19013_001M margin of error at 90% CI), `low_reliability` (BOOLEAN DEFAULT FALSE — true when population < 2,500 or income = 0 or CV > 30%; hidden by default in SES Classes table, excluded from Site Scorer rankings), `updated_at`

**`metro_stats`** — single row (id=1), BLS + FRED metro data
Columns: `bls_unemployment_rate`, `bls_employed_persons`, `bls_labor_force`, `bls_period`, `bls_year`, `fred_population`, `fred_population_date`, `fred_housing_permits`, `fred_housing_permits_date`, `sector_wages` (JSONB — `[{label, avgWage}]` from county-level CBP, sorted by avgWage DESC), `updated_at`

**`religious_orgs`** — one row per EIN, loaded via `scripts/import-bmf.ts`
Columns: `ein` (PK), `name`, `street`, `city`, `state`, `zip`, `ntee_cd`, `ntee_category` (Christian/Islamic/Jewish/Hindu/Buddhist/Unitarian/Other), `ntee_label`, `ruling_year`, `status`, `subsection`, `updated_at`
Indexes: `idx_religious_orgs_zip`, `idx_religious_orgs_ntee`

**`zip_employers`** — one row per ZIP, upserted via `/api/refresh` (CBP pass)
Columns: `zip` (PK), `total_estab`, `total_emp`, `total_payroll` (BIGINT, in $1000s), `sectors` (JSONB — `[{label, estab, emp, payroll}]` sorted by estab DESC), `size_dist` (JSONB — `[{label, estab}]` by employee size band), `updated_at`

**`religious_adherence`** — one row per county (23 DFW counties), loaded via `scripts/import-religion-census.ts`
Columns: `fips` (PK), `county`, `region` (core_msa|extended), `population`, `total_adherents`, `unclaimed`, `evangelical`, `mainline_protestant`, `black_protestant`, `catholic`, `orthodox`, `jewish`, `buddhist`, `hindu`, `muslim`, `other_christian`, `other`, `congregations`, `source`, `updated_at`

**`community_health`** — one row per ZIP, loaded via scripts + `/api/refresh-community`
Columns: `zip` (PK), `diabetes`, `obesity`, `smoking`, `uninsured`, `high_blood_pressure`, `depression`, `mental_distress`, `phys_inactivity`, `gen_poor_health` (all NUMERIC(5,1), % of adults), `cfpb_complaints` (INT), `updated_at`

**`attendee_density`** — one row per ZIP, uploaded via `/admin/attendee-upload` from Rock RMS export
Columns: `zip` (PK), `total_households` (INT), `campus_breakdown` (JSONB — `{campusLabel: count}`), `source_date` (TEXT), `updated_at`
Privacy rule: ZIPs with `total_households < 5` are suppressed in API responses (`households: -1`); never displayed on map.

**`attendee_upload_log`** — one row per successful POST upload
Columns: `id` (SERIAL PK), `uploaded_at` (TIMESTAMPTZ), `zip_count` (INT), `total_households` (INT), `filename` (TEXT), `source_date` (TEXT)
Returned as `lastUpload` in GET /api/attendee-density response; drives status indicator on admin page and map toggle.

**`county_permits`** — one row per county per year, loaded via `scripts/import-permits.ts`
Columns: `fips` (TEXT), `county` (TEXT), `year` (INT), `sf_permits` (INT), `mf_permits` (INT), `total_permits` (INT), `updated_at`
PK: `(fips, year)`. 3 years of data (2023–2025).

**`isd_enrollment`** — one row per ISD per year, loaded via `scripts/import-tea.ts`
Columns: `district_id` (TEXT), `district_name` (TEXT), `county` (TEXT — matches ZIP_COUNTY values), `year` (INT), `enrollment` (INT), `updated_at`
PK: `(district_id, year)`. Index on `county`. 5 years of data (2020–2024).

**`county_projections`** — one row per county, loaded via `scripts/import-tdc.ts`
Columns: `fips` (PK), `county` (TEXT), `base_2020`, `proj_2025`, `proj_2030`, `proj_2035`, `proj_2040`, `proj_2050` (all INT), `updated_at`
TDC Vintage 2024, mid-migration scenario, 23 DFW counties.

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

### Horizontal bar list pattern (CSS flex, immune to container-width scaling)
Used in `/employers` for industry mix and sector wage charts. **Do NOT use SVG for horizontal bar lists** — `width="100%"` on SVG scales all dimensions proportionally and makes bars enormous on wide screens.
```tsx
// BarList component: fixed 12px bar height, flex layout
<div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
  {rows.map((r, i) => {
    const pct = (r.value / maxVal) * 100
    return (
      <div key={r.label} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ width:'130px', flexShrink:0, textAlign:'right', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#8A98AE' }}>{r.label}</div>
        <div style={{ flex:1, height:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:`linear-gradient(90deg,${color},${color}50)` }} />
        </div>
        <div style={{ width:'60px', flexShrink:0, textAlign:'right', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color, fontWeight:'600' }}>{formatValue(r.value)}</div>
      </div>
    )
  })}
</div>
```

### Nav active pill
```tsx
background: 'rgba(232,184,75,0.12)', padding: '5px 10px', borderRadius: 4,
border: '1px solid rgba(232,184,75,0.2)'
```
Inactive links use `#8A98AE` with `.nav-link-item` CSS class (hover → `#C8D4E4`).

### Coverage controls pattern (Overview, SES Classes, Community Needs)
Page-level `<select>` + `↺ Refresh` button in the page header (right side). `coverage` and `refreshKey` are local state; `useEffect([coverage, refreshKey])` drives fetch. `window.history.replaceState` syncs the URL without triggering Next.js navigation.
```tsx
const [coverage, setCoverage] = useState<'core'|'all'>('core')
const [refreshKey, setRefreshKey] = useState(0)

function handleCoverageChange(val: 'core' | 'all') {
  setCoverage(val)
  const url = new URL(window.location.href)
  val === 'all' ? url.searchParams.set('coverage', 'all') : url.searchParams.delete('coverage')
  window.history.replaceState(null, '', url.toString())
}
// mount effect reads URL once for initial state
// fetch effect: useEffect(() => { fetch(`/api/...?coverage=${coverage}`) }, [coverage, refreshKey])
```
Controls render:
```tsx
<select value={coverage} onChange={e => handleCoverageChange(e.target.value as 'core' | 'all')}
  style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px',
    background:'#13161f', color:'#C8D4E4', border:'1px solid #232940',
    borderRadius:'4px', padding:'6px 10px', cursor:'pointer', outline:'none',
    appearance:'none' as const, WebkitAppearance:'none' as const }}>
  <option value="core">Core MSA · 11 counties</option>
  <option value="all">All ZIPs · Full coverage</option>
</select>
<button onClick={() => setRefreshKey(k => k + 1)} ...>↺ Refresh</button>
```

### ZCTA footnote
Present in the footer of every page that displays ACS data (Overview, Demographics, Compare, SES Classes, Community Needs):
```tsx
<span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478' }}>
  * ZIP-level data uses ZCTA boundaries (Census ZIP Code Tabulation Areas), which approximate but do not exactly match USPS ZIP codes.
</span>
```

## ZIP coverage
**370 ZIPs** across the full DFW metro (75-mile radius from Dallas center). Defined in `src/lib/zips.ts`.
30 groups: East Corridor · North Dallas · Central/Richardson · Irving/Las Colinas · Denton County · Tarrant/Mid-Cities · Fort Worth Suburbs · Fort Worth City Core · Grand Prairie · Garland · Dallas City · Dallas City Core · South Dallas Suburbs · Ellis County · Johnson County · Parker County · Wise County · Hood County · Cooke/Montague County · Collin County North · Grayson County · Fanin County · Hunt County · Kaufman County · Van Zandt/Rains County · Henderson County · Navarro County · Hill County · Hopkins/Wood County · Suburban Fill

### Region tagging
Each group has a `region: 'core_msa' | 'extended'` field. Pages with a coverage dropdown filter aggregates to the selected set.
- **`core_msa`** (21 groups, 273 ZIPs) — standard 11-county DFW-Plano-Arlington MSA; default for all averages and rankings
- **`extended`** (9 groups, 97 ZIPs) — outer counties: Hood, Cooke/Montague, Grayson, Fanin, Van Zandt/Rains, Henderson, Navarro, Hill, Hopkins/Wood

`src/lib/zips.ts` exports:
```ts
ZIP_GROUPS        // 30 group objects with { label, region, zips[] } — used by ZIP dropdown components
DFW_ZIPS          // all 370 entries with { zip, label, region }
CORE_MSA_ZIPS     // 273 core MSA entries
CORE_MSA_ZIP_SET  // Set<string> for O(1) lookup
CAMPUS_ZIPS       // Record<zip, 'existing'|'soon'> — drives gold dot indicators in ZIP dropdowns
                  // existing: Rockwall 75087, Mesquite 75150, Firewheel 75044, Forney 75126,
                  //           N. Dallas 75251, E. Dallas 75218, Sunnyvale 75182, Royse City 75189
                  // soon:     Lucas/Allen 75002, Greenville 75401
BOUNDARY_CHANGED  // Set<string> — 7 ZIPs with known 2020→2023 ZCTA boundary splits; growth nulled
                  // confirmed: 75070 (McKinney W), 75034 (Frisco W)
                  // needs verification: 75132, 76061, 76623, 76490, 75157
```

To add ZIPs: append to `src/lib/zips.ts`, then run `POST /api/refresh` from the dev server or production URL.

To remove a ZIP with no ACS data: it will fail silently during refresh and simply won't appear in the DB — just remove it from `src/lib/zips.ts`.

## Running locally
```bash
npm run dev           # start dev server on :3000
vercel env pull       # sync Neon + API keys from Vercel
```

## Refreshing data
All mutating endpoints require `Authorization: Bearer $CRON_SECRET`. Set `CRON_SECRET` in your shell or substitute the value directly.

> **Env vars set in Vercel (June 2026):** `CRON_SECRET`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` are all live. `CRON_SECRET` is also in `.env.local` for local curl use. Run `vercel env pull` from the project directory to sync if `.env.local` is ever reset.

```bash
# Step 1: ACS + CBP + BLS/FRED (~8 min for 370 ZIPs — exceeds 300s Hobby timeout, run manually)
# NOT a cron job on Hobby plan. Upgrade to Pro to enable GET /api/refresh cron.
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://community-demographic-tool.vercel.app/api/refresh

# Step 2: CFPB complaints — runs automatically on the 1st of each month via vercel.json cron
# (GET /api/refresh-community at 07:00 UTC). Can also trigger manually:
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://community-demographic-tool.vercel.app/api/refresh-community

# Step 3: CDC PLACES health data (annual, run from local dev server)
npx tsx scripts/import-places.ts

# Step 4: IRS BMF religious orgs (monthly, run from local dev server)
npx tsx scripts/import-bmf.ts
```

Run cadence:
- **Census ACS + CBP** — annually (ACS data updates once/year; CBP is 2022 vintage)
- **BLS/FRED** — monthly if you want current metro stats
- **CFPB complaints** — monthly (trailing 36-month window; run from local dev server)
- **CDC PLACES** — annually (releases once/year)
- **IRS BMF** — monthly (IRS publishes updates monthly)
- **Census BPS** — annually after May release: `npx tsx scripts/import-permits.ts`
- **TEA PEIMS** — annually after ~March release: download CSVs from TEA, then `npx tsx scripts/import-tea.ts`
- **TDC Projections** — every ~2 years on new vintage: download from demographics.texas.gov/Projections/, then `npx tsx scripts/import-tdc.ts`

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
src/lib/zips.ts                        — ZIP list (edit here to add/remove ZIPs); exports ZIP_GROUPS, DFW_ZIPS, CORE_MSA_ZIPS, CORE_MSA_ZIP_SET, CAMPUS_ZIPS, BOUNDARY_CHANGED
src/lib/census.ts                      — Census ACS fetch logic (all variables + proxy); exports fetchZipData, fetchZipProxy. 2020 baseline uses DHC P1_001N; nulls growth for BOUNDARY_CHANGED ZIPs
src/lib/zip-county.ts                  — Static ZIP→county map for all 370 DFW ZIPs; exports ZIP_COUNTY (Record<zip,county>) and CORE_MSA_COUNTIES (Set<string>)
src/lib/cbp.ts                         — Census CBP fetch logic: 20 NAICS sectors (exported as SECTORS) + size distribution; sectors include emp+payroll per sector
src/lib/db.ts                          — Neon client
src/lib/campuses.ts                    — All 10 campus locations with lat/lng + status (existing|soon); used for map markers + isochrone fetch
src/components/TopNav.tsx              — Shared nav; renders <CoverageNav /> (do NOT also render in page files)
src/components/CoverageNav.tsx         — Suspense-wrapped nav links; preserves ?coverage=all param across page transitions
src/components/MapboxChoropleth.tsx    — Mapbox choropleth map; props: zipData, campuses, attendeeData/showAttendees, isochroneGeoJson, candidatePin, onMapClick
src/app/page.tsx                       — Overview page
src/app/site-scorer/page.tsx           — Full Site Scorer: scatter chart, weight sliders, ranked table, CSV export
src/app/demographics/page.tsx          — Per-ZIP demographics + YFI/WFI + college scorecard
src/app/compare/page.tsx               — Multi-ZIP comparison
src/app/ses-classes/page.tsx           — SES tier breakdown: scatter, distribution chart, sortable table
src/app/religious/page.tsx             — Religious landscape (IRS BMF data)
src/app/employers/page.tsx             — CBP employer data: ZIP dropdown (DFW default), BarList industry mix + wages, top ZIPs grid; per-ZIP: donut + size dist + sector wages
src/app/community-needs/page.tsx       — CDC PLACES + CFPB: DFW metro averages + per-ZIP profile
src/app/methodology/page.tsx           — Static data dictionary page (no data fetch; all content inline)
src/app/zip/[zip]/print/page.tsx       — Per-ZIP print one-pager; fetches census + community-needs + employers + religious in parallel
src/lib/csv.ts                         — Client-side CSV download utility: downloadCsv(filename, headers, rows)
src/app/api/refresh/route.ts           — Main refresh: ACS + CBP + BLS/FRED (~8 min, 370 ZIPs)
src/app/api/refresh-community/route.ts — CFPB complaint refresh (separate to avoid Vercel timeout)
src/app/api/overview/route.ts          — Aggregates all ZIPs for Overview page
src/app/api/census/route.ts            — Single ZIP read from DB
src/app/api/census/batch/route.ts      — Multi-ZIP read (Compare page); uses DFW_ZIPS label map so `name` returns neighborhood label, not Census ZCTA string
src/app/api/ses-classes/route.ts       — All ZIPs sorted by SES score + tier counts
src/app/api/religious/route.ts         — DFW overview + per-ZIP orgs from religious_orgs table
src/app/api/religious/adherence/route.ts — 2020 ASARB county adherence + core MSA summary
src/app/api/religious/proxy/route.ts   — per-ZIP proxy_born + proxy_language ranked list (?coverage=core|all)
data/proxy-countries.json              — approved country list with B05006/C16001 variable codes, flags, exclusions
src/app/api/employers/route.ts         — CBP employer data (overview or per-ZIP)
src/app/api/community-needs/route.ts   — CDC PLACES + CFPB health data (overview or per-ZIP)
src/app/api/site-scorer/route.ts       — Per-ZIP church saturation (Christian NTEE orgs/pop × 10K) + YFI + WFI scores; joins zip_demographics + religious_orgs
src/app/api/boundaries/route.ts        — ZCTA polygon GeoJSON from TIGERweb
src/app/api/attendee-density/route.ts  — GET (privacy-masked counts + lastUpload metadata; auth via middleware) + POST (CSV upload; Bearer CRON_SECRET) + DELETE (truncate; Bearer CRON_SECRET)
src/app/api/isochrone/route.ts         — Mapbox Isochrone API proxy; 6hr in-memory cache; ?lng=&lat=&minutes=&profile=
src/app/admin/attendee-upload/page.tsx — Rock RMS upload UI: format docs, privacy callout, source date picker, file upload
src/app/admin/layout.tsx               — Temporary 404 for all /admin/* routes until site-wide middleware is verified; remove after Phase 0.2b confirmed
src/middleware.ts                      — Site-wide Basic auth (BASIC_AUTH_USER/BASIC_AUTH_PASS) + Bearer CRON_SECRET for automation; noindex via next.config.ts headers
scripts/import-bmf.ts                  — IRS BMF loader (re-run monthly; IRS publishes monthly)
scripts/import-places.ts               — CDC PLACES loader (re-run annually)
scripts/import-religion-census.ts      — 2020 ASARB Religion Census loader (decennial; re-run only on new release ~2030)
data/religion-census-dfw.json          — Static processed county adherence data (23 DFW counties, extracted from ASARB Excel)
scripts/import-permits.ts              — Census BPS county annual permits loader (automated; re-run annually after May release)
scripts/import-tea.ts                  — TEA PEIMS enrollment loader (manual download; re-run annually; expects data/tea-enrollment-{YYYY}.csv)
scripts/import-tdc.ts                  — TDC county projections loader (manual download; re-run on new vintage; expects data/tdc-projections-2024.csv)
src/app/api/leading-indicators/route.ts — GET /api/leading-indicators?zip= — returns permits + enrollment + projection for a ZIP's county
scripts/find-missing-zips.ts           — Census Gazetteer-based ZIP radius discovery tool
scripts/label-missing-zips.ts          — Fetches city names for unlabeled ZIPs via zippopotam.us
```

## Slash commands
- `/ship` — stage modified files, commit, push to origin main (triggers Vercel deploy)
- `/doc` — review key files and update this CLAUDE.md to reflect current state

## Enhancement roadmap

### Original build phases (complete)
- **Phase 0** ✅ — UX fixes, coverage toggle, ZCTA footnotes, site-scorer placeholder
- **Phase 1.1** ✅ — `/methodology` data dictionary page
- **Phase 1.2** ✅ — CSV export on ranking tables + per-ZIP print one-pager (`/zip/[zip]/print`)
- **Phase 2** ✅ — Church saturation index + full Site Scorer (quadrant scatter, adjustable weights, ranked table)
- **Phase 3** ✅ — Religious landscape: BMF layer, 2020 ASARB adherence, ACS proxy layer (PROXY-labeled), confidence tiers
- **Phase 4** ✅ (scaffold) — Attendee density (`attendee_density` table, CSV upload, privacy masking, map overlay toggle). Drive-time isochrones (campus markers, Mapbox proxy, 15/20/30-min polygons, candidate-pin mode).
- **Phase 5** ✅ (scaffold) — Building permits (`county_permits`), TEA enrollment (`isd_enrollment`, 6th Site Scorer slider), TDC projections (`county_projections`). All three need first data load; UI degrades gracefully.

### CIP Spec v2 phases (active — spec lives in `cip-spec-2.md`)
- **Spec v2 Phase 0** — Security hardening
  - **0.2a** ✅ — Bearer `CRON_SECRET` guard on `/api/refresh`, `/api/db/migrate`, `/api/attendee-density` (GET + POST)
  - **0.2b** ✅ — Site-wide Basic auth middleware (`src/middleware.ts`); `X-Robots-Tag: noindex` via `next.config.ts`; `robots.txt`; admin routes temporarily 404'd
  - **0.1** ⏳ [HUMAN] — Enable Vercel Deployment Protection for preview URLs in Vercel dashboard
  - **0.3** ⏳ [HUMAN] — Mapbox token: move to church-owned account, add URL restrictions, separate server-only token for isochrone route
  - **0.4** ✅ — `npm uninstall xlsx` (unused, CVE)
  - **0.5** ✅ — CFPB cron in `vercel.json` (`GET /api/refresh-community`, 1st of month 07:00 UTC); ACS refresh excluded (exceeds 300s Hobby timeout — stays manual; GET handler added to `/api/refresh` for Pro-plan readiness)
  - **0.6** ✅ — Attendee data: diagnosed (2,893 rows of non-DFW test data in prod DB, source 2026-06-12); fixed GET auth bug (route was requiring Bearer, blocking browser map load); added `attendee_upload_log` table + upload status to admin page (last upload date/ZIPs/HH + Truncate button) and map toggle tooltip; admin routes re-enabled (removed `notFound()` from admin/layout.tsx). **[HUMAN]**: truncate bad data via admin page, re-upload `FamilyCountByCampusAndPostalCode_20260611.csv`
- **Spec v2 Phase 1** — Data integrity
  - **1.1** ✅ — Growth metric fixed: 2020 base swapped to Decennial DHC (`P1_001N`); `BOUNDARY_CHANGED` set nulls 7 split ZIPs; Site Scorer redistributes null-growth weight; tooltip + Demographics sub-label explain unavailability
  - **1.2** ✅ — Reliability flags: `hhi_moe` + `low_reliability` columns added to DB and refresh; SES Classes table hides unreliable ZIPs by default (⚠ toggle to show greyed); Site Scorer always excludes them
  - **1.3** ✅ — CFPB trailing 36-month window per 1K residents; methodology + page labels updated; now runs via cron (see 0.5)
  - **1.4** ⏳ — Verify + ingest ACS 2024 5-year and CDC PLACES 2024 if released
  - **1.5** ⏳ [HUMAN] — Reconcile SES model: docs say percentile/6-class; code uses absolute/5-class. Recommend keeping absolute thresholds.
- **Spec v2 Phase 2** ⏳ — Attendee layer activation (after Phase 0 verified): penetration metrics, campus draw areas, underserved clusters, cannibalization check
- **Spec v2 Phase 3** ⏳ — Executive decision layer: shareable scenario URLs, score percentile anchoring, insights panel, distance-to-campus slider, Vercel Analytics, boardroom UX improvements
- **Spec v2 Phase 4** ⏳ — New data sources: HUD/USPS address counts, BPS place-level, TEA campus-level, IRS SOI, LEHD LODES, Zillow ZHVI, Google Places (shortlist only)

## Planned next data sources (ordered by priority)
These are the next APIs to wire in, from Paul's Technical Specification v1.1 (April 2026).

### High — free, no new keys needed
| Source | What it unlocks | Notes |
|---|---|---|
| ~~**YFI (Young Family Index)**~~ | ✅ **Done** | Live in Site Scorer; computed from ACS columns already in DB |
| ~~**WFI (Working Family Index)**~~ | ✅ **Done** | Live in Site Scorer; computed from ACS columns already in DB |
| ~~**BLS QCEW**~~ | ✅ **Done via CBP county-level** | Avg wage by sector now computed from Census CBP county data for 4 DFW counties (Dallas/Tarrant/Collin/Denton); stored in `metro_stats.sector_wages` |
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
**Young Family Index (YFI)** — composite 0–100 ✅ live (Demographics page + Site Scorer)
- 40% young children share (age_0_17 / 30%), 25% family HH rate (mwKids+single / 40%), 20% fertility (rate×100 / 8%), 15% HH size ((size−1.5)/2.0)

**Working Family Index (WFI)** — composite 0–100 ✅ live (Demographics page + Site Scorer)
- 40% dual-earner rate (/40%), 25% HH with children (/50%), 20% commute burden inverse (100−commute30+%), 15% bachelor's rate proxy (/50%)

**Lakepointe Fit Score** ✅ live on `/site-scorer`
- Default weights: YFI 23% · WFI 23% · SES 18% · Population Growth 14% · Church Saturation Opportunity 12% · **School Enrollment Growth 10%**
- User-adjustable via sliders; Normalize button snaps to 100%; all weights documented at `/methodology#site-scorer`
- Church Saturation Opportunity = 100 − min(100, churches/10K / 30 × 100) — inverts BMF Christian org density so low saturation = high score
- School Enrollment Growth = county ISD CAGR (TEA PEIMS) × 12, capped 0–100; shows "—" until TEA data loaded (graceful degradation)
- **Null growth handling**: ZIPs with `populationGrowth = null` (ZCTA boundary splits or missing 2020 data) have their growth weight redistributed proportionally across the other 5 components — they are not penalized with a 0. Growth column shows "—" with hover tooltip.

## Notion tracker
Full task tracker (ordered by priority): https://www.notion.so/e94e55e73b55430bb9646e37600e4998

## Deployed
- **Production**: https://community-demographic-tool.vercel.app
- **GitHub**: https://github.com/Lakepointe-Church/community-demographic-tool
- **Vercel project**: `community-demographic-tool` under `plafatas-projects`
- **Neon DB**: `community-demographic-tool` integration on Vercel
