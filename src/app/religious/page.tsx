'use client'

import { useEffect, useState, useRef } from 'react'
import { ZIP_GROUPS, CAMPUS_ZIPS } from '@/lib/zips'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Overview {
  stats: {
    total: number; islamic: number; christian: number; jewish: number
    hindu: number; buddhist: number; other: number
    new_since_2015: number; islamic_new: number
  }
  topIslamicZips: { zip: string; count: number }[]
  byCategory: { ntee_category: string; count: number }[]
  saturation: { avg_churches_per_10k: number; max_churches_per_10k: number; zips_with_churches: number } | null
}

interface ZipData {
  zip: string
  orgs: {
    ein: string; name: string; street: string; city: string
    ntee_cd: string; ntee_category: string; ntee_label: string
    ruling_year: number | null; status: string
  }[]
  counts: { ntee_category: string; count: number }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FAITH_COLORS: Record<string, string> = {
  Christian:  '#4EAEFF',
  Islamic:    '#2DD4BF',
  Jewish:     '#A78BFA',
  Hindu:      '#FF6B6B',
  Buddhist:   '#E8B84B',
  Unitarian:  '#94A3B8',
  Other:      '#8A98AE',
}

const FAITH_ORDER = ['Christian', 'Islamic', 'Jewish', 'Hindu', 'Buddhist', 'Unitarian', 'Other']

// ── Sub-components ────────────────────────────────────────────────────────────

function CampusDot({ status }: { status: 'existing' | 'soon' }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background:  status === 'existing' ? '#E8B84B' : 'transparent',
      border:      status === 'soon'     ? '1.5px solid #E8B84B' : 'none',
      boxShadow:   status === 'existing' ? '0 0 5px rgba(232,184,75,0.5)' : 'none',
    }} />
  )
}

function ZipDropdown({ value, onChange }: { value: string; onChange: (z: string) => void }) {
  const [open, setOpen]       = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedLabel = ZIP_GROUPS.flatMap(g => g.zips).find(z => z.zip === value)?.label ?? value

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 220 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '8px 12px', background: '#13161f',
          border: '1px solid #232940', borderRadius: 6, color: '#C8D4E4',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {CAMPUS_ZIPS[value] && <CampusDot status={CAMPUS_ZIPS[value]} />}
          {value} · {selectedLabel}
        </span>
        <span style={{ color: '#8A98AE', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="zip-scroll" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#13161f', border: '1px solid #232940', borderRadius: 6,
          marginTop: 4, maxHeight: 320, overflowY: 'auto',
        }}>
          {ZIP_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                padding: '6px 12px 4px', fontSize: 10, color: '#5a6478',
                fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em',
                textTransform: 'uppercase', position: 'sticky', top: 0,
                background: '#13161f', borderBottom: '1px solid #1e2b3c',
              }}>{group.label}</div>
              {group.zips.map(z => {
                const campus = CAMPUS_ZIPS[z.zip]
                const isSelected = z.zip === value
                const isHovered  = z.zip === hovered
                return (
                  <div
                    key={z.zip}
                    onMouseEnter={() => setHovered(z.zip)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => { onChange(z.zip); setOpen(false) }}
                    style={{
                      padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                      fontFamily: "'IBM Plex Mono', monospace",
                      display: 'flex', alignItems: 'center', gap: 8,
                      color:      isSelected ? '#E8B84B' : isHovered ? '#C8D4E4' : '#8A98AE',
                      background: isSelected ? 'rgba(232,184,75,0.08)' : isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                    }}
                  >
                    {campus && <CampusDot status={campus} />}
                    <span style={{ color: '#5a6478' }}>{z.zip}</span>
                    <span>{z.label}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function FaithBar({ counts, total }: { counts: { ntee_category: string; count: number }[]; total: number }) {
  const padTop = 22
  const W = 500, barH = 22, gap = 10
  const BAR_MAX = 250   // max bar pixel width; label column starts at 375
  const LABEL_X = 375
  const maxCount = Math.max(...counts.map(c => c.count), 1)
  const H = padTop + counts.length * (barH + gap)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        {counts.map((c, i) => {
          const color = FAITH_COLORS[c.ntee_category] ?? '#8A98AE'
          return (
            <linearGradient key={i} id={`fg-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={`${color}60`} />
            </linearGradient>
          )
        })}
      </defs>
      {counts.map((c, i) => {
        const y     = padTop + i * (barH + gap)
        const barW  = total > 0 ? Math.max(2, (c.count / maxCount) * BAR_MAX) : 0
        const color = FAITH_COLORS[c.ntee_category] ?? '#8A98AE'
        const pct   = total > 0 ? ((c.count / total) * 100).toFixed(1) : '0.0'
        return (
          <g key={i}>
            <text x={0} y={y + barH - 6} fontSize={12}
              fontFamily="'IBM Plex Mono', monospace" fill="#A8B4C5">{c.ntee_category}</text>
            <rect x={110} y={y} width={Math.max(barW, 1)} height={barH}
              rx={3} fill={`url(#fg-${i})`} />
            <text x={LABEL_X} y={y + barH - 6} fontSize={11}
              fontFamily="'IBM Plex Mono', monospace" fill={color}>
              {c.count} <tspan fill="#5a6478">({pct}%)</tspan>
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, rgb, unit = '' }: {
  label: string; value: string | number; sub?: string; rgb: string; unit?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 180px', minWidth: 160, padding: '20px 22px', borderRadius: 10,
        background: hovered
          ? `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.22) 0%, transparent 60%), linear-gradient(145deg, rgba(${rgb},0.08) 0%, rgba(255,255,255,0.01) 100%)`
          : `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.1) 0%, transparent 55%), linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`,
        border: hovered ? `1px solid rgba(${rgb},0.4)` : '1px solid #232940',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: `rgb(${rgb})`, lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}{unit}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#5a6478', marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>{sub}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReligiousPage() {
  const [overview, setOverview]   = useState<Overview | null>(null)
  const [zip, setZip]             = useState('75080')
  const [zipData, setZipData]     = useState<ZipData | null>(null)
  const [loadingZip, setLoadingZip] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showAll, setShowAll]     = useState(false)

  useEffect(() => {
    fetch('/api/religious')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setOverview(d)
      })
      .catch(() => setError('Failed to load overview data'))
  }, [])

  useEffect(() => {
    setLoadingZip(true)
    setZipData(null)
    setShowAll(false)
    fetch(`/api/religious?zip=${zip}`)
      .then(r => r.json())
      .then(d => { setZipData(d); setLoadingZip(false) })
      .catch(() => setLoadingZip(false))
  }, [zip])

  const islamicOrgs = zipData?.orgs.filter(o => o.ntee_category === 'Islamic') ?? []
  const otherOrgs   = zipData?.orgs.filter(o => o.ntee_category !== 'Islamic') ?? []
  const visibleOther = showAll ? otherOrgs : otherOrgs.slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f14', color: '#C8D4E4' }}>
      <style>{`
        body { margin: 0; }
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');
        .zip-scroll::-webkit-scrollbar { width: 6px; }
        .zip-scroll::-webkit-scrollbar-track { background: #13161f; }
        .zip-scroll::-webkit-scrollbar-thumb { background: #232940; border-radius: 3px; }
        .org-row:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#E8B84B', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6, textTransform: 'uppercase' }}>
            IRS 501(c) · Business Master File · DFW Metro
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: 0, color: '#C8D4E4', letterSpacing: '0.02em' }}>
            Religious Landscape
          </h1>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '16px 20px', marginBottom: 24, color: '#FF6B6B', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Stat Cards */}
        {overview && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 40 }}>
            <StatCard label="Total Orgs · DFW" value={overview.stats.total}    rgb="232,184,75" />
            <StatCard label="Islamic Centers"   value={overview.stats.islamic}  rgb="45,212,191"
              sub={`+${overview.stats.islamic_new} since 2015`} />
            <StatCard label="Christian Churches" value={overview.stats.christian} rgb="78,174,255" />
            <StatCard label="New Since 2015"    value={overview.stats.new_since_2015} rgb="167,139,250"
              sub="across all faiths" />
            {overview.saturation && (
              <StatCard
                label="Avg Churches / 10K · DFW"
                value={parseFloat(String(overview.saturation.avg_churches_per_10k)).toFixed(1)}
                rgb="232,184,75"
                sub={`${overview.saturation.zips_with_churches} ZIPs w/ registered churches`}
              />
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40, alignItems: 'start' }}>

          {/* DFW Faith Distribution */}
          {overview && (
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 16 }}>
                DFW · Faith Distribution
              </div>
              <FaithBar counts={overview.byCategory} total={overview.stats.total} />
            </div>
          )}

          {/* Top ZIP Codes by Islamic Orgs */}
          {overview && (
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 16 }}>
                Top ZIP Codes · Islamic Organizations
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                <thead>
                  <tr>
                    {['ZIP', 'Area', 'Orgs'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Orgs' ? 'right' : 'left', padding: '4px 8px 10px', color: '#5a6478', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
              </table>
              <div className="zip-scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <tbody>
                    {overview.topIslamicZips.map((row) => {
                      const area = ZIP_GROUPS.flatMap(g => g.zips).find(z => z.zip === row.zip)?.label ?? '—'
                      return (
                        <tr key={row.zip} className="org-row" style={{ cursor: 'pointer', borderBottom: '1px solid #1a1f2e' }}
                          onClick={() => setZip(row.zip)}>
                          <td style={{ padding: '8px 8px', color: '#E8B84B' }}>{row.zip}</td>
                          <td style={{ padding: '8px 8px', color: '#A8B4C5' }}>{area}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: '#2DD4BF' }}>{row.count}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: '#5a6478', marginTop: 12, fontFamily: "'IBM Plex Mono', monospace" }}>Click a ZIP to explore</div>
            </div>
          )}
        </div>

        {/* ZIP Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace" }}>
            View ZIP Code
          </div>
          <ZipDropdown value={zip} onChange={setZip} />
        </div>

        {loadingZip && (
          <div style={{ color: '#5a6478', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, padding: '40px 0' }}>Loading…</div>
        )}

        {zipData && !loadingZip && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Faith breakdown for ZIP */}
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>
                {zip} · Faith Breakdown
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#E8B84B', marginBottom: 18 }}>
                {zipData.orgs.length} Religious Orgs
              </div>
              {zipData.counts.length > 0
                ? <FaithBar counts={zipData.counts} total={zipData.orgs.length} />
                : <div style={{ color: '#5a6478', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>No registered religious organizations in this ZIP.</div>
              }
            </div>

            {/* Islamic section */}
            <div style={{
              background: islamicOrgs.length > 0
                ? 'radial-gradient(ellipse at 50% 0%, rgba(45,212,191,0.08) 0%, transparent 60%), #13161f'
                : '#13161f',
              border: islamicOrgs.length > 0 ? '1px solid rgba(45,212,191,0.25)' : '1px solid #232940',
              borderRadius: 10, padding: '24px 28px',
            }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2DD4BF', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>
                Islamic Organizations · {zip}
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#2DD4BF', marginBottom: 18 }}>
                {islamicOrgs.length} {islamicOrgs.length === 1 ? 'Org' : 'Orgs'}
              </div>
              {islamicOrgs.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Name', 'Type', 'Est.'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px 8px', color: '#5a6478', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {islamicOrgs.map(o => (
                      <tr key={o.ein} className="org-row" style={{ borderBottom: '1px solid #1a1f2e' }}>
                        <td style={{ padding: '8px 8px', color: '#C8D4E4', maxWidth: 200, wordBreak: 'break-word' }}>{o.name}</td>
                        <td style={{ padding: '8px 8px', color: '#2DD4BF', whiteSpace: 'nowrap' }}>{o.ntee_label}</td>
                        <td style={{ padding: '8px 8px', color: o.ruling_year && o.ruling_year >= 2015 ? '#E8B84B' : '#5a6478', whiteSpace: 'nowrap' }}>
                          {o.ruling_year ?? '—'}
                          {o.ruling_year && o.ruling_year >= 2015 && <span style={{ color: '#E8B84B', marginLeft: 4, fontSize: 10 }}>NEW</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#5a6478', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                  No Islamic organizations registered in this ZIP code.
                </div>
              )}
            </div>

            {/* All orgs table */}
            {zipData.orgs.length > 0 && (
              <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 16 }}>
                  All Organizations · {zip}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Name', 'Faith', 'Type', 'City', 'Est.'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px 10px', color: '#5a6478', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...islamicOrgs, ...visibleOther].map(o => {
                      const color = FAITH_COLORS[o.ntee_category] ?? '#8A98AE'
                      return (
                        <tr key={o.ein} className="org-row" style={{ borderBottom: '1px solid #1a1f2e' }}>
                          <td style={{ padding: '8px 8px', color: '#C8D4E4', maxWidth: 260, wordBreak: 'break-word' }}>{o.name}</td>
                          <td style={{ padding: '8px 8px' }}>
                            <span style={{ color, fontSize: 10, border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 6px' }}>{o.ntee_category}</span>
                          </td>
                          <td style={{ padding: '8px 8px', color: '#8A98AE' }}>{o.ntee_label}</td>
                          <td style={{ padding: '8px 8px', color: '#8A98AE' }}>{o.city}</td>
                          <td style={{ padding: '8px 8px', color: o.ruling_year && o.ruling_year >= 2015 ? '#E8B84B' : '#5a6478' }}>
                            {o.ruling_year ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {otherOrgs.length > 10 && (
                  <button
                    onClick={() => setShowAll(v => !v)}
                    style={{ marginTop: 14, background: 'transparent', border: '1px solid #232940', borderRadius: 6, color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}
                  >
                    {showAll ? '▲ Show fewer' : `Show all ${zipData.orgs.length} orgs ▼`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 48, padding: '16px 0', borderTop: '1px solid #1e2b3c', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#5a6478' }}>Source: IRS EO Business Master File · Updated monthly</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#5a6478' }}>Only 501(c) registered orgs — mosques and churches below 990-filing threshold may not appear</span>
        </div>
      </div>
    </div>
  )
}
