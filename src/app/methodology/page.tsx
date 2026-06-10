export default function MethodologyPage() {
  return (
    <div style={{ padding: '40px 32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '12px' }}>
          Dashboard · Methodology
        </div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px,4vw,52px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7', margin: 0 }}>
          Data &amp; Methodology
        </h1>
        <div style={{ width: '48px', height: '2px', background: 'linear-gradient(90deg,#E8B84B,rgba(232,184,75,0))', marginTop: '16px', marginBottom: '20px' }} />
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#8A98AE', lineHeight: 1.7, maxWidth: '700px', margin: 0 }}>
          This page documents every metric shown in the Community Intelligence Platform — its source, exact definition, vintage, and known limitations. All figures are derived from public datasets. No proprietary scoring or black-box models are used.
        </p>
      </div>

      {/* ── DATA SOURCES ─────────────────────────────── */}
      <Section title="Data Sources">
        <p style={bodyStyle}>
          The platform aggregates nine public data sources, all routed through a Neon PostgreSQL database.
          Data is not fetched live on page load — it is refreshed on the cadences below and served from the database.
        </p>
        <div style={{ overflowX: 'auto', marginTop: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
            <thead>
              <tr>
                {['Source', 'Geography', 'Vintage', 'Refresh cadence', 'Used for'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 14px', borderBottom: '1px solid #232940', color: '#E8B84B', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e2b3c' }}>
                  <td style={{ padding: '10px 14px', color: '#C8D4E4', fontWeight: 600 }}>{row.source}</td>
                  <td style={{ padding: '10px 14px', color: '#8A98AE' }}>{row.geo}</td>
                  <td style={{ padding: '10px 14px', color: '#8A98AE', whiteSpace: 'nowrap' }}>{row.vintage}</td>
                  <td style={{ padding: '10px 14px', color: '#8A98AE', whiteSpace: 'nowrap' }}>{row.refresh}</td>
                  <td style={{ padding: '10px 14px', color: '#8A98AE' }}>{row.usedFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '16px' }}>
          <ZctaNote />
        </div>
      </Section>

      {/* ── SES CLASS SCORING ────────────────────────── */}
      <Section title="SES Class Scoring">
        <p style={bodyStyle}>
          Each ZIP is assigned a Socioeconomic Status (SES) class based on a composite score (0–100) computed from three ACS variables at the time of data refresh. The score is not modeled or predicted — it is a direct calculation from measured Census estimates.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
          {/* Formula card */}
          <div style={cardStyle}>
            <div style={cardLabelStyle}>Composite formula</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C8D4E4', lineHeight: 2 }}>
              <div><span style={{ color: '#E8B84B' }}>50%</span> — Median household income</div>
              <div style={{ fontSize: '10px', color: '#5a6478', marginTop: '-6px', marginBottom: '4px', paddingLeft: '32px' }}>capped at $200,000 → 0–100 scale</div>
              <div><span style={{ color: '#4EAEFF' }}>30%</span> — Bachelor's degree rate</div>
              <div style={{ fontSize: '10px', color: '#5a6478', marginTop: '-6px', marginBottom: '4px', paddingLeft: '32px' }}>% of adults 25+; ×2 → 0–100 scale, cap 100</div>
              <div><span style={{ color: '#2DD4BF' }}>20%</span> — Median home value</div>
              <div style={{ fontSize: '10px', color: '#5a6478', marginTop: '-6px', paddingLeft: '32px' }}>capped at $800,000 → 0–100 scale</div>
            </div>
          </div>

          {/* Tier card */}
          <div style={cardStyle}>
            <div style={cardLabelStyle}>Tier thresholds</div>
            <table style={{ width: '100%', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', borderCollapse: 'collapse' }}>
              <tbody>
                {SES_TIERS.map(t => (
                  <tr key={t.label} style={{ borderBottom: '1px solid #1e2b3c' }}>
                    <td style={{ padding: '7px 0', color: t.color, fontWeight: 600 }}>{t.label}</td>
                    <td style={{ padding: '7px 0', color: '#8A98AE', textAlign: 'right' }}>score {t.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: '4px' }}>
          <p style={{ ...bodyStyle, margin: 0, fontSize: '12px' }}>
            <span style={{ color: '#E8B84B', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>NOTE · </span>
            SES score is a relative ranking tool, not an absolute measure of wealth. Two ZIPs with the same score may have different profiles (e.g., high income / low education vs. moderate income / high education). Always read the individual components alongside the class label.
          </p>
        </div>
      </Section>

      {/* ── LAKEPOINTE INDEXES ──────────────────────── */}
      <Section title="Lakepointe Indexes (YFI · WFI)">
        <p style={bodyStyle}>
          Two composite indexes, developed by Lakepointe leadership, synthesize multiple ACS variables into a single 0–100 signal per ZIP. Both use only variables already in the database — no additional API calls are required to compute them.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '20px' }}>
          <div style={cardStyle}>
            <div style={{ ...cardLabelStyle, color: '#4EAEFF' }}>Young Family Index (YFI)</div>
            <p style={{ ...bodyStyle, fontSize: '12px', marginBottom: '12px' }}>
              Measures the concentration of young families with children — Lakepointe's primary ministry target demographic.
            </p>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', lineHeight: 2 }}>
              <div>· Young children share <span style={{ color: '#5a6478' }}>(B09001)</span></div>
              <div>· Family HH rate <span style={{ color: '#5a6478' }}>(B11003)</span></div>
              <div>· Fertility signal <span style={{ color: '#5a6478' }}>(B13016 — births/women 15–50)</span></div>
              <div>· Average HH size <span style={{ color: '#5a6478' }}>(B25010)</span></div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ ...cardLabelStyle, color: '#2DD4BF' }}>Working Family Index (WFI)</div>
            <p style={{ ...bodyStyle, fontSize: '12px', marginBottom: '12px' }}>
              Measures economic engagement and life-stage stability — families that are working, commuting, and embedded in the local economy.
            </p>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', lineHeight: 2 }}>
              <div>· Dual-earner rate <span style={{ color: '#5a6478' }}>(B23007)</span></div>
              <div>· Working parent rate <span style={{ color: '#5a6478' }}>(B11003)</span></div>
              <div>· Commute burden <span style={{ color: '#5a6478' }}>(B08303 — workers 30+ min)</span></div>
              <div>· Occupational diversity <span style={{ color: '#5a6478' }}>(C24010 — mgmt/prof share)</span></div>
            </div>
          </div>
        </div>

        <p style={{ ...bodyStyle, marginTop: '16px', fontSize: '12px', color: '#5a6478' }}>
          Composite weighting for YFI and WFI is defined in the platform specification and will be documented here when the Site Scorer (Phase 2) is finalized. The underlying ACS variables shown above are fixed.
        </p>
      </Section>

      {/* ── METRIC DEFINITIONS ──────────────────────── */}
      <Section title="Metric Definitions">
        {METRIC_GROUPS.map(group => (
          <div key={group.group} style={{ marginBottom: '28px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#4EAEFF', textTransform: 'uppercase', marginBottom: '10px' }}>
              {group.group}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.metrics.map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ── KNOWN LIMITATIONS ──────────────────────── */}
      <Section title="Known Limitations">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {LIMITATIONS.map((lim, i) => (
            <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid #1e2b3c', borderRadius: '4px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '6px' }}>
                {lim.source}
              </div>
              <p style={{ ...bodyStyle, margin: 0, fontSize: '13px' }}>{lim.limitation}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer ZCTA note */}
      <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid #1e2b3c' }}>
        <ZctaNote />
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '0.1em', color: '#E8B84B', marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ width: '100%', height: '1px', background: '#1e2b3c', marginBottom: '20px' }} />
      {children}
    </div>
  )
}

function ZctaNote() {
  return (
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478' }}>
      * ZIP-level data uses ZCTA boundaries (Census ZIP Code Tabulation Areas), which approximate but do not exactly match USPS ZIP codes.
    </span>
  )
}

// ── Styles ───────────────────────────────────────────

const bodyStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: '14px',
  color: '#8A98AE',
  lineHeight: 1.7,
  margin: '0 0 12px 0',
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
  border: '1px solid #232940',
  borderRadius: '4px',
  padding: '20px 20px',
}

const cardLabelStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '10px',
  letterSpacing: '0.16em',
  color: '#E8B84B',
  textTransform: 'uppercase',
  marginBottom: '12px',
}

// ── Data ─────────────────────────────────────────────

const DATA_SOURCES = [
  {
    source: 'Census ACS 5-Year',
    geo: 'ZCTA (ZIP)*',
    vintage: '2023 (2019–2023)',
    refresh: 'Annually',
    usedFor: 'Population, income, race, education, age, household composition, indexes',
  },
  {
    source: 'Census CBP 2022',
    geo: 'ZIP / county',
    vintage: '2022',
    refresh: 'Annually (static vintage)',
    usedFor: 'Employer counts, industry mix, payroll, avg wage by sector',
  },
  {
    source: 'BLS LAUS',
    geo: 'DFW metro',
    vintage: 'Current month',
    refresh: 'Monthly',
    usedFor: 'Metro unemployment rate, labor force size',
  },
  {
    source: 'FRED',
    geo: 'DFW metro',
    vintage: 'Current quarter',
    refresh: 'Monthly',
    usedFor: 'Metro population, residential building permits',
  },
  {
    source: 'College Scorecard',
    geo: 'Institution (by ZIP radius)',
    vintage: 'Current',
    refresh: 'Live API (not cached)',
    usedFor: 'Nearby colleges on Demographics page',
  },
  {
    source: 'CDC PLACES 2023',
    geo: 'ZCTA (ZIP)*',
    vintage: '2023',
    refresh: 'Annually',
    usedFor: 'Health rates: diabetes, obesity, smoking, uninsured, depression, etc.',
  },
  {
    source: 'CFPB Consumer Complaints',
    geo: 'ZIP',
    vintage: 'Cumulative all-time',
    refresh: 'Monthly',
    usedFor: 'Financial distress proxy on Community Needs page',
  },
  {
    source: 'IRS EO BMF (NTEE X)',
    geo: 'Organization address',
    vintage: 'Current publication',
    refresh: 'Monthly',
    usedFor: 'Religious org count, type, and ruling year on Religious page',
  },
  {
    source: 'Census TIGERweb',
    geo: 'ZCTA polygons',
    vintage: '2023',
    refresh: '24-hour server cache',
    usedFor: 'Map boundaries (Mapbox choropleth)',
  },
]

const SES_TIERS = [
  { label: 'Upper',        range: '78 – 100', color: '#E8B84B' },
  { label: 'Upper Middle', range: '58 – 77',  color: '#4EAEFF' },
  { label: 'Middle',       range: '40 – 57',  color: '#2DD4BF' },
  { label: 'Lower Middle', range: '25 – 39',  color: '#A78BFA' },
  { label: 'Lower Income', range: '0 – 24',   color: '#FF6B6B' },
]

const METRIC_GROUPS = [
  {
    group: 'Population & Growth',
    metrics: [
      { label: 'Population', definition: 'Total persons in the ZCTA (ACS B01001_001E). 2023 5-year estimate.' },
      { label: 'Population Growth', definition: 'Percent change from 2020 ACS 5-year estimate to 2023. A positive figure means the ZCTA grew. Values are capped at ±9,999.9% to prevent division-by-tiny-base distortions in newly developed ZCTAs.' },
    ],
  },
  {
    group: 'Income & Housing',
    metrics: [
      { label: 'Median Household Income', definition: 'Median income for all households in the ZCTA in the 12 months prior to the survey, in 2023 inflation-adjusted dollars (ACS B19013_001E). Includes all income types.' },
      { label: 'Median Home Value', definition: 'Median value of owner-occupied housing units (ACS B25077_001E). Self-reported by homeowners; does not reflect recent market prices for renters or vacant units.' },
      { label: 'Income Brackets', definition: 'Distribution of households across income tiers from ACS table B19001 (16 bands, grouped into 6 display tiers). Shown as percent of total households in the ZCTA.' },
    ],
  },
  {
    group: 'Education',
    metrics: [
      { label: "Bachelor's Rate", definition: "Percent of persons age 25+ with a bachelor's degree or higher (ACS B15003, summing cells 022–025: bachelor's, master's, professional, and doctorate). Denominator is total persons 25+ with a reported education level." },
      { label: 'Education Distribution', definition: "Four tiers derived from ACS B15003: No HS diploma (cells 001 minus HS+), HS diploma/GED (017–018), some college/associate's (019–021), bachelor's or higher (022–025)." },
    ],
  },
  {
    group: 'Race & Ethnicity',
    metrics: [
      { label: 'Race / Ethnicity', definition: 'From ACS B03002 (Hispanic or Latino Origin by Race). Hispanic is an ethnicity — a person of any race can be Hispanic. The platform follows Census convention: Hispanic is shown separately and does not overlap with White/Black/Asian counts. "Other" is the residual (multiracial, Native American, Pacific Islander, other).' },
    ],
  },
  {
    group: 'Households & Family Structure',
    metrics: [
      { label: 'Households with Children', definition: 'Percent of households with at least one own child under age 18 (ACS B11005_002E ÷ B11001_001E).' },
      { label: 'Avg Household Size', definition: 'Average number of persons per occupied housing unit (ACS B25010_001E).' },
      { label: 'Married with Children', definition: 'Married-couple families with own children under 18 (ACS B11003_003E) as a share of all households.' },
      { label: 'Married, No Children', definition: 'Married-couple households minus those with children (B11001_003E − B11003_003E) as a share of all households.' },
      { label: 'Single Parent', definition: 'Households with children but no spouse/partner present (B11005_002E − B11003_003E). Includes male and female householders.' },
      { label: 'Living Alone', definition: 'Nonfamily householders living alone (ACS B11001_008E) as a share of all households.' },
    ],
  },
  {
    group: 'Age Distribution',
    metrics: [
      { label: 'Age Bands', definition: 'Five bands derived from ACS B01001 (sex by age — 49 cells): 0–17, 18–34, 35–54, 55–74, 75+. Male and female cells are summed; each band is shown as a share of total population.' },
    ],
  },
  {
    group: 'Labor & Commute',
    metrics: [
      { label: 'Unemployment Rate', definition: 'ZIP-level: unemployed persons (ACS B23025_005E) ÷ civilian labor force (B23025_002E). Note: metro-level unemployment on the Overview page comes from BLS LAUS, which uses a different methodology and is more current.' },
      { label: 'Dual-Earner Households', definition: 'Percent of families where both spouses/partners are in the labor force (ACS B23007_004E + B23007_014E ÷ B23007_001E). Includes both families with and without children.' },
      { label: 'Long Commute (30+ min)', definition: 'Workers age 16+ with a one-way commute of 30 minutes or more (ACS B08303 cells 008–013) as a share of all workers with a reported commute time (B08303_001E).' },
      { label: 'Mgmt / Prof Occupations', definition: "Share of employed civilians 16+ in management, business, science, and arts occupations (ACS C24010_003E + C24010_039E, male + female) ÷ total employed (C24010_001E). ACS's broadest 'white-collar' category." },
    ],
  },
  {
    group: 'Employers (Census CBP 2022)',
    metrics: [
      { label: 'Total Establishments', definition: 'Count of business establishments with paid employees in the ZIP (CBP 2022). Excludes self-employed with no payroll.' },
      { label: 'Industry Mix', definition: '20 NAICS-sector groups. Shown as establishment count (primary) and share of total employment.' },
      { label: 'Avg Wage by Sector', definition: 'Annual payroll ÷ employment for each of the 20 NAICS sectors, computed from county-level CBP data for the four DFW core counties (Dallas, Tarrant, Collin, Denton). Stored in metro_stats.sector_wages. ZIP-level payroll data is in $1,000 units per CBP convention.' },
      { label: 'Employer Size Distribution', definition: 'Establishments grouped by employee-count band (CBP size codes: <5, 5–9, 10–19, 20–49, 50–99, 100–249, 250–499, 500+).' },
    ],
  },
  {
    group: 'Health (CDC PLACES 2023)',
    metrics: [
      { label: 'Health Rates', definition: 'Model-based estimates of the percentage of adults (18+) in the ZCTA with each condition or behavior. CDC PLACES uses multilevel regression and poststratification (MRP) to produce small-area estimates from BRFSS survey data — these are modeled estimates, not direct counts. Includes: diabetes prevalence, obesity, current smoking, lack of health insurance, high blood pressure, depression, frequent mental distress (14+ days/month), physical inactivity, and self-rated poor/fair health.' },
    ],
  },
  {
    group: 'Financial Stress (CFPB)',
    metrics: [
      { label: 'Consumer Complaints', definition: 'Cumulative all-time count of consumer complaints submitted to the CFPB Consumer Complaint Database for the ZIP code. Includes complaints on mortgages, credit cards, debt collection, and other financial products. High counts may reflect population size as much as distress — use per-1,000 residents figure for comparison.' },
    ],
  },
  {
    group: 'Religious Landscape (IRS EO BMF)',
    metrics: [
      { label: 'Religious Organizations', definition: 'Active tax-exempt organizations from the IRS Exempt Organizations Business Master File filtered to NTEE major group X (Religion-Related). Classified by NTEE subcategory: X20 Christian, X21 Protestant, X22 Roman Catholic, X30 Jewish, X40 Islamic, X50 Buddhist, X70 Hindu. Ruling year is the year the IRS recognized the organization\'s tax-exempt status.' },
      { label: 'Churches per 10K', definition: 'Count of NTEE X20/X21/X22-coded organizations in the ZIP ÷ population × 10,000. Used as a church saturation proxy. Treat as a relative ranking tool — see Known Limitations.' },
    ],
  },
]

const LIMITATIONS = [
  {
    source: 'ACS 5-Year Estimates — ZCTA boundaries',
    limitation: 'Census "ZIP" data uses ZIP Code Tabulation Areas (ZCTAs), which are built from Census blocks and approximate — but do not exactly match — USPS delivery ZIP codes. A ZCTA may cover a slightly different geographic area than the corresponding ZIP code, and some ZIP codes (PO Box-only, unique, or large-employer ZIPs) have no corresponding ZCTA and therefore no Census data.',
  },
  {
    source: 'ACS 5-Year Estimates — Margin of error',
    limitation: 'ACS estimates for small ZCTAs (population under ~5,000) carry wide margins of error. A 5-year estimate with a ±$20,000 MOE on median household income means the true value could plausibly be anywhere in a $40,000 range. The platform currently displays point estimates without MOE indicators; interpret small-ZCTA figures with caution. A "low reliability" indicator (Phase 1.3) is planned.',
  },
  {
    source: 'ACS 5-Year Estimates — Vintage lag',
    limitation: 'The 2023 ACS 5-year release covers 2019–2023. In fast-growing exurbs (Celina, Anna, Princeton, Royse City, Forney), actual 2024–2025 conditions may differ substantially from this average. Population growth figures compare the 2023 5-year estimate to the 2020 5-year estimate — not a point-in-time 2020 to 2023 comparison.',
  },
  {
    source: 'Census CBP 2022',
    limitation: 'The County Business Patterns vintage used is 2022 — the most recent available at time of build. Employer mix and wage data lags by approximately 2–3 years. Establishments with fewer than one paid employee (sole proprietors) are excluded. Some ZIP-level cells are suppressed by the Census Bureau to prevent disclosure of individual businesses.',
  },
  {
    source: 'IRS EO BMF — Religious organizations',
    limitation: 'The IRS Business Master File only includes organizations that have applied for and received tax-exempt status. Many congregations — particularly smaller churches, house churches, and mosques operating under the broad church exemption — never file and therefore do not appear in the BMF. The church saturation index should be interpreted as a relative ranking across ZIPs, not an absolute count of all congregations. The BMF under-coverage is likely more severe for Islamic organizations than for Christian ones.',
  },
  {
    source: 'CDC PLACES 2023',
    limitation: 'PLACES estimates are model-based (MRP methodology), not direct survey counts at the ZCTA level. Small-area health estimates carry uncertainty that is not currently displayed. Estimates may not reflect recent changes in health behavior or insurance coverage following policy changes.',
  },
  {
    source: 'CFPB Consumer Complaints',
    limitation: 'Complaint counts are raw totals, not rates. A high-population ZIP will generally generate more complaints than a low-population one regardless of financial distress. The per-1,000-residents normalization shown on the Community Needs page partially corrects for this, but complaint propensity also varies by awareness of the CFPB and by the types of financial products prevalent in the area.',
  },
  {
    source: 'College Scorecard',
    limitation: 'The Scorecard API returns schools within a specified radius of the ZIP centroid. Schools near the edge of the radius may appear or disappear depending on slight centroid placement differences. Trade and vocational schools (ICLEVEL=3) are filtered from display but are still present in the underlying data. The platform uses a 10-mile radius by default.',
  },
  {
    source: 'SES Class Score',
    limitation: 'The SES composite is sensitive to the income and home value caps ($200K and $800K). ZIPs above these caps are all scored identically on those components. The score is designed to differentiate the middle of the DFW distribution — it is not intended to rank the wealthiest ZIPs against each other.',
  },
]
