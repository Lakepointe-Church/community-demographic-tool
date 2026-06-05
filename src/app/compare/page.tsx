'use client'

import { useState, useEffect, useCallback } from 'react'
import { DFW_ZIPS } from '@/lib/zips'

interface ZipData {
  zip: string
  name: string
  population: number
  populationGrowth: number | null
  medianHouseholdIncome: number
  totalHouseholds: number
  avgHouseholdSize: number | null
  hhWithChildrenPct: number | null
  race: { white: number; hispanic: number; black: number; asian: number; other: number }
  incomeBrackets: { label: string; pct: number }[]
}

function fmtK(n: number) {
  if (!n || n < 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

const ACCENT_RGB: Record<string, string> = {
  gold: '232,184,75', blue: '78,174,255', coral: '255,107,107',
  teal: '45,212,191', purple: '167,139,250',
}

const CARD_SURFACE = 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = 'gold', loading = false }: {
  label: string; value: string; sub?: string
  accent?: 'gold' | 'blue' | 'coral' | 'teal' | 'purple'
  loading?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const colors = { gold: '#E8B84B', blue: '#4EAEFF', coral: '#FF6B6B', teal: '#2DD4BF', purple: '#A78BFA' }
  const color = colors[accent]
  const rgb = ACCENT_RGB[accent]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(145deg, rgba(${rgb},0.09) 0%, rgba(255,255,255,0.01) 100%)`
          : CARD_SURFACE,
        border: `1px solid ${hovered ? `rgba(${rgb},0.35)` : '#232940'}`,
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
        <div style={{ height: '40px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '44px', lineHeight: 1, letterSpacing: '0.03em', color: '#F0F2F7' }}>{value}</div>
          {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', marginTop: '8px', letterSpacing: '0.04em' }}>{sub}</div>}
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

// ── Race Donut ───────────────────────────────────────────────────
const RACE_SEGS = [
  { key: 'white'    as const, label: 'White',    color: '#4EAEFF' },
  { key: 'hispanic' as const, label: 'Hispanic', color: '#FF6B6B' },
  { key: 'black'    as const, label: 'Black',    color: '#A78BFA' },
  { key: 'asian'    as const, label: 'Asian',    color: '#2DD4BF' },
  { key: 'other'    as const, label: 'Other',    color: '#E8B84B' },
]

function DonutChart({ race, loading }: {
  race: ZipData['race'] | null
  loading: boolean
}) {
  const cx = 100, cy = 100, r = 70, sw = 30
  const circ = 2 * Math.PI * r

  if (loading || !race) {
    return <div style={{ width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
  }

  let cumPct = 0
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2b3c" strokeWidth={sw} />
      {RACE_SEGS.filter(s => (race[s.key] ?? 0) > 0.3).map(seg => {
        const pct = (race[seg.key] ?? 0) / 100
        const rotation = cumPct * 360 - 90
        cumPct += pct
        return (
          <circle key={seg.key} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={sw}
            strokeDasharray={`${pct * circ} ${circ}`}
            transform={`rotate(${rotation} ${cx} ${cy})`}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={54} fill="#0f1219" />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="#8A98AE"
        fontFamily="'IBM Plex Mono', monospace" fontSize="11" letterSpacing="1.5">
        COMBINED
      </text>
    </svg>
  )
}

// ── Income Distribution Bar Chart (vertical SVG) ─────────────────
function IncomeChart({ brackets, loading }: {
  brackets: { label: string; pct: number }[]
  loading: boolean
}) {
  const barW = 56, gap = 12
  const chartH = 150
  const maxPct = Math.max(...brackets.map(b => b.pct), 5)
  const totalW = brackets.length * (barW + gap) - gap
  const padL = 32, padB = 40

  return (
    <svg
      width={totalW + padL + 8}
      height={chartH + padB}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="incomeBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4EAEFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#4EAEFF" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {[0, Math.round(maxPct / 2), Math.round(maxPct)].map(v => {
        const y = chartH - (v / maxPct) * chartH
        return (
          <g key={v}>
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#8A98AE" fontFamily="IBM Plex Mono" fontSize="10">{v}%</text>
            <line x1={padL} y1={y} x2={padL + totalW} y2={y} stroke="#1e2b3c" strokeWidth={1} strokeDasharray="3 3" />
          </g>
        )
      })}

      {brackets.map((b, i) => {
        const barH = loading ? 0 : (b.pct / maxPct) * chartH
        const x = padL + i * (barW + gap)
        return (
          <g key={b.label}>
            <rect
              x={x} y={chartH - barH} width={barW} height={barH}
              fill="url(#incomeBarGrad)"
              style={{ transition: 'all 0.6s ease' }}
            />
            <rect x={x} y={chartH - barH} width={barW} height={3} fill="#4EAEFF" />
            {!loading && b.pct > 0 && (
              <text x={x + barW / 2} y={chartH - barH - 7} textAnchor="middle" fill="#C8D4E4" fontFamily="IBM Plex Mono" fontSize="10">
                {b.pct.toFixed(1)}%
              </text>
            )}
            <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fill="#A8B4C5" fontFamily="IBM Plex Mono" fontSize="10">
              {b.label}
            </text>
          </g>
        )
      })}

      <line x1={padL} y1={chartH} x2={padL + totalW} y2={chartH} stroke="#232940" strokeWidth={1} />
    </svg>
  )
}

// ── Derived stats from selected ZIP data ─────────────────────────
function computeStats(data: ZipData[]) {
  if (!data.length) return null

  const totalPop  = data.reduce((s, d) => s + d.population, 0)
  const totalHH   = data.reduce((s, d) => s + d.totalHouseholds, 0)

  const wtdIncome = Math.round(
    data.reduce((s, d) => s + d.medianHouseholdIncome * d.population, 0) / totalPop
  )
  const growthData = data.filter(d => d.populationGrowth != null)
  const wtdGrowth  = growthData.length
    ? parseFloat((growthData.reduce((s, d) => s + (d.populationGrowth ?? 0) * d.population, 0) /
        growthData.reduce((s, d) => s + d.population, 0)).toFixed(1))
    : null

  const hhData = data.filter(d => d.hhWithChildrenPct != null)
  const combinedHHWithChildren = hhData.length
    ? parseFloat((hhData.reduce((s, d) => s + (d.hhWithChildrenPct ?? 0) * d.totalHouseholds, 0) /
        hhData.reduce((s, d) => s + d.totalHouseholds, 0)).toFixed(1))
    : null

  const avgHHSize = parseFloat(
    (data.filter(d => d.avgHouseholdSize).reduce((s, d) => s + (d.avgHouseholdSize ?? 0), 0) /
      data.filter(d => d.avgHouseholdSize).length || 0).toFixed(2)
  )

  const combinedRace = {
    white:    parseFloat((data.reduce((s, d) => s + d.race.white    * d.population, 0) / totalPop).toFixed(1)),
    hispanic: parseFloat((data.reduce((s, d) => s + d.race.hispanic * d.population, 0) / totalPop).toFixed(1)),
    black:    parseFloat((data.reduce((s, d) => s + d.race.black    * d.population, 0) / totalPop).toFixed(1)),
    asian:    parseFloat((data.reduce((s, d) => s + d.race.asian    * d.population, 0) / totalPop).toFixed(1)),
    other:    parseFloat((data.reduce((s, d) => s + d.race.other    * d.population, 0) / totalPop).toFixed(1)),
  }

  const combinedIncome = data[0].incomeBrackets.map((b, i) => ({
    label: b.label,
    pct: parseFloat((data.reduce((s, d) => s + d.incomeBrackets[i].pct * d.totalHouseholds, 0) / totalHH).toFixed(1)),
  }))

  return { totalPop, totalHH, wtdIncome, wtdGrowth, combinedHHWithChildren, avgHHSize, combinedRace, combinedIncome }
}

// ── Page ─────────────────────────────────────────────────────────
const INITIAL = ['75087', '75032']

export default function ComparePage() {
  const [selected, setSelected] = useState<Set<string>>(new Set(INITIAL))
  const [zipData, setZipData] = useState<ZipData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback((zips: string[]) => {
    if (!zips.length) { setZipData([]); setLoading(false); return }
    setLoading(true)
    fetch(`/api/census/batch?zips=${zips.join(',')}`)
      .then(r => r.json())
      .then(d => { setZipData(d.results ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData([...selected]) }, [selected, fetchData])

  const toggle = (zip: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(zip) ? next.delete(zip) : next.add(zip)
      return next
    })
  }

  const stats = !loading && zipData.length ? computeStats(zipData) : null

  return (
    <>
      <style>{`
        .zip-toggle {
          background: transparent;
          border: 1px solid #232940;
          color: #A8B4C5;
          padding: 7px 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 8px;
          text-align: left;
        }
        .zip-toggle:hover { border-color: #2DD4BF; color: #2DD4BF; background: rgba(45,212,191,0.05); }
        .zip-toggle.active { background: rgba(45,212,191,0.1); border-color: #2DD4BF; color: #F0F2F7; }
        .zip-toggle .check {
          width: 14px; height: 14px; border: 1px solid #232940; border-radius: 2px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .zip-toggle.active .check { background: #2DD4BF; border-color: #2DD4BF; }
        .zip-scroll::-webkit-scrollbar { width: 4px; }
        .zip-scroll::-webkit-scrollbar-track { background: #0d0f14; }
        .zip-scroll::-webkit-scrollbar-thumb { background: #232940; border-radius: 2px; }
        .zip-scroll::-webkit-scrollbar-thumb:hover { background: #3a4861; }
        .action-btn {
          background: transparent;
          border: 1px solid #232940;
          color: #A8B4C5;
          padding: 7px 16px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .action-btn:hover { border-color: #E8B84B; color: #E8B84B; }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '40px 32px', maxWidth: '1440px', margin: '0 auto' }}>

          {/* Header */}
          <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '36px' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
                Dashboard · Compare ZIPs
              </div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 4vw, 52px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
                Compare ZIP<br />Codes
              </h1>
              <div style={{ width: '48px', height: '2px', background: 'linear-gradient(90deg, #E8B84B, rgba(232,184,75,0))', marginTop: '16px' }} />
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.08em', marginTop: '12px', textTransform: 'uppercase' as const }}>
                Select Multiple ZIPs to View Combined Data
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="action-btn" onClick={() => setSelected(new Set(DFW_ZIPS.map(z => z.zip)))}>Select All</button>
              <button className="action-btn" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>

          {/* ZIP Selection Grid */}
          <div className="fade-up-2" style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '20px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', color: '#A8B4C5', textTransform: 'uppercase' as const }}>
                Select ZIP Codes
              </span>
              {selected.size > 0 && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#2DD4BF', letterSpacing: '0.08em' }}>
                  {selected.size} Selected
                </span>
              )}
            </div>
            <div className="zip-scroll" style={{ maxHeight: '228px', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                {DFW_ZIPS.map(({ zip, label }) => (
                  <button
                    key={zip}
                    className={`zip-toggle${selected.has(zip) ? ' active' : ''}`}
                    onClick={() => toggle(zip)}
                  >
                    <span className="check">
                      {selected.has(zip) && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="#0d0f14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span>
                      <span style={{ color: selected.has(zip) ? '#2DD4BF' : '#A8B4C5', marginRight: '6px' }}>{zip}</span>
                      <span style={{ color: selected.has(zip) ? '#C8D4E4' : '#8A98AE', fontSize: '10px' }}>{label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Combined Stats */}
          {selected.size === 0 ? (
            <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '48px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#8A98AE', letterSpacing: '0.06em' }}>
                Select ZIP codes above to view combined data
              </div>
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <StatCard
                  label="Combined Population"
                  value={stats ? fmtK(stats.totalPop) : '—'}
                  sub={`${selected.size} ZIP code${selected.size !== 1 ? 's' : ''}`}
                  accent="gold" loading={loading}
                />
                <StatCard
                  label="WTD Avg Median HHI"
                  value={stats ? `$${fmtK(stats.wtdIncome)}` : '—'}
                  sub="Population-weighted average"
                  accent="blue" loading={loading}
                />
                <StatCard
                  label="WTD Avg Growth"
                  value={stats?.wtdGrowth != null ? `${stats.wtdGrowth}%` : '—'}
                  sub="Since 2020 · Pop-weighted"
                  accent="teal" loading={loading}
                />
                <StatCard
                  label="HH w/ Children (18-)"
                  value={stats?.combinedHHWithChildren != null ? `${stats.combinedHHWithChildren}%` : '—'}
                  sub={stats ? `Avg HH Size: ${stats.avgHHSize}` : 'of all households'}
                  accent="purple" loading={loading}
                />
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '36px' }}>

                <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
                  <SectionHeader eyebrow="Population-Weighted Average" title="Combined Race / Ethnicity" />
                  <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                    <DonutChart race={stats?.combinedRace ?? null} loading={loading} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                      {RACE_SEGS.map(seg => (
                        <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#A8B4C5', flex: 1 }}>{seg.label}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#F0F2F7', fontWeight: 600 }}>
                            {loading || !stats ? '—' : `${stats.combinedRace[seg.key].toFixed(1)}%`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
                  <SectionHeader eyebrow="HH-Weighted Average · ACS 2023" title="Income Distribution" />
                  <div style={{ overflowX: 'auto' }}>
                    <IncomeChart
                      brackets={stats?.combinedIncome ?? [
                        { label: '<$25K', pct: 0 }, { label: '$25-50K', pct: 0 },
                        { label: '$50-75K', pct: 0 }, { label: '$75-100K', pct: 0 },
                        { label: '$100-150K', pct: 0 }, { label: '$150K+', pct: 0 },
                      ]}
                      loading={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Selected ZIP summary table */}
              <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px', marginBottom: '40px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#A8B4C5', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #1e2b3c' }}>
                  Selected ZIP Summary
                </div>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr repeat(4, 120px)', gap: '0' }}>
                    {['ZIP', 'Name', 'Population', 'Median HHI', 'Growth', 'Race Mix'].map(h => (
                      <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '8px 12px 12px 0', borderBottom: '1px solid #232940' }}>{h}</div>
                    ))}
                    {zipData.map(d => [
                      d.zip,
                      d.name.replace('ZCTA5 ', ''),
                      d.population.toLocaleString(),
                      `$${fmtK(d.medianHouseholdIncome)}`,
                      d.populationGrowth != null ? `↑ ${d.populationGrowth}%` : '—',
                      `${d.race.white.toFixed(0)}% W · ${d.race.hispanic.toFixed(0)}% H`,
                    ].map((cell, j) => (
                      <div key={j} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: j === 0 ? '#2DD4BF' : '#F0F2F7', padding: '11px 12px 11px 0', borderBottom: '1px solid #1e2b3c', letterSpacing: j === 4 ? '0' : '0.02em' }}>
                        {cell}
                      </div>
                    )))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px solid #1e2b3c', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', letterSpacing: '0.08em' }}>
              Source: U.S. Census Bureau ACS 5-Year Estimates (2023) · api.census.gov
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', letterSpacing: '0.08em' }}>
              Lakepointe Church · Community Intelligence Platform · Internal Use Only
            </span>
          </div>

        </div>
      </div>
    </>
  )
}
