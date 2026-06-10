'use client'

import { useState, useEffect, lazy, Suspense } from 'react'

const MapboxChoropleth = lazy(() => import('@/components/MapboxChoropleth'))

interface ZipRow {
  zip: string
  label: string
  population: number
  populationGrowth: number | null
  medianHouseholdIncome: number
  hhWithChildrenPct: number | null
  avgHouseholdSize: number | null
  sesLabel: string
  sesScore: number
}

interface OverviewData {
  totals: {
    population: number
    zipCount: number
    avgGrowth: number | null
    wtdAvgHHI: number
    avgHHWithChildren: number | null
    avgHHSize: number | null
  }
  ageDistribution: { age0_17: number; age18_34: number; age35_54: number; age55_74: number; age75plus: number } | null
  incomeDistribution: { label: string; pct: number }[]
  zips: ZipRow[]
  updatedAt: string
}

function fmtK(n: number) {
  if (!n || n < 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function growthColor(g: number | null) {
  if (g == null) return '#5a6478'
  if (g >= 20)   return '#2DD4BF'
  if (g >= 8)    return '#4EAEFF'
  if (g >= 0)    return '#8A98AE'
  return '#FF6B6B'
}

// ── Stat Card ────────────────────────────────────────────────────
const ACCENT_RGB: Record<string, string> = {
  gold: '232,184,75', blue: '78,174,255', teal: '45,212,191', purple: '167,139,250',
}

function StatCard({ label, value, sub, accent = 'gold', loading = false }: {
  label: string; value: string; sub?: string
  accent?: 'gold' | 'blue' | 'teal' | 'purple'
  loading?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const colors = { gold: '#E8B84B', blue: '#4EAEFF', teal: '#2DD4BF', purple: '#A78BFA' }
  const color = colors[accent]
  const rgb = ACCENT_RGB[accent]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.22) 0%, transparent 60%), linear-gradient(145deg, rgba(${rgb},0.08) 0%, rgba(255,255,255,0.01) 100%)`
          : `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.1) 0%, transparent 55%), linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`,
        border: `1px solid ${hovered ? `rgba(${rgb},0.4)` : '#232940'}`,
        padding: '24px',
        position: 'relative' as const,
        overflow: 'hidden',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        cursor: 'default',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color }} />
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#A8B4C5', marginBottom: '12px' }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: '44px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '44px', lineHeight: 1, letterSpacing: '0.03em', color: '#F0F2F7' }}>{value}</div>
          {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', marginTop: '8px', letterSpacing: '0.04em', transition: 'color 0.2s ease' }}>{sub}</div>}
        </>
      )}
    </div>
  )
}

// ── Section Header ───────────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ borderLeft: '3px solid #E8B84B', paddingLeft: '16px', marginBottom: '24px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.15em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{eyebrow}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '0.04em', lineHeight: 1, color: '#F0F2F7' }}>{title}</div>
    </div>
  )
}

const AGE_COLORS   = ['#4EAEFF', '#2DD4BF', '#E8B84B', '#A78BFA', '#FF6B6B']
const INCOME_COLORS = ['#8A98AE', '#FF6B6B', '#4EAEFF', '#2DD4BF', '#A78BFA', '#E8B84B']

// ── Generic Vertical Bar Chart ───────────────────────────────────
function BarChart({ data, loading, barColors }: {
  data: { label: string; pct: number }[]
  loading: boolean
  barColors?: string[]
}) {
  const maxPct = Math.max(...data.map(d => d.pct), 5)
  const barW = 56, gap = 12, chartH = 160, padL = 34, padTop = 22
  const totalW = data.length * (barW + gap) - gap

  return (
    <svg width={totalW + padL + 8} height={padTop + chartH + 40} style={{ overflow: 'visible' }}>
      <defs>
        {(barColors ?? ['#4EAEFF']).map((c, i) => (
          <linearGradient key={i} id={`bGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.9" />
            <stop offset="100%" stopColor={c} stopOpacity="0.2" />
          </linearGradient>
        ))}
      </defs>
      {[0, Math.round(maxPct / 2), Math.round(maxPct)].map(v => {
        const y = padTop + chartH - (v / maxPct) * chartH
        return (
          <g key={v}>
            <text x={padL - 5} y={y + 4} textAnchor="end" fill="#8A98AE" fontFamily="IBM Plex Mono" fontSize="10">{v}%</text>
            <line x1={padL} y1={y} x2={padL + totalW} y2={y} stroke="#1e2b3c" strokeWidth={1} strokeDasharray="3 3" />
          </g>
        )
      })}
      {data.map((d, i) => {
        const barH = loading ? 0 : (d.pct / maxPct) * chartH
        const x = padL + i * (barW + gap)
        const barColor = barColors?.[i] ?? '#4EAEFF'
        const gradIdx = barColors ? i : 0
        return (
          <g key={d.label}>
            <rect x={x} y={padTop + chartH - barH} width={barW} height={barH} fill={`url(#bGrad-${gradIdx})`} style={{ transition: 'all 0.6s ease' }} />
            <rect x={x} y={padTop + chartH - barH} width={barW} height={3} fill={barColor} />
            {!loading && d.pct > 0 && (
              <text x={x + barW / 2} y={padTop + chartH - barH - 7} textAnchor="middle" fill="#C8D4E4" fontFamily="IBM Plex Mono" fontSize="10">{d.pct.toFixed(1)}%</text>
            )}
            <text x={x + barW / 2} y={padTop + chartH + 18} textAnchor="middle" fill="#A8B4C5" fontFamily="IBM Plex Mono" fontSize="10">{d.label}</text>
          </g>
        )
      })}
      <line x1={padL} y1={padTop + chartH} x2={padL + totalW} y2={padTop + chartH} stroke="#232940" strokeWidth={1} />
    </svg>
  )
}

// ── SES Badge ────────────────────────────────────────────────────
function SEsBadge({ label }: { label: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    'Upper':        { bg: 'rgba(232,184,75,0.15)',  color: '#E8B84B' },
    'Upper Middle': { bg: 'rgba(78,174,255,0.15)',  color: '#4EAEFF' },
    'Middle':       { bg: 'rgba(45,212,191,0.15)',  color: '#2DD4BF' },
    'Lower Middle': { bg: 'rgba(255,107,107,0.15)', color: '#FF6B6B' },
    'Lower Income': { bg: 'rgba(138,152,174,0.15)', color: '#8A98AE' },
  }
  const s = styles[label] ?? styles['Lower Income']
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}`,
      padding: '3px 9px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '11px', letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </span>
  )
}

const CARD_SURFACE = 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'

// ── Page ─────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [data, setData]       = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [coverage, setCoverage] = useState<'core' | 'all'>('core')
  const [refreshKey, setRefreshKey] = useState(0)

  // Read initial coverage from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('coverage') === 'all') setCoverage('all')
  }, [])

  // Fetch whenever coverage or refresh button changes
  useEffect(() => {
    setLoading(true)
    fetch(`/api/overview?coverage=${coverage}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [coverage, refreshKey])

  function handleCoverageChange(val: 'core' | 'all') {
    setCoverage(val)
    const url = new URL(window.location.href)
    val === 'all' ? url.searchParams.set('coverage', 'all') : url.searchParams.delete('coverage')
    window.history.replaceState(null, '', url.toString())
  }

  const ageBands = data?.ageDistribution ? [
    { label: '0–17',  pct: data.ageDistribution.age0_17 },
    { label: '18–34', pct: data.ageDistribution.age18_34 },
    { label: '35–54', pct: data.ageDistribution.age35_54 },
    { label: '55–74', pct: data.ageDistribution.age55_74 },
    { label: '75+',   pct: data.ageDistribution.age75plus },
  ] : [
    { label: '0–17', pct: 0 }, { label: '18–34', pct: 0 }, { label: '35–54', pct: 0 },
    { label: '55–74', pct: 0 }, { label: '75+', pct: 0 },
  ]

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ padding: '40px 32px', maxWidth: '1440px', margin: '0 auto' }}>

        {/* Header */}
        <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '36px' }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
              Community Intelligence Platform — Lakepointe Church
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 5vw, 58px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
              {coverage === 'core' ? 'DFW Core MSA' : 'DFW Metro (All)'}<br />Overview
            </h1>
            <div style={{ width: '48px', height: '2px', background: 'linear-gradient(90deg, #E8B84B, rgba(232,184,75,0))', marginTop: '16px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            {/* Coverage + Refresh controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={coverage}
                onChange={e => handleCoverageChange(e.target.value as 'core' | 'all')}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.06em',
                  background: '#13161f', color: '#C8D4E4',
                  border: '1px solid #232940', borderRadius: '4px',
                  padding: '6px 10px', cursor: 'pointer', outline: 'none',
                  appearance: 'none' as const, WebkitAppearance: 'none' as const,
                }}
              >
                <option value="core">Core MSA · 11 counties</option>
                <option value="all">All ZIPs · Full coverage</option>
              </select>
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                title="Refresh data from database"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.06em',
                  background: 'transparent', color: '#8A98AE',
                  border: '1px solid #232940', borderRadius: '4px',
                  padding: '6px 10px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#C8D4E4'; e.currentTarget.style.borderColor = '#4EAEFF' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#8A98AE'; e.currentTarget.style.borderColor = '#232940' }}
              >
                ↺ Refresh
              </button>
            </div>
            {data?.updatedAt && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8A98AE', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '3px' }}>Data Refreshed</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', fontWeight: 500, color: '#C8D4E4' }}>
                  {new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Aggregate Stat Cards */}
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          <StatCard
            label="Total Population"
            value={data ? fmtK(data.totals.population) : '—'}
            sub={data?.totals.avgGrowth != null ? `↑ ${data.totals.avgGrowth}% avg growth` : undefined}
            accent="gold" loading={loading}
          />
          <StatCard
            label="ZIP Codes Tracked"
            value={data ? String(data.totals.zipCount) : '—'}
            sub={coverage === 'core' ? 'Core MSA (11 counties)' : 'All DFW coverage area'}
            accent="blue" loading={loading}
          />
          <StatCard
            label="Avg Median HHI"
            value={data ? `$${fmtK(data.totals.wtdAvgHHI)}` : '—'}
            sub="Population-weighted"
            accent="teal" loading={loading}
          />
          <StatCard
            label="HH w/ Children (18-)"
            value={data?.totals.avgHHWithChildren != null ? `${data.totals.avgHHWithChildren}%` : '—'}
            sub={data?.totals.avgHHSize != null ? `Avg HH Size: ${data.totals.avgHHSize}` : undefined}
            accent="purple" loading={loading}
          />
        </div>

        {/* Mapbox Choropleth Map */}
        <div className="fade-up-3" style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px', marginBottom: '20px' }}>
          <SectionHeader eyebrow="Population Growth · 2020 to 2023 · Hover for Details" title="ZIP Code Growth Map" />
          <Suspense fallback={
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.12em' }}>LOADING MAP...</span>
            </div>
          }>
            <MapboxChoropleth zipData={data?.zips ?? []} loading={loading} />
          </Suspense>
        </div>

        {/* Age Band + Income Distribution */}
        <div className="fade-up-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
            <SectionHeader eyebrow="All ZIPs · Pop-Weighted Average" title="Population by Age Band" />
            <div style={{ overflowX: 'auto' }}>
              <BarChart data={ageBands} loading={loading} barColors={AGE_COLORS} />
            </div>
          </div>
          <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
            <SectionHeader eyebrow="All ZIPs · HH-Weighted Average" title="Household Income Distribution" />
            <div style={{ overflowX: 'auto' }}>
              <BarChart data={data?.incomeDistribution ?? []} loading={loading} barColors={INCOME_COLORS} />
            </div>
          </div>
        </div>

        {/* Top Growth Table */}
        <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px', marginBottom: '40px' }}>
          <SectionHeader eyebrow="Sorted by Population Growth" title="Top Growth ZIP Codes" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ZIP', 'Area', 'Population', 'Growth %', 'Median HHI', '% w/ Children', 'Avg HH Size', 'SES Class'].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.08em', textTransform: 'uppercase' as const, textAlign: 'left', padding: '10px 12px 14px 0', borderBottom: '1px solid #232940', fontWeight: 400 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c' }}>
                        <div style={{ height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${(i + j) * 0.04}s` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                (data?.zips ?? []).map(z => (
                  <tr key={z.zip} className="tbl-row">
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#2DD4BF' }}>{z.zip}</td>
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#F0F2F7' }}>{z.label}</td>
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C8D4E4' }}>{z.population.toLocaleString()}</td>
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: growthColor(z.populationGrowth), fontWeight: 600 }}>
                      {z.populationGrowth != null ? `${z.populationGrowth}%` : '—'}
                    </td>
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#E8B84B' }}>${z.medianHouseholdIncome.toLocaleString()}</td>
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C8D4E4' }}>{z.hhWithChildrenPct != null ? `${z.hhWithChildrenPct}%` : '—'}</td>
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C8D4E4' }}>{z.avgHouseholdSize ?? '—'}</td>
                    <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c' }}><SEsBadge label={z.sesLabel} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #1e2b3c', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', letterSpacing: '0.08em' }}>
              Source: U.S. Census Bureau ACS 5-Year Estimates (2023) · BLS LAUS · FRED
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', letterSpacing: '0.08em' }}>
              Lakepointe Church · Community Intelligence Platform · Internal Use Only
            </span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#3d4a5c', letterSpacing: '0.06em' }}>
            Census data is reported by ZCTA (ZIP Code Tabulation Area), which approximates but does not exactly match USPS ZIP boundaries.
            {coverage === 'core' && ' · Averages computed over Core MSA (11 counties). Toggle to "All ZIPs" to include extended coverage area.'}
          </div>
        </div>

      </div>
    </div>
  )
}
