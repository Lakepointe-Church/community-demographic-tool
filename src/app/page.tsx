'use client'
 
import { useState, useEffect } from 'react'
 
// ── Types ────────────────────────────────────────────────────
interface CensusData {
  zip: string
  name: string
  population: number
  medianHouseholdIncome: number
  medianHomeValue: number
  unemploymentRate: string
  bachelorsRate: string
  totalHouseholds: number
}
 
interface BLSData {
  area: string
  unemploymentRate: { latest: string; period: string; year: string }
  employedPersons: { latest: string }
  laborForce: { latest: string }
}
 
interface FREDData {
  population: { latest: { value: string; date: string } }
  housingPermits: { latest: { value: string; date: string } }
}
 
// ── Constants ────────────────────────────────────────────────
const DFW_ZIPS = [
  { zip: '75032', label: 'Rockwall' },
  { zip: '75087', label: 'Rockwall N' },
  { zip: '75189', label: 'Royse City' },
  { zip: '75098', label: 'Wylie' },
  { zip: '75002', label: 'Allen' },
  { zip: '75013', label: 'Allen E' },
  { zip: '75023', label: 'Plano N' },
  { zip: '75025', label: 'Plano NE' },
  { zip: '75034', label: 'Frisco' },
  { zip: '75035', label: 'Frisco E' },
]
 
// ── Lakepointe Brand Palette ─────────────────────────────────
// Primary: warm gold #E8B84B (Lakepointe yellow)
// Dark bg: #0d0f14 (deeper than before, richer)
// Surface: #13161f
// Accent2: #4EAEFF (cool blue for data)
// Accent3: #FF6B6B (warm coral for alerts)
// Text: #F0F2F7 (warmer white, easier on eyes)
// Text2: #9BA5B7 (more readable muted)
 
// ── Helpers ──────────────────────────────────────────────────
function fmt(n: number, style: 'currency' | 'decimal' = 'decimal') {
  if (!n || n < 0) return '—'
  if (style === 'currency') return '$' + n.toLocaleString()
  return n.toLocaleString()
}
 
function fmtK(n: number) {
  if (!n || n < 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
 
// ── Stat Card ────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent = 'gold',
  loading = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'gold' | 'blue' | 'coral' | 'teal' | 'purple'
  loading?: boolean
}) {
  const colors = {
    gold: '#E8B84B',
    blue: '#4EAEFF',
    coral: '#FF6B6B',
    teal: '#2DD4BF',
    purple: '#A78BFA',
  }
  const color = colors[accent]
 
  return (
    <div style={{
      background: '#13161f',
      border: '1px solid #1e2433',
      padding: '22px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: color,
      }} />
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        color: '#9BA5B7',
        marginBottom: '10px',
      }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: '40px', background: '#1e2433', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '36px',
            lineHeight: 1,
            letterSpacing: '0.03em',
            color: '#F0F2F7',
          }}>
            {value}
          </div>
          {sub && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              color: '#6B7689',
              marginTop: '8px',
              letterSpacing: '0.04em',
            }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  )
}
 
// ── Section Header ───────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{
      borderLeft: '3px solid #E8B84B',
      paddingLeft: '16px',
      marginBottom: '20px',
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px',
        letterSpacing: '0.18em',
        color: '#E8B84B',
        textTransform: 'uppercase' as const,
        marginBottom: '5px',
      }}>
        {eyebrow}
      </div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '26px',
        letterSpacing: '0.04em',
        lineHeight: 1,
        color: '#F0F2F7',
      }}>
        {title}
      </div>
    </div>
  )
}
 
// ── Main Page ────────────────────────────────────────────────
export default function OverviewPage() {
  const [selectedZip, setSelectedZip] = useState('75032')
  const [census, setCensus] = useState<CensusData | null>(null)
  const [bls, setBls] = useState<BLSData | null>(null)
  const [fred, setFred] = useState<FREDData | null>(null)
  const [loadingCensus, setLoadingCensus] = useState(true)
  const [loadingBls, setLoadingBls] = useState(true)
  const [loadingFred, setLoadingFred] = useState(true)
  const [lastUpdated] = useState(new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }))
 
  useEffect(() => {
    setLoadingCensus(true)
    setCensus(null)
    fetch(`/api/census?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { setCensus(d); setLoadingCensus(false) })
      .catch(() => setLoadingCensus(false))
  }, [selectedZip])
 
  useEffect(() => {
    fetch('/api/bls')
      .then(r => r.json())
      .then(d => { setBls(d); setLoadingBls(false) })
      .catch(() => setLoadingBls(false))
  }, [])
 
  useEffect(() => {
    fetch('/api/fred')
      .then(r => r.json())
      .then(d => { setFred(d); setLoadingFred(false) })
      .catch(() => setLoadingFred(false))
  }, [])
 
  const selectedLabel = DFW_ZIPS.find(z => z.zip === selectedZip)?.label || selectedZip
 
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
 
        body {
          background: #0d0f14;
          color: #F0F2F7;
          font-family: 'IBM Plex Sans', -apple-system, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          min-height: 100vh;
        }
 
        /* Subtle dot-grid background — more refined than a line grid */
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: radial-gradient(circle, rgba(232,184,75,0.06) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 0;
        }
 
        /* Warm vignette to frame the page */
        body::after {
          content: '';
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(232,184,75,0.04) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }
 
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .fade-up-2 { animation: fadeUp 0.5s 0.1s ease forwards; opacity: 0; }
        .fade-up-3 { animation: fadeUp 0.5s 0.2s ease forwards; opacity: 0; }
 
        .zip-btn {
          background: transparent;
          border: 1px solid #1e2433;
          color: #9BA5B7;
          padding: 7px 14px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: '11px';
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: 0.06em;
          font-size: 11px;
          white-space: nowrap;
        }
        .zip-btn:hover {
          border-color: #E8B84B;
          color: #E8B84B;
          background: rgba(232,184,75,0.06);
        }
        .zip-btn.active {
          background: rgba(232,184,75,0.12);
          border-color: #E8B84B;
          color: #E8B84B;
        }
 
        .data-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 11px 0;
          border-bottom: 1px solid #1a1f2e;
        }
        .data-row:last-child { border-bottom: none; }
        .data-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #9BA5B7;
          letter-spacing: 0.04em;
        }
        .data-value {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          color: #F0F2F7;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
 
        .nav-item {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6B7689;
          padding: 6px 2px;
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
          cursor: pointer;
          white-space: nowrap;
          text-decoration: none;
        }
        .nav-item:hover { color: #E8B84B; }
        .nav-item.active {
          color: #E8B84B;
          border-bottom-color: #E8B84B;
        }
 
        .panel {
          background: #13161f;
          border: 1px solid #1e2433;
          padding: 24px;
        }
 
        .source-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          color: #6B7689;
          letter-spacing: 0.06em;
        }
        .source-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }
      `}</style>
 
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
 
        {/* ── Top Bar ── */}
        <div style={{
          borderBottom: '1px solid #1a1f2e',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '54px',
          background: 'rgba(13,15,20,0.96)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          gap: '16px',
        }}>
          {/* Logo / Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '20px',
              letterSpacing: '0.1em',
              color: '#E8B84B',
            }}>
              LAKEPOINTE
            </div>
            <div style={{ width: '1px', height: '18px', background: '#1e2433' }} />
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.18em',
              color: '#6B7689',
              textTransform: 'uppercase',
            }}>
              Community Intelligence
            </div>
          </div>
 
          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {[
              { label: 'Overview', active: true },
              { label: 'Demographics' },
              { label: 'SES Classes' },
              { label: 'Compare' },
              { label: 'Religious' },
              { label: 'Employers' },
              { label: 'Site Scorer' },
            ].map(({ label, active }) => (
              <span key={label} className={`nav-item${active ? ' active' : ''}`}>
                {label}
              </span>
            ))}
          </div>
 
          {/* Right badge */}
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: '#6B7689',
            letterSpacing: '0.1em',
            flexShrink: 0,
          }}>
            DFW · 2026
          </div>
        </div>
 
        <div style={{ padding: '36px 32px', maxWidth: '1440px', margin: '0 auto' }}>
 
          {/* ── Page Header ── */}
          <div className="fade-up" style={{
            marginBottom: '36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}>
            <div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.22em',
                color: '#E8B84B',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}>
                Dashboard · Overview
              </div>
              <h1 style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(40px, 5vw, 62px)',
                letterSpacing: '0.05em',
                lineHeight: 0.92,
                color: '#F0F2F7',
              }}>
                DFW Community<br />Intelligence
              </h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                color: '#6B7689',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                Data Refreshed
              </div>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '13px',
                fontWeight: 500,
                color: '#C8D0DC',
              }}>
                {lastUpdated}
              </div>
              <div style={{
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                justifyContent: 'flex-end',
              }}>
                <div style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#2DD4BF',
                  boxShadow: '0 0 6px rgba(45,212,191,0.6)',
                }} />
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '9px',
                  color: '#2DD4BF',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  Live Data
                </span>
              </div>
            </div>
          </div>
 
          {/* ── DFW Metro KPIs ── */}
          <div className="fade-up-2" style={{ marginBottom: '36px' }}>
            <SectionHeader eyebrow="DFW Metro · Real-Time Feeds" title="Regional Snapshot" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <StatCard
                label="Metro Population"
                value={fred?.population?.latest?.value
                  ? fmtK(parseFloat(fred.population.latest.value) * 1000)
                  : '—'}
                sub={fred?.population?.latest?.date
                  ? `Est. ${fred.population.latest.date.substring(0, 4)} · FRED`
                  : 'Source: FRED'}
                accent="gold"
                loading={loadingFred}
              />
              <StatCard
                label="DFW Unemployment"
                value={bls?.unemploymentRate?.latest ? `${bls.unemploymentRate.latest}%` : '—'}
                sub={bls?.unemploymentRate
                  ? `${bls.unemploymentRate.period} ${bls.unemploymentRate.year} · BLS`
                  : 'Source: BLS LAUS'}
                accent="blue"
                loading={loadingBls}
              />
              <StatCard
                label="Employed Persons"
                value={bls?.employedPersons?.latest
                  ? fmtK(parseInt(bls.employedPersons.latest))
                  : '—'}
                sub="DFW Metro · Bureau of Labor Statistics"
                accent="teal"
                loading={loadingBls}
              />
              <StatCard
                label="Housing Permits"
                value={fred?.housingPermits?.latest?.value ?? '—'}
                sub="Dallas Area · Federal Reserve (FRED)"
                accent="purple"
                loading={loadingFred}
              />
            </div>
          </div>
 
          {/* ── ZIP Selector + Profile ── */}
          <div className="fade-up-3" style={{ marginBottom: '36px' }}>
            <SectionHeader eyebrow="ZIP Code · ACS 5-Year Estimates" title="ZIP Profile" />
 
            {/* ZIP Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {DFW_ZIPS.map(({ zip, label }) => (
                <button
                  key={zip}
                  className={`zip-btn${selectedZip === zip ? ' active' : ''}`}
                  onClick={() => setSelectedZip(zip)}
                >
                  {zip} · {label}
                </button>
              ))}
            </div>
 
            {/* Data Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
 
              {/* Left — Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <StatCard
                  label="Population"
                  value={census ? fmtK(census.population) : '—'}
                  sub={`ZIP ${selectedZip} · ${selectedLabel}`}
                  accent="gold"
                  loading={loadingCensus}
                />
                <StatCard
                  label="Median HH Income"
                  value={census ? `$${fmtK(census.medianHouseholdIncome)}` : '—'}
                  sub="ACS 5-Year Estimate"
                  accent="teal"
                  loading={loadingCensus}
                />
                <StatCard
                  label="Median Home Value"
                  value={census ? `$${fmtK(census.medianHomeValue)}` : '—'}
                  sub="ACS 5-Year Estimate"
                  accent="blue"
                  loading={loadingCensus}
                />
                <StatCard
                  label="Unemployment Rate"
                  value={census?.unemploymentRate ? `${census.unemploymentRate}%` : '—'}
                  sub="Labor force basis · ACS"
                  accent={parseFloat(census?.unemploymentRate || '0') > 5 ? 'coral' : 'teal'}
                  loading={loadingCensus}
                />
              </div>
 
              {/* Right — Detail Panel */}
              <div className="panel">
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#9BA5B7',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #1a1f2e',
                }}>
                  ZIP {selectedZip} · Full Profile · U.S. Census Bureau ACS 2023
                </div>
 
                {loadingCensus ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1,2,3,4,5,6,7].map(i => (
                      <div key={i} style={{
                        height: '18px',
                        background: '#1e2433',
                        borderRadius: '2px',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        animationDelay: `${i * 0.08}s`,
                        width: i % 2 === 0 ? '70%' : '100%',
                        alignSelf: i % 2 === 0 ? 'flex-end' : 'auto',
                      }} />
                    ))}
                  </div>
                ) : census ? (
                  <>
                    <div className="data-row">
                      <span className="data-label">Geography</span>
                      <span className="data-value">{census.name}</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Total Population</span>
                      <span className="data-value">{fmt(census.population)}</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Total Households</span>
                      <span className="data-value">{fmt(census.totalHouseholds)}</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Median HH Income</span>
                      <span className="data-value" style={{ color: '#E8B84B' }}>
                        {fmt(census.medianHouseholdIncome, 'currency')}
                      </span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Median Home Value</span>
                      <span className="data-value" style={{ color: '#4EAEFF' }}>
                        {fmt(census.medianHomeValue, 'currency')}
                      </span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Bachelor's Degree+</span>
                      <span className="data-value">{census.bachelorsRate}%</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Unemployment Rate</span>
                      <span className="data-value" style={{
                        color: parseFloat(census.unemploymentRate) > 5 ? '#FF6B6B' : '#2DD4BF'
                      }}>
                        {census.unemploymentRate}%
                      </span>
                    </div>
                    <div style={{
                      marginTop: '18px',
                      paddingTop: '14px',
                      borderTop: '1px solid #1a1f2e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span className="source-badge">
                        <span className="source-dot" style={{ background: '#E8B84B' }} />
                        U.S. Census Bureau · ACS 5-Year (2023)
                      </span>
                      <span className="source-badge">
                        api.census.gov
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '12px',
                    color: '#6B7689',
                    padding: '16px 0',
                  }}>
                    No data available for ZIP {selectedZip}.
                  </div>
                )}
              </div>
            </div>
          </div>
 
          {/* ── Footer Bar ── */}
          <div style={{
            borderTop: '1px solid #1a1f2e',
            paddingTop: '20px',
            display: 'flex',
            gap: '28px',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#6B7689',
              }}>
                Active Sources
              </span>
              {[
                { label: 'Census ACS', ok: !loadingCensus && !!census },
                { label: 'BLS LAUS', ok: !loadingBls && !!bls },
                { label: 'FRED', ok: !loadingFred && !!fred },
              ].map(({ label, ok }) => (
                <div key={label} className="source-badge">
                  <span className="source-dot" style={{ background: ok ? '#2DD4BF' : '#6B7689' }} />
                  {label}
                </div>
              ))}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px',
              color: '#3a4154',
              letterSpacing: '0.08em',
            }}>
              Lakepointe Church · Community Intelligence Platform · Internal Use Only
            </div>
          </div>
 
        </div>
      </div>
    </>
  )
}