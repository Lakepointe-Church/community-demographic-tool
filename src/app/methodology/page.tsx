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
          The platform aggregates ten public data sources, all routed through a Neon PostgreSQL database.
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '20px' }}>
          <div style={cardStyle}>
            <div style={{ ...cardLabelStyle, color: '#4EAEFF' }}>YFI weights</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', lineHeight: 2 }}>
              <div><span style={{ color: '#4EAEFF' }}>40%</span> — Young children share (age_0_17 / 30%)</div>
              <div><span style={{ color: '#4EAEFF' }}>25%</span> — Family HH rate (mwKids + single parent / 40%)</div>
              <div><span style={{ color: '#4EAEFF' }}>20%</span> — Fertility signal (rate × 100 / 8%)</div>
              <div><span style={{ color: '#4EAEFF' }}>15%</span> — HH size ((size − 1.5) / 2.0)</div>
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ ...cardLabelStyle, color: '#2DD4BF' }}>WFI weights</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', lineHeight: 2 }}>
              <div><span style={{ color: '#2DD4BF' }}>40%</span> — Dual-earner rate (/ 40%)</div>
              <div><span style={{ color: '#2DD4BF' }}>25%</span> — HH with children rate (/ 50%)</div>
              <div><span style={{ color: '#2DD4BF' }}>20%</span> — Commute burden inverse (100 − commute30+%)</div>
              <div><span style={{ color: '#2DD4BF' }}>15%</span> — Bachelor&apos;s rate proxy (/ 50%)</div>
            </div>
          </div>
        </div>
        <p style={{ ...bodyStyle, marginTop: '12px', fontSize: '12px', color: '#5a6478' }}>
          Each component is normalized to 0–100 before weighting. All components are capped at 100.
        </p>
      </Section>

      {/* ── SITE SCORER ──────────────────────────────── */}
      <div id="site-scorer">
        <Section title="Site Scorer">
          <p style={bodyStyle}>
            The Site Scorer combines a chosen set of signals into a single 0–100 Fit Score per ZIP, with user-adjustable weights visible and editable on the <a href="/site-scorer" style={{ color: '#E8B84B' }}>Site Scorer page</a>. Leadership can toggle each signal in or out of the score; only the enabled signals are normalized to sum to 100% before scoring. Six demand/supply signals are on by default; <span style={{ color: '#FB923C' }}>Distance from campus</span> is available but off by default.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
            <div style={cardStyle}>
              <div style={cardLabelStyle}>Default weights</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', lineHeight: 2 }}>
                <div><span style={{ color: '#4EAEFF' }}>23%</span> — Young Family Index (YFI)</div>
                <div><span style={{ color: '#2DD4BF' }}>23%</span> — Working Family Index (WFI)</div>
                <div><span style={{ color: '#A78BFA' }}>18%</span> — SES Score</div>
                <div><span style={{ color: '#FF6B6B' }}>14%</span> — Population Growth</div>
                <div><span style={{ color: '#E8B84B' }}>12%</span> — Church Saturation Opportunity</div>
                <div><span style={{ color: '#2DD4BF' }}>10%</span> — School Enrollment Growth</div>
                <div><span style={{ color: '#FB923C' }}>off</span> — Distance from Campus (opt-in; 10% when enabled)</div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={cardLabelStyle}>Component normalization</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', lineHeight: 2 }}>
                <div>Growth score: <span style={{ color: '#5a6478' }}>(growth + 10) / 50 × 100, capped 0–100</span></div>
                <div>Saturation opp.: <span style={{ color: '#5a6478' }}>100 − min(100, churches/10K / 30 × 100)</span></div>
                <div>Enrollment growth: <span style={{ color: '#5a6478' }}>county ISD CAGR × 12, capped 0–100</span></div>
                <div>Distance from campus: <span style={{ color: '#5a6478' }}>straight-line mi to nearest existing campus / 30 × 100, capped 0–100 (farther = higher)</span></div>
                <div>YFI / WFI / SES: <span style={{ color: '#5a6478' }}>already 0–100 (see above)</span></div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '10px' }}>
              Church Saturation Index
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Definition', definition: 'Count of IRS BMF Christian organizations (NTEE category X — X20 Christian, X21 Protestant, X22 Roman Catholic, and other X2x subcodes) divided by ZIP population × 10,000. Filtered to ntee_category = \'Christian\' in the database.' },
                { label: 'Source', definition: 'IRS EO Business Master File (BMF). Updated monthly. Only 501(c) registered organizations appear; churches below the 990-filing threshold are not counted.' },
                { label: 'Interpretation', definition: 'Lower churches/10K = less saturated market = higher campus opportunity. The index is relative — useful for comparing ZIPs to each other, not for stating absolute church counts. Treat as a directional signal, not a census.' },
                { label: 'Known gap', definition: 'The BMF systematically undercounts congregations, especially newer or smaller churches that operate under a group exemption or have never filed. This bias is consistent across ZIPs, preserving the relative ranking value of the index.' },
              ].map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: '4px' }}>
            <p style={{ ...bodyStyle, margin: 0, fontSize: '12px' }}>
              <span style={{ color: '#E8B84B', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>TRANSPARENCY · </span>
              All Site Scorer weights are shown on the scoring page and can be adjusted in real time. Changing a weight updates all scores and the opportunity quadrant immediately. No hidden weighting is applied.
            </p>
          </div>
        </Section>
      </div>

      {/* ── RELIGIOUS LANDSCAPE — DATA & METHODOLOGY ── */}
      <Section title="Religious Landscape — Data &amp; Methodology">
        <p style={bodyStyle}>
          The Religious Landscape page combines three types of data with fundamentally different confidence levels.
          Each panel carries a labeled chip distinguishing what kind of evidence is being shown. The Census Bureau
          does not collect religion data — there is no measured &ldquo;% Muslim by ZIP.&rdquo; Everything on this page is either
          directly counted registrations, congregation-reported estimates, or demographic proxies.
        </p>

        {/* Confidence chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '20px 0' }}>
          {[
            { chip: 'MEASURED', color: '#4EAEFF', desc: 'IRS BMF — federal registration records. Directly counted from filing data. Undercounts congregations that operate under a church exemption and never file.' },
            { chip: 'ESTIMATE', color: '#E8B84B', desc: '2020 U.S. Religion Census (ASARB) — congregation-reported adherent counts, aggregated to county level. Not a Census Bureau product.' },
            { chip: 'PROXY',    color: '#A78BFA', desc: 'ACS birthplace + language — adjacent demographic signals at ZIP level. Directional only. Overcounts non-Muslims from flagged countries; undercounts U.S.-born Muslims.' },
          ].map(({ chip, color, desc }) => (
            <div key={chip} style={{ flex: '1 1 260px', padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}30`, borderRadius: '4px', borderLeft: `3px solid ${color}` }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color, letterSpacing: '0.12em', marginBottom: '6px' }}>{chip}</div>
              <p style={{ ...bodyStyle, margin: 0, fontSize: '12px' }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* ASARB */}
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase', margin: '28px 0 12px' }}>
          2020 U.S. Religion Census (ASARB)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: 'Source', definition: '2020 U.S. Religion Census, conducted by the Association of Statisticians of American Religious Bodies (ASARB). Published 2022; updated county-level file with RELTRAD tradition variables released January 2024. Distributed via theARDA.com (dataset ID RCMSCY20). Decennial — next release approximately 2030.' },
            { label: 'What was measured', definition: 'Participating denominations and religious bodies reported congregation counts and adherent counts for each county. The study covered 372 religious bodies. Not all denominations participate — non-participating groups are systematically undercounted. This is not a Census Bureau product and is not based on individual responses.' },
            { label: 'Tradition classification', definition: 'Traditions follow the Steensland et al. RELTRAD schema: Evangelical Protestant, Mainline Protestant, Black Protestant, Catholic, Orthodox, Jewish, Muslim, Buddhist, Hindu, Other Christian, Other. These are researchers\' classifications of denominations, not self-reported individual identities.' },
            { label: 'Unclaimed', definition: '"Unclaimed" = county population minus the sum of all reported adherents. It represents people not affiliated with any congregation that participated in the Religion Census. It does not mean "no religion" — it includes the nonreligious, the privately religious, and members of congregations that did not participate in the study. For campus planning, Unclaimed is the most decision-relevant number: it represents the population without a counted congregational home.' },
            { label: 'Geography', definition: 'County level only. The platform covers 23 DFW counties: 11 core MSA counties (Dallas, Tarrant, Collin, Denton, Rockwall, Ellis, Johnson, Kaufman, Parker, Wise, Hunt) and 12 extended counties. Do not interpret county figures as ZIP-level data.' },
            { label: 'Attribution', definition: 'All displays of this data carry the required attribution: "2020 U.S. Religion Census (ASARB) · County level · Adherent estimates." Per ASARB terms, this data is not for marketing or commercial purposes. Internal church ministry planning is the intended use.' },
          ].map(m => (
            <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid rgba(232,184,75,0.3)' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
            </div>
          ))}
        </div>

        {/* ACS Proxy */}
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#A78BFA', textTransform: 'uppercase', margin: '28px 0 12px' }}>
          ACS Muslim Community Presence Proxy
        </div>
        <p style={bodyStyle}>
          The only ZIP-level signal available. Two columns are shown separately and are never summed — they capture
          overlapping but distinct populations.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {[
            { label: 'proxy_born', definition: 'Sum of ACS B05006 (Place of Birth for the Foreign-Born Population) cells for 20 predominantly Muslim-majority countries. Stored in zip_demographics.proxy_born. Per-1,000-residents figure normalizes for ZIP population.' },
            { label: 'proxy_language', definition: 'ACS C16001_033E — count of persons age 5+ in households where Arabic is spoken at home (all English proficiency levels). C16001 is the only language table available at the ZCTA level; B16001 (which includes Urdu, Bengali, and Somali separately) is only available at census tract and county geography. Language speakers are not summed with birthplace counts.' },
          ].map(m => (
            <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid rgba(167,139,250,0.3)' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
            </div>
          ))}
        </div>

        {/* Country list */}
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#8A98AE', textTransform: 'uppercase', marginBottom: '10px' }}>
          Approved country list — proxy_born (B05006)
        </div>
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
            <thead>
              <tr>
                {['Country / Group', 'ACS Variable', 'Notes'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 12px', borderBottom: '1px solid #232940', color: '#5a6478', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '10px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROXY_COUNTRIES.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1f2e' }}>
                  <td style={{ padding: '7px 12px', color: r.flagged ? '#FF6B6B' : '#A8B4C5' }}>
                    {r.country}
                    {r.flagged && <span style={{ fontSize: '9px', color: '#FF6B6B', marginLeft: '6px' }}>★ FLAGGED</span>}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#5a6478' }}>{r.variable}</td>
                  <td style={{ padding: '7px 12px', color: '#8A98AE', fontSize: '11px' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...bodyStyle, fontSize: '11px', color: '#5a6478' }}>
          ★ Flagged countries include significant non-Muslim minority populations in their diaspora communities.
          Excluded countries: Iran (large secular/non-Muslim DFW diaspora), Lebanon (large Maronite Christian community),
          India (mixed Hindu/Muslim/Sikh diaspora), Israel (Jewish state).
        </p>

        {/* Required caveat */}
        <div style={{ padding: '14px 16px', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', marginTop: '8px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#A78BFA', letterSpacing: '0.1em', marginBottom: '6px', textTransform: 'uppercase' }}>Required caveat — always shown on the dashboard</div>
          <p style={{ ...bodyStyle, margin: 0, fontSize: '13px' }}>
            This proxy both <strong style={{ color: '#C8D4E4' }}>overcounts</strong> (many people from these countries are Christian or other faiths —
            Iraq: Chaldean Catholic &amp; Assyrian Christian; Egypt: Coptic Orthodox; Syria: Syrian Christian) and{' '}
            <strong style={{ color: '#C8D4E4' }}>undercounts</strong> (large shares of American Muslims are U.S.-born, including
            African American and convert communities, and will not appear in birthplace tables at all).
            It indicates <em>where communities with cultural ties to the Muslim world live</em>, not a Muslim population count.
          </p>
        </div>
      </Section>

      {/* ── PHASE 5 — LEADING INDICATORS ───────────── */}
      <Section title="Leading Indicators (Phase 5)">
        <p style={bodyStyle}>
          ACS 5-year data lags reality by 1–3 years in fast-growth DFW exurbs. Phase 5 adds three county-level forward-looking signals to the Demographics page. These supplement — but do not replace — the ACS data that drives all other scoring.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '20px' }}>

          {/* BPS */}
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '10px' }}>
              5.1 · Building Permits (Census BPS)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Source', definition: 'U.S. Census Bureau Building Permits Survey (BPS). Annual county-level file downloaded directly from www2.census.gov/programs-surveys/bps/data/annual/{year}/county/. Import script: scripts/import-permits.ts (automated — run annually after May release).' },
                { label: 'Geography', definition: 'County level only. No ZIP granularity is available from BPS. All ZIPs in a county display the same county-level permit count.' },
                { label: 'Metric', definition: 'Total units authorized by permit in the most recent year available (2025 annual, released May 2026), split by single-family (1-unit structures) and multifamily (2+ unit structures). Momentum badge shows year-over-year % change from the prior year.' },
                { label: 'Site Scorer use', definition: 'Not directly scored. Shown as a context indicator on the Demographics page only.' },
              ].map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>

          {/* TEA */}
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#4EAEFF', textTransform: 'uppercase', marginBottom: '10px' }}>
              5.2 · School Enrollment Trends (TEA PEIMS)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Source', definition: 'Texas Education Agency PEIMS (Public Education Information Management System) district-level enrollment reports. Data covers 2020-21 through 2024-25 school years. Downloaded manually from tea.texas.gov/reports-and-data/student-data/standard-reports/peims-standard-reports and processed via scripts/import-tea.ts.' },
                { label: 'Geography', definition: 'Individual school districts (ISDs), aggregated to county for display and scoring. Each district record includes the county it primarily serves. Some districts span county lines — they are assigned to their primary county.' },
                { label: 'CAGR metric', definition: 'Compound Annual Growth Rate across the full available enrollment period. Formula: (lastEnrollment / firstEnrollment)^(1/years) − 1, expressed as a percentage. Positive CAGR = growing ISD base = young families moving in.' },
                { label: 'Enrollment Growth Score (Site Scorer)', definition: 'The county-level enrollment CAGR is converted to a 0–100 score via: min(100, max(0, cagr × 12)). A CAGR of ~8.3% yields a score of 100. This score feeds the 6th Site Scorer slider (default weight: 10%). Scores show as "—" until TEA data is loaded.' },
                { label: 'Rationale', definition: 'School enrollment is one of the best public leading indicators of young-family settlement — families move to areas with good schools, and enrollment growth precedes ACS population growth by 1–2 years in fast-growth suburbs.' },
              ].map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>

          {/* TDC */}
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#A78BFA', textTransform: 'uppercase', marginBottom: '10px' }}>
              5.3 · County Population Projections (Texas Demographic Center)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Source', definition: 'Texas Demographic Center (TDC) Vintage 2024 county population projections. Download: https://demographics.texas.gov/Projections/. Import script: scripts/import-tdc.ts (manual download required — save bulk CSV to data/tdc-projections-2024.csv).' },
                { label: 'Scenarios', definition: 'TDC provides three scenarios based on migration assumptions: low, mid, and high. The platform loads the mid (baseline) scenario only. The mid scenario uses Census Bureau 2023 national projection assumptions as a migration input.' },
                { label: 'Years displayed', definition: 'Base year 2020, plus projections at 2030 and 2040 on the Demographics page. The underlying table also stores 2025, 2035, and 2050.' },
                { label: 'Site Scorer use', definition: 'County projections are shown as context only on the Demographics page. They are not incorporated into the Site Scorer scoring formula — projections carry significant uncertainty, especially past 2035.' },
              ].map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>

          {/* LODES Commute Corridors */}
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#2DD4BF', textTransform: 'uppercase', marginBottom: '10px' }}>
              5.4 · Commute Corridors (LEHD LODES)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Source', definition: 'U.S. Census Bureau LEHD LODES8 (LODES, version 8) Origin-Destination Employment Statistics — the data behind OnTheMap. The Texas "main" OD file (tx_od_main_JT00, all primary + secondary jobs, both ends in TX) is paired with the LODES8 geography crosswalk (tx_xwalk), which maps every 2020 census block to its ZCTA. Current vintage: 2023 (released December 2025). Import script: scripts/import-lodes.ts (auto-fetches both gzip files; re-run annually).' },
                { label: 'Geography', definition: 'Census block → ZCTA, aggregated to home-ZIP → work-ZIP. Only intra-DFW flows (both home and work block fall in a DFW coverage ZIP) are kept, so the corridors describe where a ZIP\'s residents commute within the metro. Jobs commuting outside the DFW coverage area are excluded from the displayed totals.' },
                { label: 'Self-containment', definition: 'Share of a ZIP\'s resident workers whose job is in the same ZIP (work_in_zip ÷ total_workers). High self-containment = a live-work community; low self-containment = a bedroom community whose residents drive elsewhere for work.' },
                { label: 'Net commute direction', definition: 'The job-weighted average bearing from the home ZIP\'s centroid toward each work-destination ZIP\'s centroid, expressed as a compass label (N/NE/…/NW) plus a 0–1 concentration (vector magnitude ÷ total external jobs). Concentration near 1.0 means residents nearly all drive the same way (a strong corridor); near 0 means work is dispersed in all directions. Centroids are derived from the crosswalk\'s block lat/long. Used to reason about "is a candidate campus on the right side of the daily drive?"' },
                { label: 'High-earner share', definition: 'Each corridor reports the % of those jobs paying more than $3,333/month (~$40k/yr), from the LODES SE03 earnings segment. A relative affluence signal for the commute, not a household income measure.' },
                { label: 'Scoring use', definition: 'Context tier only — commute corridors are shown on the Demographics page and are NOT a Site Scorer input. Per the scoring-governance rules, access/commute would be a single candidate signal if ever scored, but it is displayed-with-caveat for now.' },
              ].map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>

          {/* IRS SOI Giving Capacity */}
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '10px' }}>
              5.5 · Giving Capacity (IRS SOI)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Source', definition: 'IRS Statistics of Income (SOI) Individual Income Tax Statistics — ZIP Code Data, Tax Year 2022 (the latest release). File 22zpallagi.csv, downloaded directly from irs.gov/pub/irs-soi (no key). Import script: scripts/import-soi.ts (re-run annually).' },
                { label: 'Geography', definition: 'True USPS ZIP codes (not ZCTA approximations). The file reports one row per ZIP per AGI size class (6 brackets); the importer sums the brackets to a per-ZIP total. 344 of 370 DFW ZIPs have data — the IRS suppresses or aggregates ZIPs with too few returns to protect taxpayer privacy.' },
                { label: 'Metrics', definition: 'Avg gift per giving return = total charitable contributions (A19700) ÷ returns that claimed a charitable deduction (N19700). Charitable share of AGI = A19700 ÷ total AGI (A00100). Itemizer rate = returns itemizing (N04470) ÷ all returns (N1). All amounts are reported by the IRS in thousands of dollars; counts are rounded to the nearest 10.' },
                { label: 'TCJA caveat (important)', definition: 'The 2017 Tax Cuts and Jobs Act roughly doubled the standard deduction, so post-2017 only ~10% of filers itemize — and charitable contributions are only visible on the return when a filer itemizes. This means SOI charitable data captures a minority of giving and skews heavily toward higher-income households who still itemize. It is a RELATIVE generosity signal between ZIPs, never a measure of total giving, and the itemizer rate is shown alongside it so the skew is visible.' },
                { label: 'Scoring use', definition: 'Currently context/display only on the Demographics page. Adding it to the Site Scorer as a "generosity/capacity" weight is a deliberate scoring-model change reserved for a [HUMAN] decision (per the scoring-governance rules — max ~8 signals, each must name the decision it informs).' },
              ].map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>

          {/* HUD USPS Address Momentum */}
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '10px' }}>
              5.6 · Address Momentum (HUD USPS) · pending data load
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Source', definition: 'HUD Aggregated USPS Administrative Data on Address Vacancies — quarterly counts of residential addresses (total, vacant, no-stat) compiled by the USPS and released by HUD. This is a licensed dataset available only to governmental and non-profit organizations via registration and a manual quarterly download; it is distinct from the free HUD-USPS ZIP crosswalk API, which returns only allocation ratios (no raw counts). Import script: scripts/import-hud-usps.ts.' },
                { label: 'Geography', definition: 'ZIP code level (true USPS ZIPs, not ZCTA approximations — this is one of the few genuinely ZIP-native sources in the platform).' },
                { label: 'Active residential', definition: 'Active residential addresses ≈ total residential addresses − vacant − no-stat: addresses currently receiving mail (mail collected within the prior ~90 days). Rising active addresses signal new occupancy/construction before it appears in ACS.' },
                { label: 'Address momentum', definition: 'Trailing 4-quarter percentage change in active residential addresses for the ZIP, shown on the Demographics page alongside ACS growth. Until 5 quarters are loaded, a quarter-over-quarter change is shown as a fallback.' },
                { label: 'Status & scoring', definition: 'Scaffold built; awaiting the first [HUMAN] data download. Context tier — not a Site Scorer input. Per the scoring-governance rules, it would only be considered for scoring after validation against known-growth ZIPs (Celina, Princeton, Forney should light up first).' },
              ].map(m => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: '2px solid #232940' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C8D4E4', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#8A98AE', lineHeight: 1.6 }}>{m.definition}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
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
    vintage: 'Trailing 36 months',
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
  {
    source: '2020 U.S. Religion Census (ASARB)',
    geo: 'County (23 DFW counties)',
    vintage: '2020',
    refresh: 'Decennial (~2030)',
    usedFor: 'Religious adherence by tradition: Unclaimed, Evangelical, Catholic, Muslim, Jewish, etc.',
  },
  {
    source: 'Census BPS (Building Permits Survey)',
    geo: 'County',
    vintage: '2025 annual (released May 2026)',
    refresh: 'Annually',
    usedFor: 'Building permit momentum on Demographics page; leading indicator for new residential construction',
  },
  {
    source: 'TEA PEIMS (Texas Education Agency)',
    geo: 'ISD (county-aggregated)',
    vintage: '2020-21 → 2024-25',
    refresh: 'Annually (~March for prior fall)',
    usedFor: 'School district enrollment trend on Demographics page; enrollment growth score in Site Scorer',
  },
  {
    source: 'Texas Demographic Center Projections',
    geo: 'County',
    vintage: 'Vintage 2024 (2020–2060)',
    refresh: 'Every ~2 years',
    usedFor: '2030/2040 county population projections on Demographics page (context only, not scored)',
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
      { label: 'Consumer Complaints', definition: 'Count of consumer complaints submitted to the CFPB Consumer Complaint Database for the ZIP code in the trailing 36 months. Includes complaints on mortgages, credit cards, debt collection, and other financial products. High counts may reflect population size as much as distress — use per-1,000 residents figure for comparison.' },
    ],
  },
  {
    group: 'Religious Landscape',
    metrics: [
      { label: 'Religious Organizations', definition: 'Active tax-exempt organizations from the IRS Exempt Organizations Business Master File filtered to NTEE major group X (Religion-Related). Classified by NTEE subcategory: X20 Christian, X21 Protestant, X22 Roman Catholic, X30 Jewish, X40 Islamic, X50 Buddhist, X70 Hindu. Ruling year is the year the IRS recognized the organization\'s tax-exempt status. MEASURED confidence — directly counted from federal filings.' },
      { label: 'Churches per 10K', definition: 'Count of NTEE X20/X21/X22-coded organizations in the ZIP ÷ population × 10,000. Used as a church saturation proxy. Treat as a relative ranking tool — see Known Limitations.' },
      { label: 'Religious Adherence by Tradition', definition: 'County-level adherent estimates from the 2020 U.S. Religion Census (ASARB). Traditions follow the Steensland et al. RELTRAD schema. "Unclaimed" = county population minus all reported adherents — represents people not affiliated with any counted congregation. ESTIMATE confidence — congregation-reported counts, not individual survey responses. County level only; do not interpret as ZIP-level data.' },
      { label: 'Muslim Community Presence Proxy', definition: 'ZIP-level proxy computed from two ACS 5-Year 2023 signals: (1) proxy_born — sum of B05006 foreign-born from 20 predominantly Muslim-majority countries; (2) proxy_language — C16001_033E Arabic speakers. Shown as raw count and per-1,000 residents. PROXY confidence — directional signal only, not a Muslim population count. See the Religious Landscape — Data & Methodology section for the full country list and required caveats.' },
    ],
  },
]

const PROXY_COUNTRIES = [
  { country: 'Afghanistan',                                       variable: 'B05006_057E', flagged: false, note: '' },
  { country: 'Bangladesh',                                        variable: 'B05006_058E', flagged: false, note: '' },
  { country: 'Pakistan',                                          variable: 'B05006_064E', flagged: false, note: '' },
  { country: 'Uzbekistan',                                        variable: 'B05006_066E', flagged: false, note: '' },
  { country: 'Iraq',                                              variable: 'B05006_083E', flagged: true,  note: 'Chaldean Catholic & Assyrian Christian minority' },
  { country: 'Jordan',                                            variable: 'B05006_085E', flagged: false, note: '' },
  { country: 'Kuwait',                                            variable: 'B05006_086E', flagged: false, note: '' },
  { country: 'Saudi Arabia',                                      variable: 'B05006_088E', flagged: false, note: '' },
  { country: 'Syria',                                             variable: 'B05006_089E', flagged: true,  note: 'Syrian Christian & Alawi minority' },
  { country: 'Turkey',                                            variable: 'B05006_090E', flagged: false, note: '' },
  { country: 'UAE',                                               variable: 'B05006_091E', flagged: false, note: '' },
  { country: 'Yemen',                                             variable: 'B05006_092E', flagged: false, note: '' },
  { country: 'Other Western Asia (Bahrain, Qatar, Oman, W. Bank/Gaza)', variable: 'B05006_093E', flagged: false, note: 'Grouped — cannot isolate individually' },
  { country: 'Somalia',                                           variable: 'B05006_100E', flagged: false, note: '' },
  { country: 'Algeria',                                           variable: 'B05006_111E', flagged: false, note: '' },
  { country: 'Egypt',                                             variable: 'B05006_112E', flagged: true,  note: 'Coptic Orthodox community (~10% of Egyptian diaspora)' },
  { country: 'Morocco',                                           variable: 'B05006_113E', flagged: false, note: '' },
  { country: 'Sudan',                                             variable: 'B05006_114E', flagged: false, note: '' },
  { country: 'Other Northern Africa (Libya, Tunisia, others)',    variable: 'B05006_115E', flagged: false, note: 'Grouped — Libya & Tunisia not individually listed in B05006' },
  { country: 'Senegal',                                           variable: 'B05006_125E', flagged: false, note: '' },
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
    limitation: 'Complaint counts use a trailing 36-month window, which keeps the metric current but means counts will shift as old complaints age out. A high-population ZIP will generally generate more complaints than a low-population one regardless of financial distress. The per-1,000-residents normalization shown on the Community Needs page partially corrects for this, but complaint propensity also varies by awareness of the CFPB and by the types of financial products prevalent in the area.',
  },
  {
    source: 'College Scorecard',
    limitation: 'The Scorecard API returns schools within a specified radius of the ZIP centroid. Schools near the edge of the radius may appear or disappear depending on slight centroid placement differences. Trade and vocational schools (ICLEVEL=3) are filtered from display but are still present in the underlying data. The platform uses a 10-mile radius by default.',
  },
  {
    source: 'SES Class Score',
    limitation: 'The SES composite is sensitive to the income and home value caps ($200K and $800K). ZIPs above these caps are all scored identically on those components. The score is designed to differentiate the middle of the DFW distribution — it is not intended to rank the wealthiest ZIPs against each other.',
  },
  {
    source: '2020 U.S. Religion Census (ASARB)',
    limitation: 'County-level data only — figures cannot be disaggregated to ZIP codes. Muslim adherence estimates are modeled from congregation-reported counts for participating Islamic bodies; mosques that did not participate are not counted. Non-participating denominations across all traditions are systematically undercounted. "Unclaimed" does not mean irreligious — it captures both the nonreligious and members of non-participating congregations. The 2020 vintage reflects pre-pandemic religious affiliation patterns; post-2020 congregation changes are not captured until the next decennial release (~2030).',
  },
  {
    source: 'ACS Proxy — Muslim Community Presence',
    limitation: 'The proxy_born column overcounts non-Muslims from Iraq (Chaldean Catholic, Assyrian Christian), Egypt (Coptic Orthodox), and Syria (Syrian Christian), who may represent 5–20% of those countries\' DFW diaspora populations. The proxy undercounts U.S.-born Muslims of all backgrounds — including African American Muslims and converts — who will not appear in ACS birthplace tables. The Arabic-speaker column (C16001) is limited to Arabic because B16001 (which includes Urdu, Bengali, and Somali separately) is not released at the ZCTA level. Use these figures only as a directional geographic signal for community planning, not as a population estimate.',
  },
  {
    source: 'Census BPS — Building Permits',
    limitation: 'BPS permit data is available only at the county level (no ZIP granularity). A county\'s permit total is mapped to all ZIPs in that county equally — the permit momentum shown on the Demographics page reflects the county as a whole, not the specific ZIP. Single-family and multifamily units are reported separately; the momentum badge uses total units. Permits authorized do not always correspond to units built (projects may be cancelled or delayed). The 2025 annual file (released May 2026) is the most recent vintage loaded.',
  },
  {
    source: 'TEA PEIMS — School Enrollment',
    limitation: 'Enrollment figures are aggregated to the county level from individual ISDs. A county with both a fast-growing suburban ISD and a declining urban ISD will show a blended CAGR that may not reflect the ZIP\'s specific ISD. The TEA October enrollment snapshot is used; it reflects enrollment at the start of the school year, not the full-year average. Some districts straddle county lines — they are assigned to their primary county in this dataset.',
  },
  {
    source: 'Texas Demographic Center Projections',
    limitation: 'Projections use the mid-migration scenario from TDC Vintage 2024. They are county-level only and cannot be disaggregated to ZIP codes. Projections become less reliable further from the base year — the 2040 figure has substantially more uncertainty than the 2030 figure. Projections do not account for economic shocks, major policy changes, or unforeseen demographic shifts. The platform uses these figures for context only; they are not incorporated into the Site Scorer.',
  },
  {
    source: 'IRS SOI — Giving Capacity',
    limitation: 'Charitable contributions are only reported when a filer itemizes deductions, and after the 2017 TCJA roughly doubled the standard deduction, only ~10% of filers itemize. The data therefore captures a minority of actual giving and skews toward higher-income households — it is a relative signal between ZIPs, not a giving total, and the itemizer rate is shown alongside it. The IRS rounds counts to the nearest 10 and suppresses/aggregates small ZIPs (344 of 370 DFW ZIPs have data). In low-population ZIPs the "average gift per giving return" can be dominated by a handful of very large donors and is volatile year to year. Tax Year 2022 is the latest release (data lags ~2–3 years). Context tier only; not currently a Site Scorer input.',
  },
  {
    source: 'HUD USPS — Address Momentum',
    limitation: 'Counts addresses, not people or housing units — a single address node serving a gated community or mobile-home park is one record regardless of how many homes sit behind it (HUD now reports "drop counts" for these, but coverage is imperfect). "Active" is defined by recent mail collection, so seasonal/second homes and temporarily-vacant units shift the count. The data is released quarterly with a lag and is a licensed gov/nonprofit dataset (manual download, not an API). It is the freshest growth signal available but is shown as context only and must be validated against known-growth ZIPs before any consideration for scoring. Awaiting first data load as of this writing.',
  },
  {
    source: 'LEHD LODES — Commute Corridors',
    limitation: 'LODES counts jobs, not people, and a worker with two jobs is counted twice. The vintage lags ~2 years (2023 is the latest, released Dec 2025) and excludes most federal and uniformed-military workers and self-employed/informal jobs, which are absent from the unemployment-insurance records LODES is built on. Home and work are assigned to census blocks via a model with synthetic noise added for confidentiality, then aggregated up to ZCTA — block-level figures are noisy, but ZCTA aggregates are stable. Only flows where both ends fall inside the DFW coverage area are kept, so a ZIP\'s residents who work outside the metro are not reflected in its totals. The "net commute direction" is a job-weighted average bearing; a ZIP whose workers split between two opposite job centers can show a low concentration and a direction that points between them. Context only — never a Site Scorer input.',
  },
]
