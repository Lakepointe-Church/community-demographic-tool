'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { downloadCsv } from '@/lib/csv'
import { ZIP_GROUPS, CAMPUS_ZIPS } from '@/lib/zips'
import { sesComponents } from '@/lib/scoring'
import { StatCard } from '@/components/ui/StatCard'
import { Surface } from '@/components/ui/Surface'
import { SectionHeader } from '@/components/ui/SectionHeader'

interface ZipSes {
  zip: string
  name: string
  sesLabel: string
  sesScore: number
  medianHouseholdIncome: number | null
  medianHomeValue: number | null
  bachelorsRate: number | null
  unemploymentRate: number | null
  occMgmtProfPct: number | null
  populationGrowth: number | null
  lowReliability: boolean
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


function fmt$(n: number | null) {
  if (n == null || n <= 0) return '—'
  return '$' + n.toLocaleString()
}
function fmtPct(n: number | null) {
  if (n == null) return '—'
  return n.toFixed(1) + '%'
}

function trend(growth: number | null): { label: string; color: string } {
  if (growth == null) return { label: '—', color: '#7A8699' }
  if (growth > 2)  return { label: '↑ Growing',   color: '#2DD4BF' }
  if (growth >= 0) return { label: '→ Stable',    color: '#E8B84B' }
  return              { label: '↓ Declining',  color: '#FF6B6B' }
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
            <text x={padLeft - 6} y={y + 4} textAnchor="end" fill="#7A8699" fontSize="9" fontFamily="IBM Plex Mono">{count}</text>
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
            <text x={padL - 6} y={toY(v) + 4} textAnchor="end" fill="#7A8699" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={v}>
            <line x1={toX(v * 1000)} y1={padT} x2={toX(v * 1000)} y2={padT + plotH} stroke="#1e2b3c" strokeWidth="1" />
            <text x={toX(v * 1000)} y={padT + plotH + 14} textAnchor="middle" fill="#7A8699" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
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

// ── Campus Dot ────────────────────────────────────────────────────
function CampusDot({ status, size = 7 }: { status: 'existing' | 'soon'; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background: status === 'existing' ? '#E8B84B' : 'transparent',
      border: status === 'soon' ? '1.5px solid #E8B84B' : 'none',
      boxShadow: status === 'existing' ? '0 0 5px rgba(232,184,75,0.5)' : 'none',
    }} />
  )
}

// ── ZIP Dropdown (mirrors the Employers page selector) ────────────
function ZipDropdown({ value, onChange }: { value: string; onChange: (zip: string) => void }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = value ? ZIP_GROUPS.flatMap(g => g.zips).find(z => z.zip === value) : null
  const selectedCampus = value ? CAMPUS_ZIPS[value] : undefined

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', background: '#13161f', borderRadius: '4px', zIndex: 10 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        WebkitAppearance: 'none', appearance: 'none', backgroundColor: '#13161f',
        border: `1px solid ${open ? '#E8B84B' : '#232940'}`, color: '#F0F2F7',
        padding: '8px 34px 8px 12px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px',
        letterSpacing: '0.04em', cursor: 'pointer', outline: 'none', minWidth: '230px',
        position: 'relative', textAlign: 'left', transition: 'border-color 0.15s ease', borderRadius: '4px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        {selectedCampus && <CampusDot status={selectedCampus} />}
        <span style={{ flex: 1 }}>{selected ? `${value} — ${selected.label}` : 'DFW Overview'}</span>
        <svg width="12" height="7" viewBox="0 0 12 7" fill="none" style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: 'transform 0.15s ease',
        }}>
          <path d="M1 1l5 5 5-5" stroke="#E8B84B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          minWidth: '230px', maxHeight: '360px', overflowY: 'auto',
          background: '#0d0f14', border: '1px solid #232940', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}>
          <div onClick={() => { onChange(''); setOpen(false) }}
            onMouseEnter={() => setHovered('__metro')} onMouseLeave={() => setHovered(null)}
            style={{
              padding: '10px 14px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px',
              color: value === '' ? '#E8B84B' : hovered === '__metro' ? '#F0F2F7' : '#A8B4C5',
              background: value === '' ? 'rgba(232,184,75,0.08)' : hovered === '__metro' ? 'rgba(255,255,255,0.04)' : 'transparent',
              cursor: 'pointer', letterSpacing: '0.04em', borderBottom: '1px solid #1e2b3c',
            }}>DFW Overview</div>
          {ZIP_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#7A8699',
                letterSpacing: '0.15em', textTransform: 'uppercase', padding: '10px 14px 4px',
                position: 'sticky', top: 0, background: '#0d0f14', zIndex: 1,
              }}>{group.label}</div>
              {group.zips.map(({ zip, label }) => {
                const isSelected = zip === value, isHov = hovered === zip
                const campus = CAMPUS_ZIPS[zip]
                return (
                  <div key={zip}
                    onClick={() => { onChange(zip); setOpen(false) }}
                    onMouseEnter={() => setHovered(zip)} onMouseLeave={() => setHovered(null)}
                    style={{
                      padding: '7px 14px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px',
                      color: isSelected ? '#E8B84B' : isHov ? '#F0F2F7' : '#A8B4C5',
                      background: isSelected ? 'rgba(232,184,75,0.08)' : isHov ? 'rgba(255,255,255,0.04)' : 'transparent',
                      cursor: 'pointer', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                    <span style={{ color: isSelected ? '#E8B84B' : '#7A8699', flexShrink: 0, width: '38px' }}>{zip}</span>
                    {campus && <CampusDot status={campus} />}
                    <span>{label}</span>
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

// ── Per-ZIP SES Detail ────────────────────────────────────────────
function SesDetail({ z, rank, total, coverageAll }: { z: ZipSes | null; rank: number | null; total: number; coverageAll: boolean }) {
  if (!z) {
    return (
      <Surface className="fade-up-2" style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: '#8A98AE', lineHeight: 1.7, padding: '8px 0' }}>
          No SES data for this ZIP{!coverageAll ? ' in the Core MSA set' : ''}.
          {!coverageAll && ' Switch the coverage selector to "All ZIPs" if this is an outer-county ZIP.'}
        </div>
      </Surface>
    )
  }
  const color = TIER_COLOR[z.sesLabel] ?? '#8A98AE'
  const rgb = TIER_RGB[z.sesLabel] ?? '138,152,174'
  const t = trend(z.populationGrowth)
  const comp = sesComponents(z.medianHouseholdIncome ?? 0, z.bachelorsRate ?? 0, z.medianHomeValue ?? 0)
  // contribution out of each component's max (income 50 / bachelor 30 / home 20)
  const parts = [
    { label: 'Income', weight: '50%', value: comp.income, max: 50, color: '#4EAEFF', detail: fmt$(z.medianHouseholdIncome) },
    { label: "Bachelor's+", weight: '30%', value: comp.bachelors, max: 30, color: '#2DD4BF', detail: fmtPct(z.bachelorsRate) },
    { label: 'Home Value', weight: '20%', value: comp.homeValue, max: 20, color: '#A78BFA', detail: fmt$(z.medianHomeValue) },
  ]

  return (
    <>
      {/* ZIP header + class + score */}
      <Surface className="fade-up-2" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '34px', color: '#F0F2F7', lineHeight: 1, letterSpacing: '0.03em' }}>{z.zip}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', color: '#A8B4C5' }}>{z.name}</span>
              {z.lowReliability && <span title="Low reliability: small population, zero income, or high Census margin of error (CV > 30%)" style={{ color: '#FF6B6B', cursor: 'help', fontSize: '12px' }}>⚠</span>}
            </div>
            <span style={{
              fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '4px 10px', borderRadius: '3px',
              background: `rgba(${rgb},0.15)`, color, border: `1px solid rgba(${rgb},0.3)`,
            }}>{z.sesLabel}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '44px', color, lineHeight: 1 }}>{z.sesScore}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '13px', color: '#7A8699' }}>/100</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#7A8699', letterSpacing: '0.08em', marginTop: '2px' }}>
              SES Score{rank != null ? ` · rank #${rank} of ${total}` : ''}
            </div>
          </div>
        </div>
      </Surface>

      <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Composite breakdown */}
        <Surface>
          <SectionHeader title="Score Composition" sub="Weighted contribution to the 0–100 SES score" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
            {parts.map(p => (
              <div key={p.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: '#A8B4C5' }}>
                    {p.label} <span style={{ color: '#7A8699' }}>· {p.weight}</span>
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: p.color }}>
                    +{p.value.toFixed(1)} <span style={{ color: '#7A8699' }}>/ {p.max} · {p.detail}</span>
                  </span>
                </div>
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(p.value / p.max) * 100}%`, background: `linear-gradient(90deg,${p.color},${p.color}60)`, borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#6E7C92', marginTop: '14px', letterSpacing: '0.04em' }}>
            Income capped at $200K · home value at $800K · bachelor&apos;s rate ×2 (50% → cap). See /methodology.
          </div>
        </Surface>

        {/* Underlying stats */}
        <Surface>
          <SectionHeader title="Indicators" sub={`${z.name} · ACS 5-Year`} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
            {[
              { label: 'Median HHI', value: fmt$(z.medianHouseholdIncome) },
              { label: 'Median Home Value', value: fmt$(z.medianHomeValue) },
              { label: '% Bachelor’s+', value: fmtPct(z.bachelorsRate) },
              { label: '% Mgmt/Prof', value: fmtPct(z.occMgmtProfPct) },
              { label: 'Unemployment', value: fmtPct(z.unemploymentRate), color: z.unemploymentRate != null && z.unemploymentRate > 5 ? '#FF6B6B' : '#F0F2F7' },
              { label: 'Pop. Trend', value: t.label, color: t.color },
            ].map(s => (
              <div key={s.label} style={{ background: '#0d0f14', border: '1px solid #1e2b3c', borderRadius: '4px', padding: '12px 14px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.12em', color: '#8A98AE', textTransform: 'uppercase', marginBottom: '5px' }}>{s.label}</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '24px', color: s.color ?? '#F0F2F7', lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </>
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
  const [showUnreliable, setShowUnreliable] = useState(false)
  const [coverage, setCoverage] = useState<'core' | 'all'>('core')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedZip, setSelectedZip] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('coverage') === 'all') setCoverage('all')
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/ses-classes?coverage=${coverage}`)
      .then(r => r.json())
      .then(d => { setZips(d.zips ?? []); setSummary(d.summary ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [coverage, refreshKey])

  function handleCoverageChange(val: 'core' | 'all') {
    setCoverage(val)
    const url = new URL(window.location.href)
    val === 'all' ? url.searchParams.set('coverage', 'all') : url.searchParams.delete('coverage')
    window.history.replaceState(null, '', url.toString())
  }

  const filtered = useMemo(() => {
    let base = showUnreliable ? zips : zips.filter(z => !z.lowReliability)
    if (filter !== 'All') base = base.filter(z => z.sesLabel === filter)
    return [...base].sort((a, b) => {
      const va = a[sortCol] ?? -1
      const vb = b[sortCol] ?? -1
      return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number)
    })
  }, [zips, filter, sortCol, sortDir, showUnreliable])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const upper   = (summary?.countByTier['Upper'] ?? 0) + (summary?.countByTier['Upper Middle'] ?? 0)
  const middle  = summary?.countByTier['Middle'] ?? 0
  const lower   = (summary?.countByTier['Lower Middle'] ?? 0) + (summary?.countByTier['Lower Income'] ?? 0)

  const FILTER_TABS = ['All', ...TIERS]

  // Selected-ZIP detail + its rank by SES score within the loaded coverage set
  const selectedData = selectedZip ? zips.find(z => z.zip === selectedZip) ?? null : null
  const selectedRank = useMemo(() => {
    if (!selectedData) return null
    const sorted = [...zips].sort((a, b) => b.sesScore - a.sesScore)
    const idx = sorted.findIndex(z => z.zip === selectedData.zip)
    return idx >= 0 ? idx + 1 : null
  }, [zips, selectedData])

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
        <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
              Dashboard · SES Classes
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px,4vw,52px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
              Socioeconomic<br />Segmentation
            </h1>
            <div style={{ width: '48px', height: '2px', background: 'linear-gradient(90deg, #E8B84B, rgba(232,184,75,0))', marginTop: '16px' }} />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.08em', marginTop: '12px', textTransform: 'uppercase' as const }}>
              ACS-Derived Class Classification · {summary?.total ?? '—'} {coverage === 'core' ? 'Core MSA' : 'All DFW'} ZIPs
            </div>
          </div>
          {/* ZIP selector + Coverage / Reliability / Refresh controls */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0, marginTop: '4px', position: 'relative', zIndex: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#8A98AE', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Select ZIP Code</div>
            <ZipDropdown value={selectedZip} onChange={setSelectedZip} />
          </div>
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
              onClick={() => setShowUnreliable(v => !v)}
              title="Low-reliability ZIPs: population < 2,500, $0 income, or high Census margin of error (CV > 30%)"
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.06em',
                background: showUnreliable ? 'rgba(255,107,107,0.12)' : 'transparent',
                color: showUnreliable ? '#FF6B6B' : '#8A98AE',
                border: `1px solid ${showUnreliable ? 'rgba(255,107,107,0.4)' : '#232940'}`,
                borderRadius: '4px', padding: '6px 10px', cursor: 'pointer',
              }}
            >
              ⚠ Unreliable
            </button>
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
              ↺ Reload
            </button>
          </div>
          </div>
        </div>

        {/* ── Per-ZIP detail ── */}
        {selectedZip && (
          <SesDetail z={selectedData} rank={selectedRank} total={zips.length} coverageAll={coverage === 'all'} />
        )}

        {/* ── DFW Overview ── */}
        {!selectedZip && (
        <>
        {/* Stat cards */}
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
          <StatCard label="Avg SES Score" value={loading ? '—' : String(summary?.avgScore ?? '—')} sub={coverage === 'core' ? 'Core MSA avg' : 'All DFW avg'} color="#E8B84B" loading={loading} />
          <StatCard label="Upper Middle+" value={loading ? '—' : String(upper)} sub={`of ${summary?.total ?? '—'} ZIPs`} color="#4EAEFF" loading={loading} />
          <StatCard label="Middle Class" value={loading ? '—' : String(middle)} sub="score 40–57" color="#2DD4BF" loading={loading} />
          <StatCard label="Lower Middle & Below" value={loading ? '—' : String(lower)} sub="score below 40" color="#FF6B6B" loading={loading} />
        </div>

        {/* Charts */}
        <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <Surface>
            <SectionHeader title="SES Class Distribution" sub={`Count of ${coverage === 'core' ? 'Core MSA' : 'all DFW'} ZIPs per tier`} />
            {loading
              ? <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              : <DistributionChart countByTier={summary?.countByTier ?? {}} total={summary?.total ?? 0} />
            }
          </Surface>
          <Surface>
            <SectionHeader title="Composite SES Score by ZIP" sub="Hover dots for ZIP details" />
            {loading
              ? <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              : <ScatterPlot zips={zips} />
            }
            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const, marginTop: '12px' }}>
              {TIERS.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TIER_COLOR[t] }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8A98AE' }}>{t}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        {/* Table */}
        <Surface className="fade-up-4">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#8A98AE', textTransform: 'uppercase' as const }}>
              Top ZIPs by SES Classification
            </div>
            <button
              disabled={!filtered.length}
              onClick={() => downloadCsv('lakepointe-ses-classes.csv',
                ['ZIP', 'Area', 'SES Score', 'SES Class', 'Median HHI', '% Bachelor+', '% Mgmt/Prof', 'Unemployment %', 'Pop Growth %'],
                filtered.map(z => [z.zip, z.name, z.sesScore, z.sesLabel, z.medianHouseholdIncome, z.bachelorsRate, z.occMgmtProfPct, z.unemploymentRate, z.populationGrowth])
              )}
              style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', padding:'5px 12px', borderRadius:'3px', cursor:'pointer', border:'1px solid #232940', background:'transparent', color:'#8A98AE', flexShrink:0 }}
            >↓ CSV</button>
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
                ) : filtered.slice(0, 10).map(z => {
                  const color = TIER_COLOR[z.sesLabel] ?? '#8A98AE'
                  const rgb   = TIER_RGB[z.sesLabel] ?? '138,152,174'
                  const t = trend(z.populationGrowth)
                  const dimmed = z.lowReliability
                  return (
                    <tr key={z.zip} className="ses-row" style={{ borderBottom: '1px solid #1e2b3c', transition: 'background 0.15s', opacity: dimmed ? 0.45 : 1 }}>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', padding: '11px 16px 11px 0', whiteSpace: 'nowrap' as const }}>
                        {dimmed && <span title="Low reliability: small population, zero income, or high Census margin of error (CV > 30%)" style={{ color: '#FF6B6B', marginRight: '5px', cursor: 'help' }}>⚠</span>}
                        {z.zip}
                      </td>
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
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em',
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
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#7A8699', marginTop: '16px', letterSpacing: '0.06em' }}>
            Showing top {Math.min(10, filtered.length)} of {filtered.length} {filter === 'All' ? '' : `${filter} · `}{coverage === 'core' ? 'Core MSA' : 'all DFW'} ZIPs{!showUnreliable && zips.some(z => z.lowReliability) ? ` · ${zips.filter(z => z.lowReliability).length} low-reliability hidden` : ''} · pick a ZIP above for detail · CSV exports all · Source: ACS 5-Year 2023 · click headers to sort
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6E7C92', marginTop: '4px', letterSpacing: '0.06em' }}>
            Census data is reported by ZCTA (ZIP Code Tabulation Area), which approximates but does not exactly match USPS ZIP boundaries.
          </div>
        </Surface>
        </>
        )}

      </div>
    </>
  )
}
