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
  accent = 'green',
  loading = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'orange' | 'blue' | 'purple' | 'gold'
  loading?: boolean
}) {
  const accentColors = {
    green: '#00e5a0',
    orange: '#ff6b35',
    blue: '#4da6ff',
    purple: '#a78bfa',
    gold: '#f59e0b',
  }
  const color = accentColors[accent]
 
  return (
    <div style={{
      background: '#12161e',
      border: '1px solid #1e2430',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: color,
      }} />
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase' as const,
        color: '#5a6272',
        marginBottom: '8px',
      }}>
        {label}
      </div>
      {loading ? (
        <div style={{
          height: '36px',
          background: '#1e2430',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ) : (
        <>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '32px',
            lineHeight: 1,
            letterSpacing: '0.02em',
            color: '#e8edf5',
          }}>
            {value}
          </div>
          {sub && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              color: '#5a6272',
              marginTop: '6px',
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
      borderLeft: '3px solid #00e5a0',
      paddingLeft: '16px',
      marginBottom: '20px',
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px',
        letterSpacing: '0.2em',
        color: '#00e5a0',
        textTransform: 'uppercase' as const,
        marginBottom: '4px',
      }}>
        {eyebrow}
      </div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '28px',
        letterSpacing: '0.03em',
        lineHeight: 1,
        color: '#e8edf5',
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
 
  // Fetch Census on ZIP change
  useEffect(() => {
    setLoadingCensus(true)
    setCensus(null)
    fetch(`/api/census?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { setCensus(d); setLoadingCensus(false) })
      .catch(() => setLoadingCensus(false))
  }, [selectedZip])
 
  // Fetch BLS once
  useEffect(() => {
    fetch('/api/bls')
      .then(r => r.json())
      .then(d => { setBls(d); setLoadingBls(false) })
      .catch(() => setLoadingBls(false))
  }, [])
 
  // Fetch FRED once
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0a0d12;
          color: #e8edf5;
          font-family: 'IBM Plex Sans', -apple-system, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          min-height: 100vh;
        }
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.015) 39px, rgba(255,255,255,0.015) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.015) 39px, rgba(255,255,255,0.015) 40px);
          pointer-events: none;
          z-index: 0;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .zip-btn {
          background: #12161e;
          border: 1px solid #1e2430;
          color: #5a6272;
          padding: 6px 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.05em;
        }
        .zip-btn:hover { border-color: #00e5a0; color: #00e5a0; }
        .zip-btn.active {
          background: rgba(0,229,160,0.1);
          border-color: #00e5a0;
          color: #00e5a0;
        }
        .data-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #1e2430;
        }
        .data-row:last-child { border-bottom: none; }
        .data-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #5a6272;
          letter-spacing: 0.05em;
        }
        .data-value {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          color: #e8edf5;
          font-weight: 600;
        }
        .nav-link {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #5a6272;
          text-decoration: none;
          padding: 6px 0;
          border-bottom: 1px solid transparent;
          transition: all 0.15s;
          cursor: pointer;
        }
        .nav-link:hover, .nav-link.active { color: #00e5a0; border-bottom-color: #00e5a0; }
        .panel {
          background: #12161e;
          border: 1px solid #1e2430;
          padding: 24px;
        }
      `}</style>
 
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
 
        {/* ── Top Bar ── */}
        <div style={{
          borderBottom: '1px solid #1e2430',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '52px',
          background: 'rgba(10,13,18,0.95)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '18px',
              letterSpacing: '0.08em',
              color: '#e8edf5',
            }}>
              CIP
            </div>
            <div style={{ width: '1px', height: '20px', background: '#1e2430' }} />
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: '#5a6272',
              textTransform: 'uppercase',
            }}>
              Community Intelligence Platform
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {['Overview', 'Demographics', 'SES Classes', 'Compare', 'Religious', 'Employers', 'Site Scorer'].map((item, i) => (
              <span key={item} className={`nav-link${i === 0 ? ' active' : ''}`}>{item}</span>
            ))}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: '#5a6272',
            letterSpacing: '0.1em',
          }}>
            LAKEPOINTE CHURCH · DFW
          </div>
        </div>
 
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
 
          {/* ── Page Header ── */}
          <div className="fade-in" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.25em',
                color: '#00e5a0',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                Dashboard · Overview
              </div>
              <h1 style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(36px, 5vw, 56px)',
                letterSpacing: '0.04em',
                lineHeight: 0.95,
                color: '#e8edf5',
              }}>
                DFW Community<br />Intelligence
              </h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                color: '#5a6272',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Data refreshed
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px',
                color: '#b0b8c8',
                marginTop: '2px',
              }}>
                {lastUpdated}
              </div>
              <div style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'flex-end',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e5a0' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00e5a0', letterSpacing: '0.1em' }}>
                  LIVE DATA
                </span>
              </div>
            </div>
          </div>
 
          {/* ── DFW Metro KPIs ── */}
          <div className="fade-in" style={{ marginBottom: '32px' }}>
            <SectionHeader eyebrow="DFW Metro · Real-Time" title="Regional Snapshot" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <StatCard
                label="Metro Population"
                value={fred?.population?.latest?.value ? fmtK(parseFloat(fred.population.latest.value) * 1000) : '—'}
                sub={fred?.population?.latest?.date ? `as of ${fred.population.latest.date.substring(0, 4)}` : 'Source: FRED'}
                accent="green"
                loading={loadingFred}
              />
              <StatCard
                label="DFW Unemployment"
                value={bls?.unemploymentRate?.latest ? `${bls.unemploymentRate.latest}%` : '—'}
                sub={bls?.unemploymentRate ? `${bls.unemploymentRate.period} ${bls.unemploymentRate.year}` : 'Source: BLS'}
                accent="blue"
                loading={loadingBls}
              />
              <StatCard
                label="Employed Persons"
                value={bls?.employedPersons?.latest ? fmtK(parseInt(bls.employedPersons.latest)) : '—'}
                sub="DFW Metro · BLS"
                accent="green"
                loading={loadingBls}
              />
              <StatCard
                label="Housing Permits"
                value={fred?.housingPermits?.latest?.value ?? '—'}
                sub="Dallas Area · FRED"
                accent="gold"
                loading={loadingFred}
              />
            </div>
          </div>
 
          {/* ── ZIP Selector + ZIP Stats ── */}
          <div className="fade-in" style={{ marginBottom: '32px' }}>
            <SectionHeader eyebrow="ZIP Code · ACS 5-Year" title="ZIP Profile" />
 
            {/* ZIP Selector */}
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
 
            {/* ZIP Data Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
 
              {/* Left — Key Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <StatCard
                  label="Population"
                  value={census ? fmtK(census.population) : '—'}
                  sub={`ZIP ${selectedZip} · ${selectedLabel}`}
                  accent="green"
                  loading={loadingCensus}
                />
                <StatCard
                  label="Median HH Income"
                  value={census ? `$${fmtK(census.medianHouseholdIncome)}` : '—'}
                  sub="ACS 5-Year Estimate"
                  accent="gold"
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
                  sub="Labor force basis"
                  accent={parseFloat(census?.unemploymentRate || '0') > 5 ? 'orange' : 'green'}
                  loading={loadingCensus}
                />
              </div>
 
              {/* Right — Detail Panel */}
              <div className="panel">
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '9px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#5a6272',
                  marginBottom: '16px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #1e2430',
                }}>
                  ZIP {selectedZip} · Full Profile · U.S. Census Bureau ACS
                </div>
 
                {loadingCensus ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ height: '20px', background: '#1e2430', animation: 'pulse 1.5s ease-in-out infinite' }} />
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
                      <span className="data-value" style={{ color: '#f59e0b' }}>{fmt(census.medianHouseholdIncome, 'currency')}</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Median Home Value</span>
                      <span className="data-value" style={{ color: '#4da6ff' }}>{fmt(census.medianHomeValue, 'currency')}</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Bachelor's Degree+</span>
                      <span className="data-value">{census.bachelorsRate}%</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Unemployment Rate</span>
                      <span className="data-value" style={{ color: parseFloat(census.unemploymentRate) > 5 ? '#ff6b35' : '#00e5a0' }}>
                        {census.unemploymentRate}%
                      </span>
                    </div>
                    <div style={{
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid #1e2430',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '9px',
                      color: '#5a6272',
                      letterSpacing: '0.05em',
                    }}>
                      Source: U.S. Census Bureau · American Community Survey 5-Year Estimates (2023)
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#5a6272' }}>
                    No data available for this ZIP code.
                  </div>
                )}
              </div>
            </div>
          </div>
 
          {/* ── Data Sources Footer ── */}
          <div className="fade-in" style={{
            borderTop: '1px solid #1e2430',
            paddingTop: '20px',
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#5a6272',
            }}>
              Active Data Sources:
            </div>
            {[
              { label: 'Census ACS', status: !loadingCensus && !!census },
              { label: 'BLS LAUS', status: !loadingBls && !!bls },
              { label: 'FRED', status: !loadingFred && !!fred },
            ].map(({ label, status }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: status ? '#00e5a0' : '#5a6272',
                }} />
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '9px',
                  color: status ? '#b0b8c8' : '#5a6272',
                  letterSpacing: '0.05em',
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
 
        </div>
      </div>
    </>
  )
}