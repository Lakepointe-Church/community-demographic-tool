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

// ── Growth helpers ───────────────────────────────────────────────
function growthColor(g: number | null) {
  if (g == null) return '#2a3044'
  if (g >= 20)   return '#2DD4BF'
  if (g >= 8)    return '#4EAEFF'
  if (g >= 0)    return '#3a4561'
  return '#FF6B6B'
}
// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = 'gold', loading = false }: {
  label: string; value: string; sub?: string
  accent?: 'gold' | 'blue' | 'teal' | 'purple'
  loading?: boolean
}) {
  const colors = { gold: '#E8B84B', blue: '#4EAEFF', teal: '#2DD4BF', purple: '#A78BFA' }
  const color = colors[accent]
  return (
    <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color }} />
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#9BA5B7', marginBottom: '10px' }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: '44px', background: '#1e2433', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '40px', lineHeight: 1, letterSpacing: '0.03em', color: '#F0F2F7' }}>{value}</div>
          {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: color, marginTop: '8px', letterSpacing: '0.04em' }}>{sub}</div>}
        </>
      )}
    </div>
  )
}

// ── Section Header ───────────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ borderLeft: '3px solid #E8B84B', paddingLeft: '16px', marginBottom: '20px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '5px' }}>{eyebrow}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '26px', letterSpacing: '0.04em', lineHeight: 1, color: '#F0F2F7' }}>{title}</div>
    </div>
  )
}

// ── Generic Vertical Bar Chart ───────────────────────────────────
function BarChart({ data, loading }: { data: { label: string; pct: number }[]; loading: boolean }) {
  const maxPct = Math.max(...data.map(d => d.pct), 5)
  const barW = 56, gap = 12, chartH = 160, padL = 34
  const totalW = data.length * (barW + gap) - gap

  return (
    <svg width={totalW + padL + 8} height={chartH + 36} style={{ overflow: 'visible' }}>
      {[0, Math.round(maxPct / 2), Math.round(maxPct)].map(v => {
        const y = chartH - (v / maxPct) * chartH
        return (
          <g key={v}>
            <text x={padL - 5} y={y + 4} textAnchor="end" fill="#6B7689" fontFamily="IBM Plex Mono" fontSize="9">{v}%</text>
            <line x1={padL} y1={y} x2={padL + totalW} y2={y} stroke="#1e2433" strokeWidth={1} strokeDasharray="3 3" />
          </g>
        )
      })}
      {data.map((d, i) => {
        const barH = loading ? 0 : (d.pct / maxPct) * chartH
        const x = padL + i * (barW + gap)
        return (
          <g key={d.label}>
            <rect x={x} y={chartH - barH} width={barW} height={barH} fill="#4EAEFF" opacity={0.75} style={{ transition: 'all 0.6s ease' }} />
            <rect x={x} y={chartH - barH} width={barW} height={2} fill="#4EAEFF" />
            {!loading && d.pct > 0 && (
              <text x={x + barW / 2} y={chartH - barH - 5} textAnchor="middle" fill="#F0F2F7" fontFamily="IBM Plex Mono" fontSize="9">{d.pct.toFixed(1)}%</text>
            )}
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fill="#9BA5B7" fontFamily="IBM Plex Mono" fontSize="8">{d.label}</text>
          </g>
        )
      })}
      <line x1={padL} y1={chartH} x2={padL + totalW} y2={chartH} stroke="#2a3044" strokeWidth={1} />
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
    'Lower Income': { bg: 'rgba(155,165,183,0.15)', color: '#9BA5B7' },
  }
  const s = styles[label] ?? styles['Lower Income']
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}`,
      padding: '3px 8px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '9px', letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [data, setData]     = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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
    <>
      <style>{`
        .grow-pct { transition: color 0.2s; }
        .tbl-row:hover td { background: rgba(78,174,255,0.04); }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '36px 32px', maxWidth: '1440px', margin: '0 auto' }}>

          {/* Header */}
          <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.22em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                Community Intelligence Platform — Lakepointe Church
              </div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 5vw, 58px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
                DFW Metroplex<br />Overview
              </h1>
            </div>
            {data?.updatedAt && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7689', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Data Refreshed</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', fontWeight: 500, color: '#C8D0DC' }}>
                  {new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            )}
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
              sub="DFW Metro Area"
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
          <div className="fade-up-3" style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px', marginBottom: '20px' }}>
            <SectionHeader eyebrow="Population Growth · 2020 to 2023 · Hover for Details" title="ZIP Code Growth Map" />
            <Suspense fallback={
              <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6B7689', letterSpacing: '0.12em' }}>LOADING MAP...</span>
              </div>
            }>
              <MapboxChoropleth zipData={data?.zips ?? []} loading={loading} />
            </Suspense>
          </div>

          {/* Age Band + Income Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px' }}>
              <SectionHeader eyebrow="All ZIPs · Pop-Weighted Average" title="Population by Age Band" />
              <div style={{ overflowX: 'auto' }}>
                <BarChart data={ageBands} loading={loading} />
              </div>
            </div>
            <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px' }}>
              <SectionHeader eyebrow="All ZIPs · HH-Weighted Average" title="Household Income Distribution" />
              <div style={{ overflowX: 'auto' }}>
                <BarChart data={data?.incomeDistribution ?? []} loading={loading} />
              </div>
            </div>
          </div>

          {/* Top Growth Table */}
          <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px', marginBottom: '36px' }}>
            <SectionHeader eyebrow="Sorted by Population Growth" title="Top Growth ZIP Codes" />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ZIP', 'Area', 'Population', 'Growth %', 'Median HHI', '% w/ Children', 'Avg HH Size', 'SES Class'].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7689', letterSpacing: '0.1em', textTransform: 'uppercase' as const, textAlign: 'left', padding: '8px 12px 12px 0', borderBottom: '1px solid #1e2433', fontWeight: 400 }}>
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
                        <td key={j} style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e' }}>
                          <div style={{ height: '14px', background: '#1e2433', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${(i + j) * 0.04}s` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  (data?.zips ?? []).map(z => (
                    <tr key={z.zip} className="tbl-row">
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#2DD4BF' }}>{z.zip}</td>
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#F0F2F7' }}>{z.label}</td>
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C8D0DC' }}>{z.population.toLocaleString()}</td>
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: growthColor(z.populationGrowth) === '#3a4561' ? '#9BA5B7' : growthColor(z.populationGrowth), fontWeight: 600 }}>
                        {z.populationGrowth != null ? `${z.populationGrowth}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#E8B84B' }}>${z.medianHouseholdIncome.toLocaleString()}</td>
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C8D0DC' }}>{z.hhWithChildrenPct != null ? `${z.hhWithChildrenPct}%` : '—'}</td>
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C8D0DC' }}>{z.avgHouseholdSize ?? '—'}</td>
                      <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid #1a1f2e' }}><SEsBadge label={z.sesLabel} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #1a1f2e', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#3a4154', letterSpacing: '0.08em' }}>
              Source: U.S. Census Bureau ACS 5-Year Estimates (2023) · BLS LAUS · FRED
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#3a4154', letterSpacing: '0.08em' }}>
              Lakepointe Church · Community Intelligence Platform · Internal Use Only
            </span>
          </div>

        </div>
      </div>
    </>
  )
}
