@AGENTS.md

---

# Community Intelligence Platform — Lakepointe Church

Internal demographic research dashboard for identifying DFW expansion opportunities. Used by church leadership to evaluate potential campus sites by ZIP code growth, income, household composition, and race/ethnicity.

## What's been built

### Pages (all live)
| Route | Status | Description |
|---|---|---|
| `/` | ✅ | Overview: aggregate stats, **Phase 3.3 insights panel** (top-3 opportunity cards with fit score, percentile, top drivers — loads from `/api/site-scorer` with default weights; existing campus ZIPs excluded from ranking), Mapbox choropleth growth map (campus markers, isochrone controls, attendee overlay toggle, candidate-pin drop mode), age/income charts, growth table. When attendee overlay is on: circles colored by primary campus (warm palette, avoids map zone colors), hover tooltip (campus + HH), click popup with full campus breakdown table, Campus Draw Areas panel below map (bar chart of HH per campus + top ZIPs per campus). **Phase 2.2 extended:** campus rows are clickable filter toggles (click = solo that campus's circles; click again = restore all; "Show all" reset button); Underserved Clusters table (growing ZIPs with low Lakepointe penetration, ranked by growth÷penetration); Cannibalization check in isochrone stats bar (attendee HH within candidate pin's drive polygon, computed via ray-casting on ZCTA centroids) |
| `/demographics` | ✅ | Per-ZIP: 8 stat cards + Dual-Earner HH + Long Commute cards, YFI/WFI indexes, race donut, education bars, age bars, household type donut, college scorecard. **Phase 4.2:** Leading Indicators panel includes a full-width horizontal bar list of top permit-issuing cities in the ZIP's county (Census BPS place-level, 2023–2025, with YoY% delta badges). **Phase 4.5:** Commute Corridors panel (LODES8) — net commute direction (compass + rotated arrow + concentration), resident workers, self-containment %, and top work-destination ZIPs (blue bar list with high-earner ▸% badges). **Phase 4.1 (scaffold):** Address Momentum panel (HUD USPS) — active residential addresses, trailing-4Q % change, quarterly sparkline; renders only once HUD data is loaded. **Phase 4.4:** Giving Capacity panel (IRS SOI) — avg charitable gift per giving return, charitable % of AGI, itemizer rate; renders only when the ZIP has SOI data. **Phase 4.7:** Home Value Trend panel (Zillow ZHVI) — typical home value, YoY % badge, trailing-year sparkline; renders only when the ZIP has ZHVI data. |
| `/compare` | ✅ | Multi-select ZIP comparison: combined stats, race donut, income chart, summary table |
| `/ses-classes` | ✅ | SES tier breakdown: 4 stat cards, distribution bar chart, scatter plot (SES score vs income), filterable/sortable table with ZIP/Class/HHI/Bachelor+/Mgmt+Prof/Unemployment/Trend |
| `/religious` | ✅ | DFW religious landscape: stat cards, faith distribution bar, top Islamic ZIPs table, county comparison (Islamic vs Christian BMF), 2020 Religion Census county adherence panel (Unclaimed/tradition breakdown, ESTIMATE-labeled), **ACS proxy layer** (PROXY-labeled ranked list: foreign-born from 20 Muslim-majority countries + Arabic speakers, per-1K, sortable, caveat callout with Iraq/Egypt/Syria flags), per-ZIP org breakdown, Islamic org panel |
| `/employers` | ✅ | Census CBP 2022: ZIP dropdown top-right (DFW metro default), industry mix + avg wage by sector side-by-side, top ZIPs grid; per-ZIP: donut + size distribution + sector wages |
| `/community-needs` | ✅ | CDC PLACES health metrics + CFPB complaints: DFW metro averages, scrollable ZIP rankings table, per-ZIP health profile vs DFW avg |
| `/site-scorer` | ✅ | Full Site Scorer: **signal toggle pills** along the top of the weights panel (YFI/WFI/SES/Growth/Saturation/Enrollment/**Distance**) — click to include/exclude each signal from the score; disabled signals' sliders hide and the remaining weights renormalize to 100%; at least one signal always stays on. Selection encoded in URL (`off=` lists disabled signals, `dist=1` flags distance-on, e.g. `?off=enrollment&dist=1`). **Distance** = straight-line miles to nearest existing campus (computed server-side from `data/dfw-zip-centroids.json` + `CAMPUSES`; farther = more open territory = higher score); **defaults OFF** and auto-sets weight 10 when first enabled. Weight sliders for each enabled signal with Normalize (operates on enabled signals) + Reset + **3 preset buttons** (Balanced/Young Families/Underserved — restore default selection), **weights encoded in URL** (shareable scenarios), **⎘ Copy Link** button, opportunity quadrant scatter (existing campus ZIPs ringed gold), top-10 sidebar with percentile + top-2 drivers, sortable ranked table with **percentile column** + campus highlighting (gold border), CSV export, coverage toggle. Footer link to `/admin/decisions`. |
| `/admin/decisions` | ✅ | Decision log: form to record a site decision (ZIP, name, notes — scenario URL auto-captured); history table with date/ZIP/score/notes/scenario link. Accessible at `/admin/decisions`. |
| `/admin/status` | ✅ | **Phase 5.4** Data refresh status: latest-per-job status cards (OK / N errors) + table of the last 50 `/api/refresh` and `/api/refresh-community` runs (when, job, status, summary counts, duration); failed rows expand to show error strings. Reads `/api/refresh-log`. Makes a failed/partial monthly refresh visible instead of silent. |
| `/methodology` | ✅ | Static data dictionary: every source (incl. Phase 4 LODES commute §5.4 / IRS SOI giving §5.5 / HUD address momentum §5.6 / Zillow ZHVI §5.7), SES scoring, YFI/WFI weights, Site Scorer signals (7 toggleable: 6 on by default + Distance) + normalization formulas, leading-indicators section, church saturation index, ASARB methodology, per-metric definitions, known limitations |
| `/zip/[zip]/print` | ✅ | Per-ZIP print one-pager: white-background document layout, 8 core stats, household/age/race breakdown, CDC PLACES health, employers, religious orgs — "Print / Save as PDF" button calls `window.print()`; linked from Demographics page ZIP selector |

### Data sources (all routed through Neon DB)
- **Census BPS (Building Permits Survey)** — county-level annual permit counts (SF + MF), 3 years. Loaded via `scripts/import-permits.ts` (automated). Shows on Demographics page as momentum badge. **Place-level** (city/municipality) permit counts also loaded via `scripts/import-bps-places.ts` from the Census South Region flat files (`so{YY}12y.txt`); 265–273 DFW places per year, 3 years (2023–2025), stored in `place_permits` table. Shows as horizontal bar list below Leading Indicators grid on Demographics page.
- **TEA PEIMS** — ISD district enrollment 2020-21→2024-25, county-aggregated. Loaded via `scripts/import-tea.ts` (manual download). Drives the **county-level fallback** for the Site Scorer enrollment signal + trend chart on Demographics.
- **NCES CCD school enrollment** — ZIP-level public-school enrollment (Phase 4.3). `scripts/import-school-enrollment.ts` pulls the NCES Common Core of Data school directory via the Urban Institute Education Data API (no key; `…/schools/ccd/directory/{year}/?fips=48`), keeps DFW-ZIP schools, and aggregates campus enrollment → `zip_school_enrollment` (per ZIP × year). The Site Scorer prefers this **ZIP-level enrollment CAGR** over the county TEA CAGR when present (finer grain — fixes the suburban/urban district blending), falling back to county then 0. Federal source, ~1–2yr lag, "membership" definition differs slightly from TEA. Re-run annually. **The Urban API Cloudflare-blocks some datacenter egress IPs — run the importer from a normal network.**
- **Texas Demographic Center Projections (Vintage 2024)** — county-level 2030/2040/2050 projections (mid scenario). Loaded via `scripts/import-tdc.ts` (manual download). Context panel on Demographics only.
- **Census ACS 5-Year (2024)** — per-ZIP: population, income, home value, race/ethnicity, education, household type, age distribution, income brackets, SES class score, fertility rate, dual-earner %, commute 30+ %, occupation mgmt/prof %, proxy_born (B05006 foreign-born from 20 Muslim-majority countries), proxy_language (C16001 Arabic speakers). **2020 baseline** (`population_2020`) uses Decennial 2020 DHC (`P1_001N`), not ACS — true point-in-time count on exact 2020 boundaries.
- **Census CBP 2022 (County Business Patterns)** — per-ZIP: total establishments, employment, payroll, sector breakdown (20 NAICS sectors, now includes emp+payroll per sector), employer size distribution. Also fetches county-level CBP for 4 DFW core counties (Dallas/Tarrant/Collin/Denton) to compute avg wages by sector. Loaded via `/api/refresh`
- **BLS LAUS** — DFW metro unemployment + labor force
- **FRED** — DFW metro population + housing permits
- **College Scorecard** — `/api/scorecard?zip=&radius=` direct API call (not cached); trade schools (iclevel=3) filtered from display
- **Census TIGERweb** — ZCTA polygon boundaries for Mapbox map (24hr server cache)
- **IRS BMF (NTEE X)** — DFW religious orgs from `eo_tx.csv`; 7,040 orgs loaded via `scripts/import-bmf.ts`. Refresh: re-run script (IRS publishes monthly)
- **2020 U.S. Religion Census (ASARB)** — county-level adherent counts by tradition (Evangelical/Mainline/Black Protestant, Catholic, Orthodox, Muslim, Jewish, Buddhist, Hindu, Other, Unclaimed) for 23 DFW counties. Static data in `data/religion-census-dfw.json`; loaded via `scripts/import-religion-census.ts`. Decennial data (next ~2030). Attribution required: "2020 U.S. Religion Census (ASARB) · County level · Adherent estimates"
- **CDC PLACES (2023)** — per-ZIP health rates: diabetes, obesity, smoking, uninsured, high BP, depression, mental distress, physical inactivity, poor general health. Loaded via `scripts/import-places.ts` (run annually). ZCTA-level dataset (`qnzd-25i4`) is still 2023 as of June 2026; county-level has a 2025 release but ZIP-level lags — re-check in late 2026.
- **CFPB Consumer Complaints** — per-ZIP complaint counts, trailing 36-month window per 1K residents. Auto-refreshed monthly via vercel.json cron (`GET /api/refresh-community`, 1st at 07:00 UTC).
- **IRS SOI ZIP-code data (TY2022)** — per-ZIP charitable giving + income from individual tax returns. `scripts/import-soi.ts` fetches `22zpallagi.csv` (one row per ZIP × 6 AGI brackets; no key), sums brackets per DFW ZIP → `zip_income_soi`. Drives the Giving Capacity panel on Demographics (avg charitable gift per giving return, charitable % of AGI, itemizer rate). Annual vintage. Context tier — see 4.4 caveat about TCJA itemizer skew.
- **HUD Aggregated USPS Address Vacancies** — quarterly active residential address counts per ZIP (growth momentum ahead of ACS lag). **[HUMAN]-gated:** licensed gov/nonprofit dataset, manual quarterly download (not an API; the free crosswalk API returns ratios only). `scripts/import-hud-usps.ts` loads `data/hud-usps-YYYYqQ.csv` → `usps_addresses`. Awaiting first data load (Jolie registers + downloads). Context tier.
- **LEHD LODES8 (2023)** — origin-destination worker commute flows. `scripts/import-lodes.ts` streams the Texas `od_main_JT00_2023` file (~12M block-pair rows) + the LODES8 geography crosswalk (`tx_xwalk`, which ships a block→ZCTA column), keeps intra-DFW flows, aggregates to home-ZIP→work-ZIP, and stores top-15 corridors + per-home summary (totals, self-containment, job-weighted net bearing). Also writes `data/dfw-zip-centroids.json` from crosswalk block centroids. Annual vintage (released ~Dec). Context tier only — not a Site Scorer input. Shows as Commute Corridors panel on Demographics page.
- **Zillow ZHVI** — ZIP-level typical home value (Phase 4.7). `scripts/import-zillow.ts` streams the public ZIP CSV (`Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` from files.zillowstatic.com — no key) via csv-parse (the Metro field has embedded commas, so `line.split` is unsafe), filters to DFW ZIPs, and stores the latest monthly value + YoY % + a trailing-13-month series → `zip_home_values`. All-homes 35th–65th-pctile tier (SFR+condo), smoothed/seasonally adjusted. 337/370 DFW ZIPs (Zillow suppresses low-transaction ZIPs), latest 2026-05. Monthly vintage. Context tier (display only) — fresher than ACS's lagged self-reported B25077; shows as Home Value Trend panel on Demographics page. Never scored (home value already enters scoring via the ACS-based SES composite).

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
  /api/overview?coverage=      ← aggregates all ZIPs + computes weighted averages; ?coverage=core|all (default core). Computed payload cached per coverage via unstable_cache (tag 'overview', 24h backstop); /api/refresh busts it with revalidateTag(OVERVIEW_TAG, {expire:0})
  /api/religious               ← DFW overview stats (incl. saturation + county comparison) + per-ZIP orgs
  /api/religious/adherence     ← 2020 Religion Census county adherence by tradition (23 counties) + core MSA summary
  /api/religious/proxy?coverage= ← per-ZIP Muslim community proxy: proxy_born + proxy_language ranked list
  /api/site-scorer?coverage=   ← per-ZIP: church saturation + YFI + WFI + SES + growth; joins zip_demographics + religious_orgs
  /api/ses-classes?coverage=   ← all ZIPs sorted by SES score with tier counts; ?coverage=core|all
  /api/employers?zip=          ← CBP employer data (overview or per-ZIP)
  /api/community-needs?coverage=&zip= ← CDC PLACES + CFPB health data; ?coverage=core|all for overview mode
  /api/scorecard?zip=&radius=  ← College Scorecard (direct, not cached in Neon)
  /api/boundaries              ← ZCTA polygon GeoJSON from TIGERweb (24hr cache)
  /api/attendee-density        ← GET: privacy-masked counts + penetrationPct + attendeesPer1kUnclaimed + primaryCampus + lastUpload metadata (joins zip_demographics + religious_adherence); POST: csv-parse CSV upload with DFW-only filter + skip report; DELETE: truncate
  /api/isochrone               ← Mapbox Isochrone API proxy; ?lng=&lat=&minutes=&profile= (6hr in-memory cache)
  /api/decisions               ← GET: list decision log entries (100 most recent); POST: create entry {zip, area, fitScore, scenarioUrl, notes, decidedBy}
  /api/refresh-log             ← GET: last 50 data-refresh run outcomes from refresh_log (Phase 5.4; powers /admin/status)
  /api/commute?zip=            ← LODES8 commute corridors: top work-destination ZIPs + self-containment % + net commute bearing/direction + high-earner share (joins commute_flows + commute_summary)
  /api/address-momentum?zip=   ← HUD USPS active-residential-address momentum: latest count + trailing-4Q % change + quarterly series (reads usps_addresses; available:false until HUD data loaded)
  /api/giving?zip=             ← IRS SOI giving capacity: avg gift/giving return + charitable % of AGI + itemizer rate + avg AGI (reads zip_income_soi; available:false for IRS-suppressed ZIPs)
  /api/home-values?zip=        ← Zillow ZHVI: typical home value + YoY % + trailing-13-month series (reads zip_home_values; available:false for low-transaction ZIPs)
  /api/school-enrollment?zip=  ← NCES CCD ZIP-level enrollment: per-year series + campus count + CAGR % + CAGR score (reads zip_school_enrollment; available:false until importer run)
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

**`place_permits`** — one row per census place per year, loaded via `scripts/import-bps-places.ts`
Columns: `state_fips` (TEXT), `place_fips` (TEXT), `place_name` (TEXT), `county_fips` (TEXT), `county` (TEXT), `year` (INT), `sf_permits` (INT), `mf_permits` (INT), `total_permits` (INT), `updated_at`
PK: `(state_fips, place_fips, year)`. Index on `(county, year)`. 265–273 DFW places per year, 3 years (2023–2025). Source: Census BPS South Region `so{YY}12y.txt`.

**`isd_enrollment`** — one row per ISD per year, loaded via `scripts/import-tea.ts`
Columns: `district_id` (TEXT), `district_name` (TEXT), `county` (TEXT — matches ZIP_COUNTY values), `year` (INT), `enrollment` (INT), `updated_at`
PK: `(district_id, year)`. Index on `county`. 5 years of data (2020–2024).

**`county_projections`** — one row per county, loaded via `scripts/import-tdc.ts`
Columns: `fips` (PK), `county` (TEXT), `base_2020`, `proj_2025`, `proj_2030`, `proj_2035`, `proj_2040`, `proj_2050` (all INT), `updated_at`
TDC Vintage 2024, mid-migration scenario, 23 DFW counties.

**`decision_log`** — one row per logged site decision, written via `/admin/decisions`
Columns: `id` (SERIAL PK), `zip` (TEXT NOT NULL), `area` (TEXT), `fit_score` (INT), `scenario_url` (TEXT), `notes` (TEXT), `decided_by` (TEXT), `logged_at` (TIMESTAMPTZ DEFAULT NOW())

**`refresh_log`** — one row per data-refresh run, written by `recordRefreshRun` at the end of `/api/refresh` + `/api/refresh-community` (Phase 5.4)
Columns: `id` (SERIAL PK), `job` (TEXT — `refresh` | `refresh-community`), `ok` (BOOLEAN), `duration_ms` (INT), `summary` (JSONB — e.g. `{zipsRefreshed, employersRefreshed}` or `{complaintsRefreshed}`), `error_count` (INT), `errors` (JSONB — string[], capped at 50), `logged_at` (TIMESTAMPTZ DEFAULT NOW())
Read by `/admin/status`. Logging never throws into the refresh itself. If `REFRESH_ALERT_WEBHOOK` is set, a failed run also POSTs a `{text}` alert (Slack-compatible); unset = no-op.

**`commute_flows`** — top work-destination corridors per home ZIP, loaded via `scripts/import-lodes.ts`
Columns: `home_zip` (TEXT), `work_zip` (TEXT), `jobs` (INT), `high_earner_jobs` (INT — SE03, >$40k/yr), `year` (INT), `updated_at`
PK: `(home_zip, work_zip, year)`. Index on `(home_zip, year)`. Stores top-15 external destinations per home ZIP (self-flow excluded). 5,497 rows (369 home ZIPs × ≤15), year 2023.

**`zip_income_soi`** — one row per ZIP per year, loaded via `scripts/import-soi.ts` (Phase 4.4)
Columns: `zip` (TEXT), `year` (INT), `total_returns` (INT), `agi_total` (BIGINT — $1000s), `itemizing_returns` (INT — N04470), `charitable_returns` (INT — N19700), `charitable_amount` (BIGINT — A19700, $1000s), `updated_at`
PK: `(zip, year)`. TY2022, 344 DFW ZIPs (IRS suppresses small ZIPs). Amounts summed across the 6 AGI brackets in `22zpallagi.csv`. Counts rounded to nearest 10 by IRS.

**`zip_home_values`** — one row per ZIP (latest monthly snapshot), loaded via `scripts/import-zillow.ts` (Phase 4.7)
Columns: `zip` (TEXT PK), `latest_month` (TEXT — `YYYY-MM`), `zhvi` (INT — typical home value, whole dollars), `zhvi_yoy` (NUMERIC(6,1) — % change vs 12 months prior, nullable), `series` (JSONB — trailing up-to-13 months `[{month:'YYYY-MM', value}]` for sparkline), `updated_at`
Zillow ZHVI all-homes 35th–65th-pctile tier (SFR+condo), smoothed/seasonally-adjusted. 337/370 DFW ZIPs. Re-load monthly (full table DELETE + reinsert).

**`zip_school_enrollment`** — one row per (ZIP, year), loaded via `scripts/import-school-enrollment.ts` (Phase 4.3)
Columns: `zip` (TEXT), `year` (INT), `enrollment` (INT — sum of CCD-listed public schools in the ZIP), `campus_count` (INT), `updated_at`. PK `(zip, year)`.
NCES CCD via Urban Institute API. Drives the Site Scorer's ZIP-level enrollment CAGR (preferred over county TEA CAGR). Re-load annually (full table TRUNCATE + reinsert). Empty until the importer is run → scorer falls back to county.

**`usps_addresses`** — one row per ZIP per quarter, loaded via `scripts/import-hud-usps.ts` (Phase 4.1, awaiting first data load)
Columns: `zip` (TEXT), `quarter` (TEXT — e.g. `2026Q1`), `res_active` (INT — active residential addresses, the spec's core field), `res_total` / `res_vacant` / `res_nostat` (INT, nullable — stored when the file provides them; active = total − vacant − no-stat), `updated_at`
PK: `(zip, quarter)`. Source: HUD Aggregated USPS Administrative Data on Address Vacancies (licensed, gov/nonprofit-only manual download).

**`commute_summary`** — per-home-ZIP commute headline metrics (computed over the FULL OD set, not just stored corridors), loaded via `scripts/import-lodes.ts`
Columns: `home_zip` (TEXT), `year` (INT), `total_workers` (INT), `work_in_zip` (INT — self-containment numerator), `top_dest_zip` (TEXT), `net_bearing_deg` (NUMERIC(5,1) — job-weighted bearing, 0=N/90=E), `direction_label` (TEXT — compass N/NE/…), `concentration` (NUMERIC(4,3) — 0–1 directionality of the commute), `updated_at`
PK: `(home_zip, year)`. 369 rows, year 2023.

## SES class scoring
Composite 0–100 score: income (50%) + bachelor's rate (30%) + home value (20%)
- Upper: 78–100 · Upper Middle: 58–77 · Middle: 40–57 · Lower Middle: 25–39 · Lower Income: 0–24

## Scoring math (single source of truth: `src/lib/scoring.ts`)
All decision-bearing formulas — SES composite + label, YFI/WFI, the Site Scorer component transforms (growth/saturation/distance/enrollment-CAGR), `effectivePct` weight normalization, `computeFitScore` (incl. null-growth/null-distance weight redistribution), and `weightedMean` — are pure functions in `src/lib/scoring.ts`. Production imports them (`lib/census.ts` for SES; `api/site-scorer` for YFI/WFI/enrollment; `site-scorer/page.tsx` for the Fit Score family; `api/overview` for weighted aggregates) so the unit-tested math IS the production math — no forked copies. **Tests:** `src/lib/scoring.test.ts` (Vitest, 22 hand-computed fixtures) — run `npm test`. Tests pin current behavior: SES uses **absolute caps** (not percentiles) and YFI uses the **0–17** band (the open [HUMAN] reconciliation in spec §1.5 — if that decision changes the model, update scoring.ts + these fixtures together).

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

### Campus circle color palette
```ts
// src/app/page.tsx — CAMPUS_PALETTE
// Avoids #4EAEFF (map Growing), #2DD4BF (map Rapid Growth), #FF6B6B (map Declining)
// Colors assigned alphabetically by campus name for render consistency
const CAMPUS_PALETTE = ['#E8B84B','#FB923C','#A78BFA','#F472B6','#FACC15','#E879F9','#FCD34D','#4ADE80']
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
<button onClick={() => setRefreshKey(k => k + 1)} ...>↺ Reload</button>
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
npm test              # Vitest — scoring formula unit tests (src/lib/scoring.test.ts)
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
- **CFPB complaints** — monthly (trailing 36-month window; runs automatically via vercel.json cron on the 1st at 07:00 UTC)
- **CDC PLACES** — annually (releases once/year)
- **IRS BMF** — monthly (IRS publishes updates monthly)
- **Census BPS county** — annually after May release: `npx tsx scripts/import-permits.ts`
- **Census BPS place-level** — annually after May release: `npx tsx scripts/import-bps-places.ts` (auto-fetches South Region flat files; no manual download needed)
- **TEA PEIMS** — annually after ~March release: download CSVs from TEA, then `npx tsx scripts/import-tea.ts`
- **TDC Projections** — every ~2 years on new vintage: download from demographics.texas.gov/Projections/, then `npx tsx scripts/import-tdc.ts`
- **LEHD LODES8 commute** — annually after the ~December release: `npx tsx scripts/import-lodes.ts` (auto-fetches TX OD + crosswalk gz; bump `YEAR` in the script when a newer vintage lands)
- **Zillow ZHVI** — monthly (Zillow updates ~mid-month): `npx tsx scripts/import-zillow.ts` (streams the public ZIP CSV; DELETE + reinsert the full `zip_home_values` table each run)
- **NCES CCD school enrollment** — annually (CCD lags ~1–2yr): `npx tsx scripts/import-school-enrollment.ts` (Urban Institute API, no key; TRUNCATE + reinsert `zip_school_enrollment`). Run from a normal network — the API Cloudflare-blocks some datacenter IPs

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
src/lib/scoring.ts                     — Pure scoring math (SES, YFI/WFI, Site Scorer transforms, effectivePct, computeFitScore, weightedMean); imported by census.ts + site-scorer route/page + overview route. No DB/Next/React imports — unit-testable in isolation
src/lib/scoring.test.ts                — Vitest suite: 22 hand-computed fixtures covering every scoring.ts formula incl. null-growth redistribution + threshold boundaries. Run `npm test`
src/lib/campuses.ts                    — All 10 campus locations with lat/lng + status (existing|soon); used for map markers + isochrone fetch
src/components/TopNav.tsx              — Shared nav; renders <CoverageNav /> (do NOT also render in page files)
src/components/CoverageNav.tsx         — Suspense-wrapped nav links; preserves ?coverage=all param across page transitions
src/components/MapboxChoropleth.tsx    — Mapbox choropleth map. Key props: zipData, campuses, attendeeData/showAttendees, campusColorMap, activeCampuses (Set<string>|null — filters which campus circles render), isochroneGeoJson (merged display), candidateIsochrone (candidate-only, used for cannibalization), candidatePin, onMapClick, onCannibalizationResult. AttendeeZip type: zip, households, censusHH, penetrationPct, county, attendeesPer1kUnclaimed, campusBreakdown, primaryCampus. ZCTA centroids cached in zctaCentroidsRef during map.on('load') for O(1) point-in-polygon lookups. Hover popup = quick summary; click popup = full campus breakdown (persistent, close button). Ray-casting `inIsochrone()` helper computes cannibalization count when candidateIsochrone changes.
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
src/app/api/refresh-community/route.ts — CFPB complaint refresh; GET handler for vercel.json cron (1st of month), POST for manual trigger; maxDuration = 300
src/app/api/overview/route.ts          — Aggregates all ZIPs for Overview page. computeOverview() wrapped in unstable_cache (per coverage, tag OVERVIEW_TAG, revalidate 24h); GET normalizes coverage to core|all. Cache busted by /api/refresh via revalidateTag
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
src/app/admin/attendee-upload/page.tsx — Rock RMS upload UI: format docs, privacy callout, source date picker, file upload; result shows skip breakdown (online/outOfCoverage/invalidZip/invalidCount)
src/app/admin/decisions/page.tsx       — Site decision log: form (ZIP, name, notes) + history table; auto-captures scenario URL from current Site Scorer state
src/app/api/decisions/route.ts         — GET (last 100 decisions DESC) + POST (insert; validates 5-digit ZIP)
src/lib/refresh-log.ts                 — recordRefreshRun({job, ok, durationMs, summary, errors}); writes refresh_log + optional REFRESH_ALERT_WEBHOOK alert on failure. Never throws into the caller (Phase 5.4)
src/app/api/refresh-log/route.ts       — GET (last 50 refresh runs DESC) for /admin/status
src/app/admin/status/page.tsx          — Refresh status dashboard: latest-per-job cards + 50-run table w/ expandable error rows
src/app/admin/layout.tsx               — Passthrough layout for /admin/* routes; middleware handles auth
src/middleware.ts                      — Site-wide Basic auth (BASIC_AUTH_USER/BASIC_AUTH_PASS) + Bearer CRON_SECRET for automation; noindex via next.config.ts headers
scripts/import-bmf.ts                  — IRS BMF loader (re-run monthly; IRS publishes monthly)
scripts/import-places.ts               — CDC PLACES loader (re-run annually)
scripts/import-religion-census.ts      — 2020 ASARB Religion Census loader (decennial; re-run only on new release ~2030)
data/religion-census-dfw.json          — Static processed county adherence data (23 DFW counties, extracted from ASARB Excel)
scripts/import-permits.ts              — Census BPS county annual permits loader (automated; re-run annually after May release)
scripts/import-tea.ts                  — TEA PEIMS enrollment loader (manual download; re-run annually; expects data/tea-enrollment-{YYYY}.csv)
scripts/import-tdc.ts                  — TDC county projections loader (manual download; re-run on new vintage; expects data/tdc-projections-2024.csv)
src/app/api/leading-indicators/route.ts — GET /api/leading-indicators?zip= — returns permits + enrollment + projection + placesPermits (top-10 cities by total permits with YoY%) for a ZIP's county
scripts/import-bps-places.ts          — Census BPS place-level loader; fetches South Region so{YY}12y.txt for 2023–2025, filters DFW counties, upserts to place_permits (re-run annually)
scripts/import-lodes.ts               — LEHD LODES8 commute loader; streams TX od_main + xwalk (gz), aggregates block→ZCTA intra-DFW flows, writes commute_flows + commute_summary + data/dfw-zip-centroids.json. Caches source gz in data/lodes-*.csv.gz (gitignored). DRY_RUN=1 to preview. Re-run annually
src/app/api/commute/route.ts          — GET /api/commute?zip= — top work-destination corridors + self-containment % + net commute bearing/direction + high-earner share for a home ZIP
scripts/import-soi.ts                  — IRS SOI ZIP income loader (Phase 4.4); fetches 22zpallagi.csv (local cache data/soi-zpallagi-2022.csv, gitignored ~200MB), sums 6 AGI brackets per DFW ZIP, upserts zip_income_soi. DRY_RUN=1 to preview. Re-run annually
src/app/api/giving/route.ts            — GET /api/giving?zip= — giving capacity metrics (avg gift/giving return, charitable % of AGI, itemizer rate) from zip_income_soi
scripts/import-zillow.ts               — Zillow ZHVI loader (Phase 4.7); streams the public ZIP CSV via csv-parse (Metro field has embedded commas), filters to DFW, stores latest monthly value + YoY + trailing-13-month series in zip_home_values. DRY_RUN=1 to preview. Re-run monthly. Optional local cache data/zillow-zhvi-zip.csv (gitignored ~120MB)
scripts/import-school-enrollment.ts    — NCES CCD ZIP enrollment loader (Phase 4.3); pages the Urban Institute CCD directory API for TX (fips=48), aggregates campus enrollment to DFW ZIPs, writes zip_school_enrollment. Self-verifying (prints first-record keys, stops if enrollment/zip_location missing). DRY_RUN=1 to preview. Run from a normal network (API Cloudflare-blocks some datacenter IPs). Re-run annually
src/app/api/school-enrollment/route.ts — GET /api/school-enrollment?zip= — per-year enrollment series + campus count + CAGR %/score from zip_school_enrollment
src/app/api/home-values/route.ts       — GET /api/home-values?zip= — Zillow ZHVI typical home value + YoY % + trailing series from zip_home_values
scripts/import-hud-usps.ts             — HUD USPS address-vacancy loader (Phase 4.1; [HUMAN]-gated manual download). Reads data/hud-usps-YYYYqQ.csv, self-verifies headers (prints actual columns + stops if FIELD_CANDIDATES mapping fails), derives active = total−vacant−nostat, upserts usps_addresses. Re-run quarterly
src/app/api/address-momentum/route.ts  — GET /api/address-momentum?zip= — active residential address count + trailing-4Q % change + quarterly series (available:false until HUD data loaded)
data/dfw-zip-centroids.json           — ZIP→[lng,lat] centroids derived from LODES crosswalk block points (committed asset). Net commute bearings are precomputed in import-lodes.ts and stored in commute_summary; this file is the reusable centroid source for future distance-to-campus scoring (3.4)
scripts/find-missing-zips.ts           — Census Gazetteer-based ZIP radius discovery tool
scripts/label-missing-zips.ts          — Fetches city names for unlabeled ZIPs via zippopotam.us
README.md                              — Full operator runbook: local setup, env vars, all data refresh cadences, attendee upload procedure (Rock RMS columns, admin page URL, skip report), DB-only policy, environment/DB mapping, reset procedure, DB migration pattern
```

## Slash commands
- `/ship` — stage modified files, commit, push to origin main (triggers Vercel deploy)
- `/doc` — review key files and update this CLAUDE.md to reflect current state

## Enhancement roadmap

> **⏳ Open follow-up to resume:** Phase 4.1 (HUD USPS address momentum) is fully scaffolded but **blocked on the church EIN** needed for HUD nonprofit registration (as of 2026-06-16). When the EIN arrives, finish the registration + data load — see the 4.1 entry under "Spec v2 Phase 4" below for the exact steps.

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
  - **0.6** ✅ — Attendee data: diagnosed (2,893 rows of non-DFW test data in prod DB, source 2026-06-12); fixed GET auth bug (route was requiring Bearer, blocking browser map load); added `attendee_upload_log` table + upload status to admin page (last upload date/ZIPs/HH + Truncate button) and map toggle tooltip; admin routes re-enabled (removed `notFound()` from admin/layout.tsx). Bad data truncated and `FamilyCountByCampusAndPostalCode_20260611.csv` re-uploaded via admin page ✅
- **Spec v2 Phase 1** — Data integrity
  - **1.1** ✅ — Growth metric fixed: 2020 base swapped to Decennial DHC (`P1_001N`); `BOUNDARY_CHANGED` set nulls 7 split ZIPs; Site Scorer redistributes null-growth weight; tooltip + Demographics sub-label explain unavailability
  - **1.2** ✅ — Reliability flags: `hhi_moe` + `low_reliability` columns added to DB and refresh; SES Classes table hides unreliable ZIPs by default (⚠ toggle to show greyed); Site Scorer always excludes them
  - **1.3** ✅ — CFPB trailing 36-month window per 1K residents; methodology + page labels updated; now runs via cron (see 0.5)
  - **1.4** ✅ — ACS bumped to 2024 5-year (verified: all variables present including C16001_033E, B05006 proxy, HHI MOE); CDC PLACES ZCTA still 2023 (ZCTA-level `qnzd-25i4` dataset lags county release — re-check late 2026)
  - **1.5** ⏳ [HUMAN] — Reconcile SES model: docs say percentile/6-class; code uses absolute/5-class. Recommend keeping absolute thresholds.
- **Spec v2 Phase 2** — Attendee layer activation
  - **2.1** ✅ — Robust CSV parsing: csv-parse/sync replaces line.split; Church Online + non-DFW ZIPs filtered; skip report returned in POST response and shown in admin UI
  - **2.2 core** ✅ — Penetration metrics: GET joins zip_demographics (census HH) + religious_adherence (county unclaimed) to add penetrationPct, attendeesPer1kUnclaimed, primaryCampus. Map circles colored by primary campus (warm palette). Hover + click popups. Campus Draw Areas panel on Overview page.
  - **2.2 extended** ✅ — Campus draw areas as map filter toggle (click row to isolate campus circles on map; "Show all" reset), underserved clusters table (growing ZIPs with low penetration ranked by growth÷penetration), cannibalization check (existing attendee HH within candidate pin's isochrone shown in isochrone bar)
  - **2.3** ✅ — Upload runbook in README: Rock RMS export procedure, expected columns, upload steps, privacy rules, DB-only policy, environment/DB mapping, reset procedure
- **Spec v2 Phase 3** ✅ — Executive decision layer: shareable scenario URLs (weights encoded in URL, Copy Link button), score percentile anchoring (top X% in sidebar + table), top-3 insights panel on Overview page (fit score + top drivers), distance-to-campus signal (✅ now wired — straight-line haversine to nearest existing campus, default off, see §Lakepointe Fit Score), Vercel Analytics (`@vercel/analytics/next` in root layout), preset weights (Balanced/Young Families/Underserved), campus highlights on scatter + table, decision log (`decision_log` table + `/api/decisions` + `/admin/decisions`)
- **Spec v2 Phase 4** — New data sources (in progress):
  - **4.2** ✅ — Census BPS place-level permits: `place_permits` table, `scripts/import-bps-places.ts`, top-cities bar list on Demographics page Leading Indicators panel. 805 rows (265–273 DFW places × 3 years). Breaks "Collin County" into Celina vs. Anna vs. Melissa etc.
  - **4.1** 🟡 [HUMAN] — HUD–USPS address momentum (quarterly active residential address counts; freshest growth signal). **Scaffold built, awaiting data:** `usps_addresses` table, `/api/address-momentum?zip=`, Address Momentum panel on Demographics (renders only when loaded), `scripts/import-hud-usps.ts` (self-verifying parser — prints actual headers + stops if column mapping doesn't match, so it's finalized against the real file in one edit). **Blocked on [HUMAN]:** the counts come from HUD's *Aggregated USPS Administrative Data on Address Vacancies* (gov/nonprofit-only, license agreement, manual quarterly download — NOT the free crosswalk API, which returns ratios only). Jolie registers at huduser.gov/portal/datasets/usps.html, downloads 5+ recent quarters at ZIP level → `data/hud-usps-YYYYqQ.csv` (gitignored), then `npx tsx scripts/import-hud-usps.ts`. Context tier (not scored until validated against known-growth ZIPs).
    - ⏳ **BLOCKED on EIN (as of 2026-06-16):** HUD nonprofit registration needs the church's EIN, which Jolie is waiting on. **← RESUME HERE once the EIN arrives:** do the HUD registration, download the quarterly ZIP-level files, run the importer (paste its header dump back to Claude if the column mapping needs finalizing), then validate that Celina/Princeton/Forney light up before considering it for scoring. Everything else for 4.1 is already built.
  - **4.3** 🟡 (code shipped; **data load deferred** — Urban API blocked) — ZIP-level school enrollment: `zip_school_enrollment` table, `scripts/import-school-enrollment.ts`, `/api/school-enrollment?zip=`. Site Scorer **prefers ZIP-level enrollment CAGR over county TEA CAGR** when the table is populated (`enrollmentSource` field shows which was used), fixing suburban/urban district blending. **Blocked (2026-06-17):** the Urban Institute API is behind a Cloudflare JS challenge that returns 403 to any script (datacenter *and* residential) — importer is non-functional as-is. Table stays empty → scorer falls back to county CAGR (no breakage). **Revisit:** rework the importer to read a local NCES ELSI CSV (School Name + Location ZIP + Total Students for TX, multi-year, one file) — see the header comment in `scripts/import-school-enrollment.ts`. Deferred per [HUMAN] (Jolie).
  - **4.4** ✅ — IRS SOI ZIP-level income (giving capacity): `zip_income_soi` table, `scripts/import-soi.ts` (fetches `22zpallagi.csv`, sums the 6 AGI brackets per DFW ZIP), `/api/giving?zip=`, Giving Capacity panel on Demographics (avg gift per giving return, charitable % of AGI, itemizer rate). TY2022, 344 of 370 DFW ZIPs (rest IRS-suppressed). **Methodology caveat baked in:** post-TCJA only ~10% itemize, so charitable deductions skew to higher-income filers and undercount giving — labeled a *relative* signal, paired with the itemizer rate. Currently **context tier (display only)**; wiring it into the Site Scorer as a "generosity/capacity" weight is a separate [HUMAN] decision (see note below).
  - **4.5** ✅ — LEHD LODES8 commute corridors: `commute_flows` + `commute_summary` tables, `scripts/import-lodes.ts` (streams TX `od_main_JT00_2023` + `tx_xwalk`, aggregates block→ZCTA), `/api/commute?zip=`, Commute Corridors panel on Demographics page. Per home ZIP: top work-destination ZIPs, self-containment %, job-weighted net commute bearing/compass direction + concentration, and high-earner (SE03, >$40k/yr) share per corridor. LODES8 ships a block→ZCTA crosswalk (no hand-built crosswalk needed); also derives `data/dfw-zip-centroids.json` (committed; reusable for 3.4 distance-to-campus). 5,497 corridor rows / 369 home ZIPs, year 2023. Context tier (not scored).
  - **4.6** ⏳ — IRS SOI county-to-county migration (AGI bands); context/narrative tier
  - **4.7** ✅ — Zillow ZHVI ZIP-level home values: `zip_home_values` table, `scripts/import-zillow.ts` (streams the public ZIP CSV via csv-parse — the Metro field has embedded commas, so `line.split` is unsafe; keeps latest monthly value + YoY + trailing-13-month series), `/api/home-values?zip=`, Home Value Trend panel on Demographics (typical value, YoY badge, sparkline). All-homes 35th–65th-pctile tier (SFR+condo), smoothed/seasonally-adjusted. 337/370 DFW ZIPs (Zillow suppresses low-transaction ZIPs), latest 2026-05. Monthly vintage. **Context tier (display only)** — never scored; home value already enters scoring via the ACS-based SES composite, so adding ZHVI would re-count it.
  - **4.8** ⏳ — Google Places church search; on-demand only, not bulk
- **Spec v2 Phase 5** — Code health (ongoing, interleave):
  - **5.1** ✅ — Scoring unit tests: all decision-bearing formulas extracted to `src/lib/scoring.ts` (pure, no DB/Next/React), production wired to import them (census.ts/site-scorer route+page/overview) so tested math = production math. `src/lib/scoring.test.ts` — Vitest, 22 hand-computed fixtures. `npm test`. Behavior-preserving (tsc + build clean). Tests pin current SES absolute-caps + YFI 0–17 behavior (see §1.5 [HUMAN]). See "Scoring math" section above.
  - **5.2** 🟡 — Shared component library: `src/lib/theme.ts` (tokens — `colors`/`fonts`/`rgbMap`/`toRgb`/`CARD_BG`/`cardGlow`) + `src/components/ui/` (`StatCard` w/ `compact` variant = hex-`color`/colored-value family; `StatCardAccent` = named-`accent`/top-bar/white-value/`tooltip` family; `Surface`; `SectionHeader` = small mono panel label+sub; `SectionTitle` = gold-left-border eyebrow+Bebas title). **Migrated:** community-needs, employers, ses-classes (Family-B `StatCard`+`Surface`+`SectionHeader`); Overview/`page.tsx`, compare, demographics (Family-A `StatCardAccent as StatCard` + `SectionTitle as SectionHeader`, alias-imported to keep call sites). All behavior-preserving (tsc + build clean, pages still prerender static). Their `CARD_SURFACE`-const panels are now `<Surface>` too (Overview, compare, demographics — `CARD_SURFACE` const deleted from all three). **Remaining:** `religious` keeps its bespoke card (flex sizing, `borderRadius:10`, raw-`rgb`, `unit` suffix — intentionally not forced into the shared component); demographics' Phase-4/5 panels (Leading Indicators, Commute, Address Momentum, Giving, Home Value) use **inline** gradient strings (not the `CARD_SURFACE` const) and weren't swept in this pass; `<DataTable>` not extracted (per-page tables diverge — sort keys, color thresholds, sticky headers). Incremental, verify rendering after each.
  - **5.3** ✅ — Cache `/api/overview`: the `SELECT *` + JS-reduce is wrapped in `unstable_cache` (Next data cache, per coverage, tag `OVERVIEW_TAG`, 24h backstop revalidate) so it no longer re-queries + re-reduces every request. `/api/refresh` calls `revalidateTag(OVERVIEW_TAG, {expire:0})` so a data load is reflected immediately. Cache Components not enabled → used `unstable_cache` (the non-`use cache` path).
  - **5.4** ✅ — Error monitoring (dependency-free slice): `refresh_log` table + `recordRefreshRun` (`src/lib/refresh-log.ts`) wired into both refresh routes, `/api/refresh-log`, and the `/admin/status` dashboard — a failed/partial monthly refresh is now visible instead of silent. Optional push alerts via `REFRESH_ALERT_WEBHOOK` (Slack-compatible; no-op if unset). Logging never breaks the refresh. **Follow-up (not done):** full runtime error capture (Sentry `@sentry/nextjs`) needs a [HUMAN] DSN — layer on later for broad error tracking beyond the refresh jobs.
  - **5.5** ✅ — Real README (operator runbook; done under Phase 2.3)
  - **Governance reframe** (spec Appendix A): source throughput is gated by *tier*, not a flat monthly quota — context-tier sources add freely during build-out if they clear admission gates; scored signals ≤1/quarter behind tests + ~8-cap + no-double-count + [HUMAN]; ~1/month for everything post-launch. Build order: 5.1 (done) → 5.4 → 4.3 (scored, behind tests), context sources (4.6, 4.1-when-unblocked) interleaved.

## Planned next data sources (ordered by priority)
These are the next APIs to wire in, from Paul's Technical Specification v1.1 (April 2026).

### High — free, no new keys needed
| Source | What it unlocks | Notes |
|---|---|---|
| ~~**YFI (Young Family Index)**~~ | ✅ **Done** | Live in Site Scorer; computed from ACS columns already in DB |
| ~~**WFI (Working Family Index)**~~ | ✅ **Done** | Live in Site Scorer; computed from ACS columns already in DB |
| ~~**BLS QCEW**~~ | ✅ **Done via CBP county-level** | Avg wage by sector now computed from Census CBP county data for 4 DFW counties (Dallas/Tarrant/Collin/Denton); stored in `metro_stats.sector_wages` |
| ~~**IRS SOI**~~ | ✅ **Done (4.4)** — context tier on Demographics | Scorer integration (generosity weight) pending [HUMAN] sign-off |

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
- Default weights: YFI 23% · WFI 23% · SES 18% · Population Growth 14% · Church Saturation Opportunity 12% · **School Enrollment Growth 10%** · Distance **off by default** (straight-line, weight 10 when enabled)
- User-adjustable via toggle pills + per-signal sliders (6 demand/supply signals on by default + Distance off); 3 presets (Balanced / Young Families / Underserved); Normalize button snaps enabled signals to 100%; Copy Link encodes current weights + signal selection into the URL for sharing; all weights documented at `/methodology#site-scorer`
- Church Saturation Opportunity = 100 − min(100, churches/10K / 30 × 100) — inverts BMF Christian org density so low saturation = high score
- School Enrollment Growth = enrollment CAGR × 12, capped 0–100. **Prefers ZIP-level CAGR (NCES CCD, Phase 4.3)** when the ZIP has school data; falls back to county ISD CAGR (TEA PEIMS), then 0. Shows "—"/0 until at least one source is loaded (graceful degradation)
- Distance signal ✅ wired (straight-line): `/api/site-scorer` computes haversine miles from each ZIP centroid (`data/dfw-zip-centroids.json`) to the nearest existing campus (`CAMPUSES`, status=existing); `distanceScore(mi) = min(100, mi/30 × 100)` (farther = more open = higher). Defaults **off** (toggle pill); auto-sets weight 10 on first enable. Drive-time (isochrone) distance is the future upgrade.
- **Null growth handling**: ZIPs with `populationGrowth = null` (ZCTA boundary splits or missing 2020 data) have their growth weight redistributed proportionally across the other 5 active components — they are not penalized with a 0. Growth column shows "—" with hover tooltip.
- **Percentile anchoring**: each ZIP's rank / total shown as "top X%" in the top-10 sidebar and ranked table
- **Campus highlights**: existing campus ZIPs get a gold ring on the scatter chart and a gold left-border row in the ranked table
- **Decision log link** in footer → `/admin/decisions`

## Notion tracker
Full task tracker (ordered by priority): https://www.notion.so/e94e55e73b55430bb9646e37600e4998

## Deployed
- **Production**: https://community-demographic-tool.vercel.app
- **GitHub**: https://github.com/Lakepointe-Church/community-demographic-tool
- **Vercel project**: `community-demographic-tool` under `plafatas-projects`
- **Neon DB**: `community-demographic-tool` integration on Vercel
