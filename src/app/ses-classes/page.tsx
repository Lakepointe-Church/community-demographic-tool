'use client'

import { useState, useEffect, useMemo } from 'react'

interface ZipSes {
  zip: string
  name: string
  sesLabel: string
  sesScore: number
  medianHouseholdIncome: number | null
  bachelorsRate: number | null
  unemploymentRate: number | null
  occMgmtProfPct: number | null
  populationGrowth: number | null
}

interface Summary {
  avgScore: number
  total: number
  countByTier: Record<string, number>
}

const TIERS = ['Upper', 'Upper Middle', 'Middle', 'Lower Middle', 'Lower Income'] as const

const TIER_COLOR: Record<string, string> = {
  'Upper':        '#A78BFA',
  'Upper Middle': '#4EAEFF',
  'Middle':       '#2DD4BF',
  'Lower Middle': '#E8B84B',
  'Lower Income': '#FF6B6B',
}
const TIER_RGB: Record<string, string> = {
  'Upper':        '167,139,250',
  'Upper Middle': '78,174,255',
  'Middle':       '45,212,191',
  'Lower Middle': '232,184,75',
  'Lower Income': '255,107,107',
}

const COLOR_TO_RGB: Record<string, string> = {
  '#A78BFA': '167,139,250',
  '#4EAEFF': '78,174,255',
  '#2DD4BF': '45,212,191',
  '#E8B84B': '232,184,75',
  '#FF6B6B': '255,107,107',
  '#8A98AE': '138,152,174',
}

const CARD_SURFACE = 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'

function fmt$(n: number | null) {
  if (n == null || n <= 0) return '—'
  return '$' + n.toLocaleString()
}
function fmtPct(n: number | null) {
  if (n == null) return '—'
  return n.toFixed(1) + '%'
}

function trend(growth: number | null): { label: string; color: string } {
  if (growth == null) return { label: '—', color: '#5a6478' }
  if (growth > 2)  return { label: '↑ Growing',   color: '#2DD4BF' }
  if (growth >= 0) return { label: '→ Stable',    color: '#E8B84B' }
  return              { label: '↓ Declining',  color: '#FF6B6B' }
}

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, loading = false }: {
  label: string; value: string; sub?: string; color: string; loading?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const rgb = COLOR_TO_RGB[color] ?? '232,184,75'
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.22) 0%, transparent 60%), linear-gradient(145deg, rgba(${rgb},0.08) 0%, rgba(255,255,255,0.01) 100%)`
          : `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.1) 0%, transparent 55%), ${CARD_SURFACE}`,
        border: `1px solid ${hovered ? `rgba(${rgb},0.4)` : '#232940'}`,
        borderRadius: '4px', padding: '20px 24px', transition: 'all 0.2s ease',
      }}
    >
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#8A98AE', textTransform: 'uppercase' as const, marginBottom: '10px' }}>{label}</div>
      {loading ? (
        <div style={{ height: '36px', width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '40px', letterSpacing: '0.04em', color, lineHeight: 1 }}>{value}</div>
      )}
      {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#5a6478', marginTop: '8px', letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  )
}

// ── Distribution Bar Chart ────────────────────────────────────────
function DistributionChart({ countByTier, total }: { countByTier: Record<string, number>; total: number }) {
  const max = Math.max(...TIERS.map(t => countByTier[t] ?? 0), 1)
  const chartH = 180
  const barW = 48
  const gap = 28
  const padTop = 24
  const padLeft = 40
  const width = padLeft + TIERS.length * (barW + gap) + 20
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${chartH + 60}`} style={{ overflow: 'visible' }}>
      <defs>
        {TIERS.map((t, i) => (
          <linearGradient key={i} id={`dGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TIER_COLOR[t]} />
            <stop offset="100%" stopColor={`${TIER_COLOR[t]}40`} />
          </linearGradient>
        ))}
      </defs>
      {/* Y-axis grid lines */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = padTop + chartH - (pct / 100 * chartH)
        const count = Math.round(pct / 100 * max)
        return (
          <g key={pct}>
            <line x1={padLeft} y1={y} x2={width - 10} y2={y} stroke="#1e2b3c" strokeWidth="1" />
            <text x={padLeft - 6} y={y + 4} textAnchor="end" fill="#5a6478" fontSize="9" fontFamily="IBM Plex Mono">{count}</text>
          </g>
        )
      })}
      {TIERS.map((tier, i) => {
        const count = countByTier[tier] ?? 0
        const barH = max > 0 ? (count / max) * chartH : 0
        const x = padLeft + i * (barW + gap)
        const y = padTop + chartH - barH
        return (
          <g key={tier}>
            <rect x={x} y={y} width={barW} height={barH} fill={`url(#dGrad-${i})`} rx="2" />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill={TIER_COLOR[tier]} fontSize="11" fontFamily="IBM Plex Mono" fontWeight="600">{count}</text>
            <text x={x + barW / 2} y={padTop + chartH + 18} textAnchor="middle" fill="#8A98AE" fontSize="9" fontFamily="IBM Plex Mono">
              {tier.split(' ').map((word, wi) => (
                <tspan key={wi} x={x + barW / 2} dy={wi === 0 ? 0 : 12}>{word}</tspan>
              ))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Scatter Plot ──────────────────────────────────────────────────
function ScatterPlot({ zips }: { zips: ZipSes[] }) {
  const [tooltip, setTooltip] = useState<{ zip: ZipSes; x: number; y: number } | null>(null)
  const points = zips.filter(z => z.medianHouseholdIncome && z.medianHouseholdIncome > 0)

  const incMin = 20000, incMax = 280000
  const plotW = 420, plotH = 200
  const padL = 52, padB = 36, padT = 16, padR = 16

  const toX = (inc: number) => padL + ((inc - incMin) / (incMax - incMin)) * plotW
  const toY = (score: number) => padT + plotH - (score / 100) * plotH

  const xTicks = [40, 80, 120, 160, 200, 240, 280]
  const yTicks = [0, 25, 50, 75, 100]

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${padL + plotW + padR} ${padT + plotH + padB}`} style={{ overflow: 'visible' }}>
        {/* Grid */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} y1={toY(v)} x2={padL + plotW} y2={toY(v)} stroke="#1e2b3c" strokeWidth="1" />
            <text x={padL - 6} y={toY(v) + 4} textAnchor="end" fill="#5a6478" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={v}>
            <line x1={toX(v * 1000)} y1={padT} x2={toX(v * 1000)} y2={padT + plotH} stroke="#1e2b3c" strokeWidth="1" />
            <text x={toX(v * 1000)} y={padT + plotH + 14} textAnchor="middle" fill="#5a6478" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
          </g>
        ))}
        {/* Axis labels */}
        <text x={padL + plotW / 2} y={padT + plotH + 30} textAnchor="middle" fill="#8A98AE" fontSize="9" fontFamily="IBM Plex Mono">Median HH Income ($K)</text>
        <text transform={`translate(12,${padT + plotH / 2}) rotate(-90)`} textAnchor="middle" fill="#8A98AE" fontSize="9" fontFamily="IBM Plex Mono">SES Score</text>
        {/* Points */}
        {points.map(z => (
          <circle
            key={z.zip}
            cx={toX(z.medianHouseholdIncome!)}
            cy={toY(z.sesScore)}
            r="5"
            fill={TIER_COLOR[z.sesLabel] ?? '#8A98AE'}
            fillOpacity="0.8"
            stroke={TIER_COLOR[z.sesLabel] ?? '#8A98AE'}
            strokeOpacity="0.4"
            strokeWidth="1"
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => {
              const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
              setTooltip({ zip: z, x: e.clientX - rect.left, y: e.clientY - rect.top })
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x + 10, top: tooltip.y - 10,
          background: '#13161f', border: '1px solid #232940', borderRadius: '4px',
          padding: '8px 12px', pointerEvents: 'none', zIndex: 10, minWidth: '140px',
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', marginBottom: '4px' }}>{tooltip.zip.zip} · {tooltip.zip.name}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: TIER_COLOR[tooltip.zip.sesLabel] }}>{tooltip.zip.sesLabel} · {tooltip.zip.sesScore}/100</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8A98AE', marginTop: '2px' }}>{fmt$(tooltip.zip.medianHouseholdIncome)}</div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export default function SesClassesPage() {
  const [zips, setZips] = useState<ZipSes[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('All')
  const [sortCol, setSortCol] = useState<'sesScore' | 'medianHouseholdIncome' | 'bachelorsRate' | 'unemploymentRate' | 'occMgmtProfPct'>('sesScore')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    fetch('/api/ses-classes')
      .then(r => r.json())
      .then(d => { setZips(d.zips ?? []); setSummary(d.summary ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const base = filter === 'All' ? zips : zips.filter(z => z.sesLabel === filter)
    return [...base].sort((a, b) => {
      const va = a[sortCol] ?? -1
      const vb = b[sortCol] ?? -1
      return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number)
    })
  }, [zips, filter, sortCol, sortDir])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const upper   = (summary?.countByTier['Upper'] ?? 0) + (summary?.countByTier['Upper Middle'] ?? 0)
  const middle  = summary?.countByTier['Middle'] ?? 0
  const lower   = (summary?.countByTier['Lower Middle'] ?? 0) + (summary?.countByTier['Lower Income'] ?? 0)

  const FILTER_TABS = ['All', ...TIERS]

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .ses-row:hover { background: rgba(255,255,255,0.025) !important; }
        .sort-btn { cursor:pointer; user-select:none; }
        .sort-btn:hover { color: #C8D4E4 !important; }
      `}</style>
      <div style={{ padding: '40px 32px', maxWidth: '1440px', margin: '0 auto' }}>

        {/* Header */}
        <div className="fade-up" style={{ marginBottom: '36px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
            Dashboard · SES Classes
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px,4vw,52px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
            Socioeconomic<br />Segmentation
          </h1>
          <div style={{ width: '48px', height: '2px', background: 'linear-gradient(90deg, #E8B84B, rgba(232,184,75,0))', marginTop: '16px' }} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.08em', marginTop: '12px', textTransform: 'uppercase' as const }}>
            ACS-Derived Class Classification · {summary?.total ?? 370} DFW ZIPs
          </div>
        </div>

        {/* Stat cards */}
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
          <StatCard label="Avg SES Score" value={loading ? '—' : String(summary?.avgScore ?? '—')} sub="DFW Metro" color="#E8B84B" loading={loading} />
          <StatCard label="Upper Middle+" value={loading ? '—' : String(upper)} sub={`of ${summary?.total ?? '—'} ZIPs`} color="#4EAEFF" loading={loading} />
          <StatCard label="Middle Class" value={loading ? '—' : String(middle)} sub="score 40–57" color="#2DD4BF" loading={loading} />
          <StatCard label="Lower Middle & Below" value={loading ? '—' : String(lower)} sub="score below 40" color="#FF6B6B" loading={loading} />
        </div>

        {/* Charts */}
        <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#8A98AE', textTransform: 'uppercase' as const, marginBottom: '4px' }}>SES Class Distribution</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#5a6478', letterSpacing: '0.08em', marginBottom: '16px' }}>Count of DFW ZIPs per tier</div>
            {loading
              ? <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              : <DistributionChart countByTier={summary?.countByTier ?? {}} total={summary?.total ?? 0} />
            }
          </div>
          <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#8A98AE', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Composite SES Score by ZIP</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#5a6478', letterSpacing: '0.08em', marginBottom: '16px' }}>Hover dots for ZIP details</div>
            {loading
              ? <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              : <ScatterPlot zips={zips} />
            }
            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const, marginTop: '12px' }}>
              {TIERS.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TIER_COLOR[t] }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#8A98AE' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="fade-up-4" style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#8A98AE', textTransform: 'uppercase' as const, marginBottom: '16px' }}>
            All ZIPs by SES Classification
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '20px' }}>
            {FILTER_TABS.map(tab => {
              const active = filter === tab
              const color = tab === 'All' ? '#E8B84B' : TIER_COLOR[tab]
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.06em',
                    padding: '5px 12px', borderRadius: '3px', cursor: 'pointer', border: '1px solid',
                    borderColor: active ? color : '#232940',
                    background: active ? `rgba(${tab === 'All' ? '232,184,75' : TIER_RGB[tab]},0.12)` : 'transparent',
                    color: active ? color : '#8A98AE',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab}{tab !== 'All' && summary ? ` (${summary.countByTier[tab] ?? 0})` : ''}
                </button>
              )
            })}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    { label: 'ZIP',       col: null },
                    { label: 'Area',      col: null },
                    { label: 'SES Score', col: 'sesScore' as const },
                    { label: 'Class',     col: null },
                    { label: 'Median HHI', col: 'medianHouseholdIncome' as const },
                    { label: '% Bachelor+', col: 'bachelorsRate' as const },
                    { label: '% Mgmt/Prof', col: 'occMgmtProfPct' as const },
                    { label: 'Unempl %',  col: 'unemploymentRate' as const },
                    { label: 'Trend',     col: null },
                  ].map(({ label, col }) => (
                    <th
                      key={label}
                      onClick={col ? () => toggleSort(col) : undefined}
                      className={col ? 'sort-btn' : undefined}
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em',
                        color: col && sortCol === col ? '#E8B84B' : '#8A98AE',
                        textTransform: 'uppercase' as const, textAlign: 'left',
                        padding: '0 16px 12px 0', borderBottom: '1px solid #232940',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {label}{col && sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} style={{ padding: '10px 16px 10px 0', borderBottom: '1px solid #1e2b3c' }}>
                          <div style={{ height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.06}s` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.map(z => {
                  const color = TIER_COLOR[z.sesLabel] ?? '#8A98AE'
                  const rgb   = TIER_RGB[z.sesLabel] ?? '138,152,174'
                  const t = trend(z.populationGrowth)
                  return (
                    <tr key={z.zip} className="ses-row" style={{ borderBottom: '1px solid #1e2b3c', transition: 'background 0.15s' }}>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', padding: '11px 16px 11px 0', whiteSpace: 'nowrap' as const }}>{z.zip}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#A8B4C5', padding: '11px 16px 11px 0', whiteSpace: 'nowrap' as const }}>{z.name ?? '—'}</td>
                      <td style={{ padding: '11px 16px 11px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '4px', background: '#1e2b3c', borderRadius: '2px', flexShrink: 0 }}>
                            <div style={{ width: `${z.sesScore}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}80)`, borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7' }}>{z.sesScore}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px 11px 0' }}>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.1em',
                          textTransform: 'uppercase' as const, padding: '3px 8px', borderRadius: '3px',
                          background: `rgba(${rgb},0.15)`, color, border: `1px solid rgba(${rgb},0.3)`,
                          whiteSpace: 'nowrap' as const,
                        }}>
                          {z.sesLabel}
                        </span>
                      </td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', padding: '11px 16px 11px 0' }}>{fmt$(z.medianHouseholdIncome)}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', padding: '11px 16px 11px 0' }}>{fmtPct(z.bachelorsRate)}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', padding: '11px 16px 11px 0' }}>{fmtPct(z.occMgmtProfPct)}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: z.unemploymentRate != null && z.unemploymentRate > 5 ? '#FF6B6B' : '#F0F2F7', padding: '11px 16px 11px 0' }}>{fmtPct(z.unemploymentRate)}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: t.color, padding: '11px 16px 11px 0', whiteSpace: 'nowrap' as const }}>{t.label}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#8A98AE', padding: '24px 0', textAlign: 'center' as const }}>No ZIPs found for this filter.</div>
            )}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', marginTop: '16px', letterSpacing: '0.06em' }}>
            Showing {filtered.length} of {zips.length} ZIPs · Source: U.S. Census Bureau ACS 5-Year 2023 · Click column headers to sort
          </div>
        </div>

      </div>
    </>
  )
}
