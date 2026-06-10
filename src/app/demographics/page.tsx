'use client'

import { useState, useEffect, useRef } from 'react'
import { DFW_ZIPS, ZIP_GROUPS, CAMPUS_ZIPS } from '@/lib/zips'
import { InfoTooltip } from '@/components/InfoTooltip'

interface CensusData {
  zip: string
  name: string
  population: number
  populationGrowth: number | null
  medianHouseholdIncome: number
  medianHomeValue: number
  totalHouseholds: number
  avgHouseholdSize: number
  hhWithChildrenPct: number
  unemploymentRate: string
  bachelorsRate: string
  sesClass: { label: string; score: number }
  yfi: number
  wfi: number
  dualEarnerPct: number | null
  commute30PlusPct: number | null
  race: { white: number; hispanic: number; black: number; asian: number; other: number }
  education: { noHSDiploma: number; hsDiploma: number; someCollege: number; bachelorsPlus: number }
  ageDistribution: { age0_17: number; age18_34: number; age35_54: number; age55_74: number; age75plus: number } | null
  householdTypes: { marriedWithChildren: number; marriedNoChildren: number; singleParent: number; livingAlone: number; other: number } | null
  incomeBrackets: { label: string; pct: number }[]
  updatedAt: string
}

interface College {
  name: string
  city: string
  state: string
  enrollment: number | null
  completionRate4yr: number | null
  avgNetPrice: number | null
  medianEarnings10yr: number | null
}

function fmtK(n: number) {
  if (!n || n < 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function fmt(n: number, style: 'currency' | 'decimal' = 'decimal') {
  if (!n || n < 0) return '—'
  if (style === 'currency') return '$' + n.toLocaleString()
  return n.toLocaleString()
}

function indexLabel(score: number): string {
  if (score >= 75) return 'High'
  if (score >= 50) return 'Moderate-High'
  if (score >= 25) return 'Moderate-Low'
  return 'Low'
}

const ACCENT_RGB: Record<string, string> = {
  gold: '232,184,75', blue: '78,174,255', coral: '255,107,107',
  teal: '45,212,191', purple: '167,139,250',
}

const CARD_SURFACE = 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = 'gold', loading = false, tooltip }: {
  label: string; value: string; sub?: string
  accent?: 'gold' | 'blue' | 'coral' | 'teal' | 'purple'
  loading?: boolean
  tooltip?: string
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
          ? `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.22) 0%, transparent 60%), linear-gradient(145deg, rgba(${rgb},0.08) 0%, rgba(255,255,255,0.01) 100%)`
          : `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.1) 0%, transparent 55%), linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`,
        border: `1px solid ${hovered ? `rgba(${rgb},0.4)` : '#232940'}`,
        padding: '24px',
        position: 'relative' as const,
        transition: 'background 0.2s ease, border-color 0.2s ease',
        cursor: 'default',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color }} />
      {tooltip && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 50 }}>
          <InfoTooltip text={tooltip} placement="below-right" />
        </div>
      )}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#A8B4C5', marginBottom: '12px' }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: '40px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '44px', lineHeight: 1, letterSpacing: '0.03em', color: '#F0F2F7' }}>
            {value}
          </div>
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

// ── Campus Dot ───────────────────────────────────────────────────
function CampusDot({ status, size = 8 }: { status: 'existing' | 'soon'; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background: status === 'existing' ? '#E8B84B' : 'transparent',
      border: status === 'soon' ? '1.5px solid #E8B84B' : 'none',
      boxShadow: status === 'existing' ? '0 0 5px rgba(232,184,75,0.5)' : 'none',
    }} />
  )
}

// ── ZIP Dropdown ──────────────────────────────────────────────────
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

  const selected = DFW_ZIPS.find(z => z.zip === value)
  const selectedCampus = CAMPUS_ZIPS[value]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', background: '#13161f', borderRadius: '4px', zIndex: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          WebkitAppearance: 'none' as const,
          appearance: 'none' as const,
          backgroundColor: '#13161f',
          background: '#13161f',
          border: `1px solid ${open ? '#E8B84B' : '#232940'}`,
          color: '#F0F2F7',
          padding: '9px 36px 9px 14px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '13px',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          outline: 'none',
          minWidth: '260px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'relative',
          textAlign: 'left',
          transition: 'border-color 0.15s ease',
          borderRadius: '4px',
        }}
      >
        {selectedCampus && <CampusDot status={selectedCampus} size={7} />}
        <span style={{ flex: 1 }}>{value} — {selected?.label}</span>
        <svg width="12" height="7" viewBox="0 0 12 7" fill="none" style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: 'transform 0.15s ease', flexShrink: 0,
        }}>
          <path d="M1 1l5 5 5-5" stroke="#E8B84B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          minWidth: '260px',
          maxHeight: '360px',
          overflowY: 'auto',
          background: '#0d0f14',
          border: '1px solid #232940',
          zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}>
          {ZIP_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                color: '#5a6478',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                padding: '10px 14px 4px',
                position: 'sticky',
                top: 0,
                background: '#0d0f14',
                zIndex: 1,
              }}>
                {group.label}
              </div>
              {group.zips.map(({ zip, label }) => {
                const campus = CAMPUS_ZIPS[zip]
                const isSelected = zip === value
                const isHovered = hovered === zip
                return (
                  <button
                    key={zip}
                    onClick={() => { onChange(zip); setOpen(false) }}
                    onMouseEnter={() => setHovered(zip)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      width: '100%',
                      background: isSelected
                        ? 'rgba(232,184,75,0.1)'
                        : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                      border: 'none',
                      padding: '7px 14px',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      letterSpacing: '0.03em',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 7, height: 7, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                      {campus && <CampusDot status={campus} size={7} />}
                    </span>
                    <span style={{ color: isSelected ? '#E8B84B' : '#C8D4E4', minWidth: '44px' }}>{zip}</span>
                    <span style={{ color: isSelected ? '#E8B84B' : '#8A98AE', fontSize: '11px' }}>{label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Race Donut Chart ─────────────────────────────────────────────
const RACE_SEGS = [
  { key: 'white'    as const, label: 'White',    color: '#4EAEFF' },
  { key: 'hispanic' as const, label: 'Hispanic', color: '#FF6B6B' },
  { key: 'black'    as const, label: 'Black',    color: '#A78BFA' },
  { key: 'asian'    as const, label: 'Asian',    color: '#2DD4BF' },
  { key: 'other'    as const, label: 'Other',    color: '#E8B84B' },
]

function DonutChart({ race, loading }: { race: CensusData['race'] | null; loading: boolean }) {
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
        RACE
      </text>
    </svg>
  )
}

// ── Education Bar Chart ──────────────────────────────────────────
const EDU_SEGS = [
  { key: 'bachelorsPlus' as const, label: "Bachelor's+",   color: '#4EAEFF' },
  { key: 'someCollege'   as const, label: 'Some College',  color: '#2DD4BF' },
  { key: 'hsDiploma'     as const, label: 'HS Diploma',    color: '#E8B84B' },
  { key: 'noHSDiploma'   as const, label: 'No HS Diploma', color: '#FF6B6B' },
]

function EducationChart({ education, loading }: { education: CensusData['education'] | null; loading: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {EDU_SEGS.map(({ key, label, color }) => {
        const value = education?.[key] ?? 0
        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#A8B4C5', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{label}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', fontWeight: 600 }}>
                {loading ? '—' : `${value.toFixed(1)}%`}
              </span>
            </div>
            <div style={{ height: '7px', background: '#1e2b3c', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: loading ? '0%' : `${Math.min(value, 100)}%`,
                background: `linear-gradient(90deg, ${color}, ${color}80)`,
                borderRadius: '4px', transition: 'width 0.7s ease',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Age Distribution Chart (vertical bars) ───────────────────────
const AGE_SEGS = [
  { key: 'age0_17'   as const, label: '0–17',  color: '#4EAEFF' },
  { key: 'age18_34'  as const, label: '18–34', color: '#2DD4BF' },
  { key: 'age35_54'  as const, label: '35–54', color: '#E8B84B' },
  { key: 'age55_74'  as const, label: '55–74', color: '#A78BFA' },
  { key: 'age75plus' as const, label: '75+',   color: '#FF6B6B' },
]

function AgeChart({ ageDistribution, loading }: {
  ageDistribution: CensusData['ageDistribution']
  loading: boolean
}) {
  const values = ageDistribution
    ? AGE_SEGS.map(s => ageDistribution[s.key] ?? 0)
    : AGE_SEGS.map(() => 0)
  const maxPct   = Math.max(...values, 5)
  const barW = 58, gap = 14, chartH = 140, padL = 28, padTop = 22
  const totalW = AGE_SEGS.length * (barW + gap) - gap

  return (
    <svg width={totalW + padL + 8} height={padTop + chartH + 40} style={{ overflow: 'visible' }}>
      <defs>
        {AGE_SEGS.map(seg => (
          <linearGradient key={seg.key} id={`ageGrad-${seg.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={seg.color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={seg.color} stopOpacity="0.2" />
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
      {AGE_SEGS.map((seg, idx) => {
        const val  = loading ? 0 : (values[idx] ?? 0)
        const barH = (val / maxPct) * chartH
        const x    = padL + idx * (barW + gap)
        return (
          <g key={seg.key}>
            <rect x={x} y={padTop + chartH - barH} width={barW} height={barH}
              fill={`url(#ageGrad-${seg.key})`}
              style={{ transition: 'all 0.6s ease' }}
            />
            <rect x={x} y={padTop + chartH - barH} width={barW} height={3} fill={seg.color} />
            {!loading && val > 0 && (
              <text x={x + barW / 2} y={padTop + chartH - barH - 7} textAnchor="middle"
                fill="#C8D4E4" fontFamily="IBM Plex Mono" fontSize="10">{val.toFixed(1)}%
              </text>
            )}
            <text x={x + barW / 2} y={padTop + chartH + 18} textAnchor="middle"
              fill="#A8B4C5" fontFamily="IBM Plex Mono" fontSize="10">{seg.label}
            </text>
          </g>
        )
      })}
      <line x1={padL} y1={padTop + chartH} x2={padL + totalW} y2={padTop + chartH} stroke="#232940" strokeWidth={1} />
    </svg>
  )
}

// ── Household Type Donut ─────────────────────────────────────────
const HH_SEGS = [
  { key: 'marriedWithChildren' as const, label: 'Married w/ Children', color: '#2DD4BF' },
  { key: 'marriedNoChildren'   as const, label: 'Married No Children', color: '#4EAEFF' },
  { key: 'singleParent'        as const, label: 'Single Parent',       color: '#FF6B6B' },
  { key: 'livingAlone'         as const, label: 'Living Alone',        color: '#A78BFA' },
  { key: 'other'               as const, label: 'Other',               color: '#E8B84B' },
]

function HouseholdTypeChart({ householdTypes, loading }: {
  householdTypes: CensusData['householdTypes']
  loading: boolean
}) {
  const cx = 100, cy = 100, r = 70, sw = 30
  const circ = 2 * Math.PI * r

  if (loading || !householdTypes) {
    return <div style={{ width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
  }

  let cumPct = 0
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2b3c" strokeWidth={sw} />
      {HH_SEGS.filter(s => (householdTypes[s.key] ?? 0) > 0.3).map(seg => {
        const pct = (householdTypes[seg.key] ?? 0) / 100
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
        HH TYPE
      </text>
    </svg>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export default function DemographicsPage() {
  const [selectedZip, setSelectedZip] = useState<string>(DFW_ZIPS[0].zip)
  const [data, setData] = useState<CensusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [colleges, setColleges] = useState<College[]>([])
  const [collegesLoading, setCollegesLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/census?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedZip])

  useEffect(() => {
    setCollegesLoading(true)
    setColleges([])
    fetch(`/api/scorecard?zip=${selectedZip}&radius=15`)
      .then(r => r.json())
      .then(d => { setColleges(d.schools ?? []); setCollegesLoading(false) })
      .catch(() => setCollegesLoading(false))
  }, [selectedZip])

  const selectedLabel = DFW_ZIPS.find(z => z.zip === selectedZip)?.label ?? selectedZip
  const campusStatus = CAMPUS_ZIPS[selectedZip]

  const yfiAccent = (s: number) => s >= 75 ? 'teal' : s >= 50 ? 'blue' : s >= 25 ? 'gold' : 'coral'
  const wfiAccent = (s: number) => s >= 75 ? 'blue' : s >= 50 ? 'teal' : s >= 25 ? 'gold' : 'coral'

  return (
    <>
      <style>{`
        .zip-scroll::-webkit-scrollbar { width: 4px; }
        .zip-scroll::-webkit-scrollbar-track { background: #0d0f14; }
        .zip-scroll::-webkit-scrollbar-thumb { background: #232940; border-radius: 2px; }
        .zip-scroll::-webkit-scrollbar-thumb:hover { background: #3a4861; }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '40px 32px', maxWidth: '1440px', margin: '0 auto' }}>

          {/* Header */}
          <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px', position: 'relative', zIndex: 20 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
                Dashboard · Demographics
              </div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 4vw, 52px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
                Demographic<br />Profile
              </h1>
              <div style={{ width: '48px', height: '2px', background: 'linear-gradient(90deg, #E8B84B, rgba(232,184,75,0))', marginTop: '16px' }} />
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.08em', marginTop: '12px', textTransform: 'uppercase' as const }}>
                ZIP-Level Demographic Breakdown
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
                Select ZIP Code
              </div>
              <ZipDropdown value={selectedZip} onChange={setSelectedZip} />
              {selectedZip && (
                <div style={{ marginTop: '8px', textAlign: 'right' }}>
                  <a
                    href={`/zip/${selectedZip}/print`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', padding:'5px 12px', borderRadius:'3px', border:'1px solid #232940', background:'transparent', color:'#8A98AE', textDecoration:'none', display:'inline-block', transition:'all 0.15s' }}
                  >
                    ↗ Print One-Pager
                  </a>
                </div>
              )}
              {data && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.06em', marginTop: '7px' }}>
                  Updated {new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              {campusStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '8px', justifyContent: 'flex-end' }}>
                  <CampusDot status={campusStatus} size={8} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#E8B84B', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
                    {campusStatus === 'existing' ? 'Lakepointe Campus' : 'Campus Coming Soon'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Top stat row */}
          <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <StatCard
              label="Population"
              value={data ? fmtK(data.population) : '—'}
              sub={data?.populationGrowth != null
                ? `↑ ${data.populationGrowth}% since 2020`
                : `ZIP ${selectedZip} · ${selectedLabel}`}
              accent="gold" loading={loading}
              tooltip={"ACS 5-Year 2023 population estimate. Growth % is vs. the 2020 Census count.\n\nSource: Census B01001."}
            />
            <StatCard
              label="Median HH Income"
              value={data ? `$${fmtK(data.medianHouseholdIncome)}` : '—'}
              sub="ACS 5-Year Estimate" accent="blue" loading={loading}
              tooltip={"Median household income in the past 12 months, inflation-adjusted to 2023 dollars.\n\nSource: Census B19013."}
            />
            <StatCard
              label="SES Class"
              value={data?.sesClass?.label ?? '—'}
              sub={data?.sesClass ? `Score: ${data.sesClass.score}/100` : 'Composite score'}
              accent={
                data?.sesClass?.label === 'Upper' ? 'gold' :
                data?.sesClass?.label === 'Upper Middle' ? 'blue' :
                data?.sesClass?.label === 'Middle' ? 'teal' : 'coral'
              }
              loading={loading}
              tooltip={"Composite score 0–100: household income (50%), bachelor's+ rate (30%), median home value (20%).\n\nBands: Upper 78+, Upper Middle 58–77, Middle 40–57, Lower Middle 25–39, Lower <25.\n\nSource: Derived from ACS 2023."}
            />
            <StatCard
              label="HH w/ Children (18-)"
              value={data ? `${data.hhWithChildrenPct}%` : '—'}
              sub="of all households" accent="teal" loading={loading}
              tooltip={"Households with own children under 18 as a percent of all households.\n\nSource: Census B11005."}
            />
          </div>

          {/* Second stat row */}
          <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <StatCard
              label="Avg Household Size"
              value={data ? `${data.avgHouseholdSize}` : '—'}
              sub="persons per household" accent="purple" loading={loading}
              tooltip={"Average number of persons per occupied housing unit.\n\nSource: Census B25010."}
            />
            <StatCard
              label="Median Home Value"
              value={data ? `$${fmtK(data.medianHomeValue)}` : '—'}
              sub="ACS 5-Year Estimate" accent="gold" loading={loading}
              tooltip={"Median value of owner-occupied housing units.\n\nSource: Census B25077."}
            />
            <StatCard
              label="Unemployment Rate"
              value={data?.unemploymentRate ? `${data.unemploymentRate}%` : '—'}
              sub="Labor force basis · ACS"
              accent={parseFloat(data?.unemploymentRate ?? '0') > 5 ? 'coral' : 'teal'}
              loading={loading}
              tooltip={"Unemployed civilians as a percent of the total labor force.\n\nSource: Census B23025."}
            />
            <StatCard
              label="Bachelor's Degree+"
              value={data?.bachelorsRate ? `${data.bachelorsRate}%` : '—'}
              sub="Adults 25+ · ACS" accent="blue" loading={loading}
              tooltip={"Adults 25+ with a bachelor's degree or higher as a percent of adults 25+.\n\nSource: Census B15003."}
            />
          </div>

          {/* Lakepointe Indexes row */}
          <div className="fade-up-3" style={{ marginBottom: '36px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', color: '#5a6478', textTransform: 'uppercase' as const, marginBottom: '8px', marginTop: '4px' }}>
              Lakepointe Indexes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <StatCard
                label="Young Family Index"
                value={data ? `${data.yfi}` : '—'}
                sub={data ? `${indexLabel(data.yfi)} · /100` : 'Composite index'}
                accent={data ? yfiAccent(data.yfi) as 'teal' | 'blue' | 'gold' | 'coral' : 'teal'}
                loading={loading}
                tooltip={"Young Family Index (0–100): % population under 18 (40%) + % family households (25%) + fertility rate (20%) + avg household size (15%).\n\nSource: Derived from ACS 2023."}
              />
              <StatCard
                label="Working Family Index"
                value={data ? `${data.wfi}` : '—'}
                sub={data ? `${indexLabel(data.wfi)} · /100` : 'Composite index'}
                accent={data ? wfiAccent(data.wfi) as 'blue' | 'teal' | 'gold' | 'coral' : 'blue'}
                loading={loading}
                tooltip={"Working Family Index (0–100): dual-earner rate (40%) + working parent rate (25%) + commute burden (20%) + occupational mix (15%).\n\nSource: Derived from ACS 2023."}
              />
              <StatCard
                label="Dual-Earner HH"
                value={data?.dualEarnerPct != null ? `${data.dualEarnerPct}%` : '—'}
                sub="of married-couple families"
                accent="purple" loading={loading}
                tooltip={"Married-couple families where both spouses are in the labor force, as a percent of all families.\n\nSource: Census B23007."}
              />
              <StatCard
                label="Long Commute"
                value={data?.commute30PlusPct != null ? `${data.commute30PlusPct}%` : '—'}
                sub="workers · 30+ min each way"
                accent={data?.commute30PlusPct != null && data.commute30PlusPct > 50 ? 'coral' : 'teal'}
                loading={loading}
                tooltip={"Workers 16+ who travel 30 minutes or more to work, as a percent of all workers.\n\nSource: Census B08303."}
              />
            </div>
          </div>

          {/* Charts — Race / Ethnicity + Education */}
          <div className="fade-up-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '36px' }}>

            <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
              <SectionHeader eyebrow="U.S. Census Bureau · ACS 2023" title="Race / Ethnicity" />
              <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                <DonutChart race={data?.race ?? null} loading={loading} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  {RACE_SEGS.map(seg => (
                    <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#A8B4C5', flex: 1 }}>{seg.label}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#F0F2F7', fontWeight: 600 }}>
                        {loading ? '—' : `${(data?.race?.[seg.key] ?? 0).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
              <SectionHeader eyebrow="Adults 25+ · ACS 5-Year" title="Educational Attainment" />
              <EducationChart education={data?.education ?? null} loading={loading} />
            </div>
          </div>

          {/* Age Distribution + Household Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
              <SectionHeader eyebrow="U.S. Census Bureau · ACS 2023" title="Age Distribution" />
              <div style={{ overflowX: 'auto' }}>
                <AgeChart ageDistribution={data?.ageDistribution ?? null} loading={loading} />
              </div>
            </div>

            <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px' }}>
              <SectionHeader eyebrow="U.S. Census Bureau · ACS 2023" title="Household Type" />
              <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                <HouseholdTypeChart householdTypes={data?.householdTypes ?? null} loading={loading} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  {HH_SEGS.map(seg => (
                    <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#A8B4C5', flex: 1 }}>{seg.label}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#F0F2F7', fontWeight: 600 }}>
                        {loading || !data?.householdTypes ? '—' : `${(data.householdTypes[seg.key] ?? 0).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Nearby Colleges */}
          <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px', marginBottom: '16px' }}>
            <SectionHeader eyebrow="College Scorecard · Within 15 Miles" title="Nearby Colleges" />
            {collegesLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
            ) : colleges.length === 0 ? (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#8A98AE', letterSpacing: '0.04em' }}>
                No colleges found within 15 miles.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 140px', gap: '0', minWidth: '560px' }}>
                  {['School', 'Enrollment', '4-Yr Completion', 'Median Earnings (10yr)'].map(h => (
                    <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8A98AE', letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '0 12px 10px 0', borderBottom: '1px solid #232940' }}>{h}</div>
                  ))}
                  {colleges.map((c, idx) => (
                    <>
                      <div key={`n${idx}`} style={{ padding: '10px 12px 10px 0', borderBottom: '1px solid #1e2b3c' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', letterSpacing: '0.02em' }}>{c.name}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8A98AE', marginTop: '2px' }}>{c.city}, {c.state}</div>
                      </div>
                      <div key={`e${idx}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', padding: '10px 12px 10px 0', borderBottom: '1px solid #1e2b3c', alignContent: 'center' }}>
                        {c.enrollment != null ? c.enrollment.toLocaleString() : '—'}
                      </div>
                      <div key={`c${idx}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: c.completionRate4yr != null && c.completionRate4yr > 0.6 ? '#2DD4BF' : '#F0F2F7', padding: '10px 12px 10px 0', borderBottom: '1px solid #1e2b3c', alignContent: 'center' }}>
                        {c.completionRate4yr != null ? `${Math.round(c.completionRate4yr * 100)}%` : '—'}
                      </div>
                      <div key={`m${idx}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#4EAEFF', padding: '10px 12px 10px 0', borderBottom: '1px solid #1e2b3c', alignContent: 'center' }}>
                        {c.medianEarnings10yr != null ? `$${fmtK(c.medianEarnings10yr)}` : '—'}
                      </div>
                    </>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', letterSpacing: '0.06em', marginTop: '16px', lineHeight: 1.7 }}>
              Source: U.S. Dept. of Education College Scorecard · collegescorecard.ed.gov<br />
              — indicates data not reported: institution below Scorecard disclosure threshold · trade/vocational schools excluded
            </div>
          </div>

          {/* Detail row */}
          <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px', marginBottom: '40px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#A8B4C5', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #1e2b3c' }}>
              ZIP {selectedZip} · Full Profile · U.S. Census Bureau ACS 2023
            </div>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ height: '18px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
            ) : data ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>
                {[
                  ['Geography', data.name],
                  ['Total Population', data.population.toLocaleString()],
                  ['Total Households', data.totalHouseholds.toLocaleString()],
                  ['Median HH Income', fmt(data.medianHouseholdIncome, 'currency')],
                  ['Median Home Value', fmt(data.medianHomeValue, 'currency')],
                  ['Unemployment Rate', `${data.unemploymentRate}%`],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px 12px 0', borderBottom: '1px solid #1e2b3c' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#A8B4C5' }}>{label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#F0F2F7', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #1e2b3c', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', letterSpacing: '0.08em' }}>
                Source: U.S. Census Bureau ACS 5-Year Estimates (2023) · api.census.gov
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#5a6478', letterSpacing: '0.08em' }}>
                Lakepointe Church · Community Intelligence Platform · Internal Use Only
              </span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#3d4a5c', letterSpacing: '0.06em' }}>
              Census data is reported by ZCTA (ZIP Code Tabulation Area), which approximates but does not exactly match USPS ZIP boundaries.
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
