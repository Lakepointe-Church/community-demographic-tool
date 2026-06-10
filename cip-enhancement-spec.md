# Community Intelligence Platform — Enhancement Spec

**Project:** `community-demographic-tool` (Next.js, Vercel, Mapbox GL JS)
**Purpose:** Help Lakepointe leadership evaluate areas for potential new campuses.
**Existing API routes:** `/api/census`, `/api/bls`, `/api/fred`
**Existing pages:** Overview, Demographics, SES Classes, Compare, Religious, Employers, Comm. Needs, Site Scorer
**Brand:** Lakepointe gold `#E8B84B` on dark (`#0d0f14`), Bebas Neue / IBM Plex Mono / IBM Plex Sans
**Date:** June 2026

> **How to read this spec:** Work is ordered in phases by priority. Each data source has a verification status: ✅ VERIFIED (confirmed June 2026), ⚠️ VERIFY (believed correct, confirm exact endpoint/format before building). Do not invent endpoints — if a source's API differs from what's described here, stop and flag it rather than guessing.

---

## Phase 0 — Fixes (do first)

### 0.1 Site Scorer 404
The nav links to `/site-scorer` on every page, but the route returns 404 on deployment `community-demographic-tool-l8h4fhnl4`. Determine whether:
- (a) the page exists on a newer deployment and the shared URL is stale → if so, no code change; note that links shared with leadership should use the production alias `community-demographic-tool.vercel.app`, or
- (b) the route was never built → either build it (see Phase 2.2, the saturation index can feed it) or remove/disable the nav item until it exists. A dead nav link is unacceptable for a leadership demo.

### 0.2 Pre-hydration placeholder dashes
Static copy on Comm. Needs renders literal `—` placeholders before client data loads ("`— DFW ZIPs`", "`—/1K residents`"). Either compute these counts at build time (they derive from the static ZIP list) or replace with a proper skeleton/loading state. No em-dash placeholders visible in shipped HTML.

### 0.3 Coverage-area labeling and benchmark dilution
The ZIP dropdown now spans far beyond the 12-county DFW MSA (Hill, Navarro, Hopkins, Cooke, Montague, Fannin, Henderson, Grayson counties, etc.), but headers still say "DFW Metro" and metro averages include rural ZIPs, which dilutes comparisons for suburban candidates.
- Tag each ZIP in the ZIP master list with `region: "core_msa" | "extended"` (core = the 12 DFW MSA counties already documented in the project).
- Add a global toggle (persisted in URL query param, e.g. `?coverage=core|all`) that filters every average, ranking table, and map to the selected coverage area.
- Default to `core`. Label benchmark figures with which coverage set they use.

### 0.4 ZCTA caveat
Census "ZIP" data is actually ZCTA (ZIP Code Tabulation Area) data. Add one footnote line wherever ACS data appears by ZIP: "Census data is reported by ZCTA, which approximates but does not exactly match USPS ZIP boundaries." Also link this from the Methodology page (1.1).

---

## Phase 1 — Trust & usability for leadership

### 1.1 Methodology / data dictionary page (`/methodology`)
A static page documenting, for every metric on the platform:
- Source, dataset name, vintage (e.g., "ACS 5-Year Estimates, 2019–2023"), and refresh cadence
- Exact definition (e.g., what counts as "% w/ Children")
- **SES Class definitions** — the SES Class column appears in ranking tables but the classification logic is not documented anywhere user-visible. Write out the thresholds/formula used. This is the #1 question leadership will ask.
- Known limitations per source (ZCTA mismatch, ACS margin of error on small ZIPs, IRS BMF under-coverage, etc.)
- For modeled or proxy data (Phase 3), the confidence framing rules in 3.4.

### 1.2 Export
- **CSV export** on every ranking table (client-side generation is fine).
- **Per-ZIP one-pager**: a print-friendly route (`/zip/[zip]/print` or a print stylesheet) combining demographics, growth, SES, health, and religious-landscape data for a single ZIP, suitable for "print to PDF" in a leadership meeting. Keep it to one page; brand-consistent but white-background for printing.

### 1.3 ACS margin-of-error guard
ACS 5-year estimates for low-population ZCTAs have wide margins of error. Where the ACS API returns MOE variables, fetch them; if MOE/estimate ratio exceeds a threshold (suggest 0.3), render the value with a "low reliability" indicator (e.g., dimmed + tooltip). At minimum apply this to median HHI and the age-band data. ⚠️ VERIFY which MOE variables correspond to the tables already in use.

---

## Phase 2 — Connect growth and church landscape

### 2.1 Church saturation index
The IRS EO BMF data already powers the Religious page. Compute, per ZIP and per county:
- `churches_per_10k = (count of X20/X21/X22-coded orgs + orgs flagged as churches) / population * 10,000`
- NTEE codes, ✅ VERIFIED against IRS Publication 4838: X20 Christian, X21 Protestant, X22 Roman Catholic, X30 Jewish, X40 Islamic, X50 Buddhist, X70 Hindu.
- Caveat (already correctly noted on the Religious page, keep it): the BMF undercounts congregations that never register/file. Treat the index as relative, not absolute — useful for comparing ZIPs against each other, not for stating "there are exactly N churches."

### 2.2 Opportunity view (feeds Site Scorer)
A scatter or quadrant view: x-axis population growth %, y-axis church saturation (inverted). Highlight the "high growth / low saturation" quadrant. This is the core campus-opportunity signal and should be a scored input in Site Scorer with a user-visible, adjustable weight. All Site Scorer weights must be transparent (shown on screen) and documented in `/methodology`.

---

## Phase 3 — Religious landscape expansion (incl. Muslim population estimates)

### Context and constraints (read before building)
**The U.S. Census Bureau does not collect religion data.** There is no Census/ACS variable for religious affiliation, so there is no measured "% Muslim by ZIP." Everything in this phase is either (a) county-level estimates from religious-body counts, (b) modeled survey data, or (c) demographic proxies. The UI must never present any of it as a precise measurement. Every visualization in this phase carries an on-chart confidence label (see 3.4).

### 3.1 County-level religious adherence layer — primary source
**Source:** 2020 U.S. Religion Census (ASARB). ✅ VERIFIED: county-level congregation and adherent counts for 372 religious bodies including Muslim estimates; downloadable as Excel ("Group Detail Data by Nation, State, County, and Metro") from usreligioncensus.org/interactive-tables, and as a county-level dataset (RCMSCY20, with RELTRAD religious-tradition variables added Jan 2024) from theARDA.com data archive. ⚠️ VERIFY license/terms of use for an internal dashboard before ingesting; the publishers state the study is not for marketing purposes (internal ministry planning is a different use, but read the terms).
**Build:**
- One-time ingest script: download the county file, filter to the coverage-area counties, store as a static JSON/data file in the repo (this is decennial data; no live API needed).
- New section on the Religious page (or `/religious/adherence`): per-county adherence rates for: Evangelical Protestant, Mainline Protestant, Catholic, Muslim, Jewish, Buddhist, Hindu, Orthodox, and **Unclaimed** (population minus all adherents).
- Lead with **Unclaimed** — for campus planning, the share of a county unaffiliated with any congregation is the most decision-relevant number.
- Muslim adherence appears as one series among all traditions, never as a standalone chart. (See 3.4.)
- Label data vintage prominently: "2020 U.S. Religion Census · county level · adherent estimates."

### 3.2 PRRI county-level modeled estimates — secondary/corroborating source
**Source:** PRRI Census of American Religion (2020 baseline, annual updates; 2022 update ✅ VERIFIED to exist). County-level modeled religious affiliation from aggregated survey data. ⚠️ VERIFY: whether county-level data files are publicly downloadable (vs. report/interactive-only) and the latest available year before committing to this layer. If raw county data isn't accessible, drop this item rather than scraping.
**Build (if data accessible):** show PRRI estimates alongside Religion Census figures for the same county so users see two independent estimates and their disagreement — that disagreement IS the error bar.

### 3.3 ZIP-level demographic proxy layer
The only ZIP-level signal available. Must be labeled "proxy estimate" everywhere it appears.
**Source:** ACS 5-Year via the existing `/api/census` route. Candidate tables (⚠️ VERIFY exact table IDs and variable lists in the Census API before coding):
- `B05006` — Place of Birth for the Foreign-Born Population (country-level detail)
- `B04006` — People Reporting Ancestry
- `C16001` / language tables — Language Spoken at Home (e.g., Arabic, Urdu)
**Build:**
- A configurable country/ancestry group list (stored in a data file, documented in `/methodology`) mapping to "populations from predominantly Muslim countries." Do not hardcode a guessed list — flag the list itself for human review by Jolie/Plafata before shipping.
- Heat map + per-ZIP figure labeled e.g. "Residents born in / reporting ancestry from predominantly Muslim-majority countries (proxy)."
- **Required caveat text, on-screen, not just in a tooltip:** this proxy both overcounts (many people from these countries are Christian or other faiths — e.g., a large share of Arab Americans are Christian) and undercounts (large shares of American Muslims are U.S.-born, including African American and convert communities, and won't appear in birthplace/ancestry tables at all). It indicates *where communities with cultural ties to the Muslim world live*, not a Muslim population count.

### 3.4 Mosque/congregation layer
Filter the existing IRS BMF dataset by NTEE `X40` (✅ VERIFIED = Islamic) to show registered Islamic organizations per ZIP/county, alongside the existing church data. Keep the existing under-coverage caveat — it applies even more strongly to mosques, many of which operate under the church exemption and never appear in the BMF. Optionally cross-reference congregation counts in the Religion Census county data (3.1) as a sanity check.

### 3.5 Presentation rules for this phase (non-negotiable)
1. Muslim-population data always appears within the full religious-landscape view (all traditions + unclaimed), never as an isolated standalone metric or page.
2. Every chart carries an on-chart label: `MEASURED` (none of this phase qualifies), `ESTIMATE (2020 Religion Census)`, `MODELED (PRRI survey-based)`, or `PROXY (ACS ancestry/birthplace)`.
3. County-level data must not be displayed as if it were ZIP-level. No downscaling/apportioning county religion estimates to ZIPs.
4. Methodology page gets a dedicated section explaining why religion data is estimated (Census doesn't collect it) and what each tier means.
5. Framing matches the platform's existing purpose: understanding the full religious landscape of prospective communities for ministry planning — the same logic as the existing Religious page.

---

## Phase 4 — The two highest-impact additions

### 4.1 Attendee density overlay (Rock RMS)
The single most valuable layer for campus decisions: where current Lakepointe households actually live.
**Build:**
- Input: an aggregate export from Rock RMS — household counts per ZIP (and optionally per-campus attribution). ⚠️ Coordinate with Paul/Rock admins on the cleanest export path (Rock report/Lava export to CSV is fine; a live REST integration is a later optimization).
- **Privacy requirement:** ingest only aggregated counts per ZIP. No names, addresses, or individual points anywhere in this app. Suppress ZIPs with fewer than a threshold (suggest 5) households — display as "<5".
- Overlay on the existing growth map: choropleth or graduated circles of attendee households per ZIP, toggleable per campus.
- Derived metric: attendee households located 25+ minutes (see 4.2) from every existing campus = "underserved attendee clusters." Surface the top clusters as a ranked list.

### 4.2 Drive-time isochrones (replace radius thinking)
**Source:** Mapbox Isochrone API — the project already uses Mapbox. ⚠️ VERIFY current endpoint/params and pricing tier limits in Mapbox docs.
**Build:**
- For each existing campus and any candidate site (click-to-drop pin on the map), render 15/20/30-minute drive-time polygons.
- Compute population, growth, attendee households, and saturation within each isochrone by intersecting with ZCTA polygons (area-weighted apportionment is acceptable here; note the approximation in `/methodology`).
- This becomes a Site Scorer input: "population within 20-min drive" is a far better metric than any radius in DFW.

---

## Phase 5 — Leading growth indicators

ACS 5-year data badly lags reality in fast-growth exurbs (Celina, Anna, Princeton, Royse City, Fate, Forney). Add forward-looking signals:

### 5.1 Residential building permits
**Source:** U.S. Census Building Permits Survey — place-level (city) permit counts, monthly/annual. ⚠️ VERIFY current data access format (historically downloadable text/CSV files; check for API availability).
**Build:** per-place trailing-12-month single-family + multifamily units, mapped to the coverage area; show as a "momentum" column/badge on growth tables.

### 5.2 School district enrollment trends
**Source:** Texas Education Agency enrollment data (district and campus level, public). ⚠️ VERIFY current download location/format (TEA publishes enrollment reports; exact portal has changed over the years).
**Build:** 3–5 year enrollment trend per ISD in the coverage area. Enrollment growth is one of the best public leading indicators of young-family settlement — weight it in Site Scorer.

### 5.3 (Optional) County population projections
**Source:** Texas Demographic Center projections (county level). ⚠️ VERIFY latest vintage. Use for context panels, not scoring.

---

## Appendix A — Data source registry

| Source | Level | Status | Notes |
|---|---|---|---|
| ACS 5-Year (Census API) | ZCTA/county | ✅ in use | Add MOE handling (1.3); B05006/B04006/C16001 ⚠️ verify variables |
| BLS LAUS, FRED | county/metro | ✅ in use | — |
| CDC PLACES 2023 | ZCTA | ✅ in use | — |
| CFPB Consumer Complaints | ZIP | ✅ in use | — |
| IRS EO BMF | org-level | ✅ in use | NTEE religion codes ✅ verified (X20/X21/X22/X30/X40/X50/X70) |
| 2020 U.S. Religion Census (ASARB) | county | ✅ verified, not yet ingested | Excel from usreligioncensus.org/interactive-tables; ARDA county file RCMSCY20. ⚠️ verify terms of use |
| PRRI Census of American Religion | county | ⚠️ verify data access | Modeled estimates; corroborating source only |
| Mapbox Isochrone API | geometry | ⚠️ verify endpoint/limits | Project already on Mapbox |
| Rock RMS attendee export | ZIP aggregate | internal | Privacy rules in 4.1 are mandatory |
| Census Building Permits Survey | place | ⚠️ verify format | Leading indicator |
| TEA enrollment | district | ⚠️ verify portal | Leading indicator |
| HMDA mortgage denial | — | already planned Phase 2 (Comm. Needs page) | unchanged |

## Appendix B — Open questions (for Jolie/Plafata, not for Claude Code to decide)

1. Coverage area: is the extended footprint (Hill/Navarro/Hopkins/etc.) intentional, or should those ZIPs be pruned? (Affects 0.3.)
2. Country/ancestry list for the Phase 3.3 proxy — needs human sign-off before shipping.
3. Religion Census terms-of-use review for internal dashboard ingestion.
4. Rock RMS export ownership — who runs/maintains the attendee aggregate export, and how often does it refresh?
5. Site Scorer weighting — leadership should agree on default weights; the tool exposes them as adjustable either way.
