'use client'

import { useState, useEffect, useRef } from 'react'
import { DFW_ZIPS, ZIP_GROUPS, CAMPUS_ZIPS, BOUNDARY_CHANGED } from '@/lib/zips'
import { StatCardAccent as StatCard } from '@/components/ui/StatCardAccent'
import { SectionTitle as SectionHeader } from '@/components/ui/SectionTitle'
import { Surface } from '@/components/ui/Surface'

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

// ── Types for Phase 5 Leading Indicators ────────────────────────
interface LeadingIndicators {
  county: string
  permits: {
    available: boolean
    trend: { year: number; sfPermits: number; mfPermits: number; totalPermits: number }[]
    momentumPct: number | null
  }
  enrollment: {
    available: boolean
    trend: { year: number; enrollment: number }[]
    cagrPct: number | null
  }
  projection: {
    available: boolean
    base2020?: number | null
    proj2030?: number | null
    proj2040?: number | null
  }
  placesPermits: {
    available: boolean
    year: number | null
    top: { name: string; sfPermits: number; mfPermits: number; totalPermits: number; yoyPct: number | null }[]
  }
}

// ── Types for Commute Corridors (LODES, Phase 4.5) ──────────────
interface CommuteData {
  available: boolean
  zip: string
  county: string | null
  year?: number
  totalWorkers?: number
  workInZip?: number
  selfContainmentPct?: number
  direction?: { label: string; bearingDeg: number | null; concentration: number | null } | null
  topDestZip?: string | null
  topDestLabel?: string | null
  corridors?: { zip: string; label: string; jobs: number; highEarnerJobs: number; highPct: number }[]
}

// ── Types for Giving Capacity (IRS SOI, Phase 4.4) ──────────────
interface GivingCapacity {
  available: boolean
  zip: string
  year?: number
  totalReturns?: number
  itemizerRate?: number | null
  charitableReturns?: number
  givingReturnRate?: number | null
  avgGiftPerGivingReturn?: number | null
  charitablePerFiler?: number | null
  charitablePctAgi?: number | null
  avgAgiPerReturn?: number | null
  totalCharitable?: number
}

// ── Types for Address Momentum (HUD USPS, Phase 4.1) ────────────
interface AddressMomentum {
  available: boolean
  zip: string
  county: string | null
  latestQuarter?: string
  resActive?: number
  momentumPct?: number | null
  qoqPct?: number | null
  series?: { quarter: string; resActive: number }[]
}

// ── Types for Migration Flows (IRS SOI, Phase 4.6) ──────────────
interface MigrationCounty {
  fips: string
  name: string
  state: string | null
  returns: number
  individuals: number
  avgAgi: number | null
}
interface MigrationData {
  available: boolean
  zip: string
  county: string | null
  year?: number
  inboundHouseholds?: number | null
  outboundHouseholds?: number | null
  netHouseholds?: number | null
  inboundAvgAgi?: number | null
  outboundAvgAgi?: number | null
  topOrigins?: MigrationCounty[]
  topDestinations?: MigrationCounty[]
}

// ── Types for Home Values (Zillow ZHVI, Phase 4.7) ──────────────
interface HomeValues {
  available: boolean
  zip: string
  latestMonth?: string
  zhvi?: number
  zhviYoy?: number | null
  series?: { month: string; value: number }[]
}

// ── Page ─────────────────────────────────────────────────────────
export default function DemographicsPage() {
  const [selectedZip, setSelectedZip] = useState<string>(DFW_ZIPS[0].zip)
  const [data, setData] = useState<CensusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [colleges, setColleges] = useState<College[]>([])
  const [collegesLoading, setCollegesLoading] = useState(true)
  const [leadingIndicators, setLeadingIndicators] = useState<LeadingIndicators | null>(null)
  const [leadingLoading, setLeadingLoading] = useState(true)
  const [commute, setCommute] = useState<CommuteData | null>(null)
  const [addressMomentum, setAddressMomentum] = useState<AddressMomentum | null>(null)
  const [giving, setGiving] = useState<GivingCapacity | null>(null)
  const [homeValues, setHomeValues] = useState<HomeValues | null>(null)
  const [migration, setMigration] = useState<MigrationData | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/census?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedZip])

  useEffect(() => {
    setLeadingLoading(true)
    setLeadingIndicators(null)
    fetch(`/api/leading-indicators?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setLeadingIndicators(d); setLeadingLoading(false) })
      .catch(() => setLeadingLoading(false))
  }, [selectedZip])

  useEffect(() => {
    setCommute(null)
    fetch(`/api/commute?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setCommute(d) })
      .catch(() => {})
  }, [selectedZip])

  useEffect(() => {
    setAddressMomentum(null)
    fetch(`/api/address-momentum?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setAddressMomentum(d) })
      .catch(() => {})
  }, [selectedZip])

  useEffect(() => {
    setGiving(null)
    fetch(`/api/giving?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setGiving(d) })
      .catch(() => {})
  }, [selectedZip])

  useEffect(() => {
    setHomeValues(null)
    fetch(`/api/home-values?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setHomeValues(d) })
      .catch(() => {})
  }, [selectedZip])

  useEffect(() => {
    setMigration(null)
    fetch(`/api/migration?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setMigration(d) })
      .catch(() => {})
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
                : BOUNDARY_CHANGED.has(selectedZip)
                  ? 'Growth unavailable — ZCTA boundary changed'
                  : `ZIP ${selectedZip} · ${selectedLabel}`}
              accent="gold" loading={loading}
              tooltip={"ACS 5-Year 2023 population estimate. Growth % is vs. the 2020 Decennial Census count.\n\nSource: Census B01001 (2023 ACS) + DHC P1_001N (2020 Decennial)."}
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

            <Surface>
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
            </Surface>

            <Surface>
              <SectionHeader eyebrow="Adults 25+ · ACS 5-Year" title="Educational Attainment" />
              <EducationChart education={data?.education ?? null} loading={loading} />
            </Surface>
          </div>

          {/* Age Distribution + Household Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            <Surface>
              <SectionHeader eyebrow="U.S. Census Bureau · ACS 2023" title="Age Distribution" />
              <div style={{ overflowX: 'auto' }}>
                <AgeChart ageDistribution={data?.ageDistribution ?? null} loading={loading} />
              </div>
            </Surface>

            <Surface>
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
            </Surface>
          </div>

          {/* Nearby Colleges */}
          <Surface style={{ marginBottom: '16px' }}>
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
          </Surface>

          {/* Detail row */}
          <Surface style={{ marginBottom: '40px' }}>
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
          </Surface>

          {/* Leading Indicators — Phase 5 */}
          {(leadingLoading || (leadingIndicators && (leadingIndicators.permits.available || leadingIndicators.enrollment.available || leadingIndicators.projection.available))) && (
            <Surface style={{ marginBottom: '16px' }}>
              <SectionHeader
                eyebrow={leadingIndicators?.county ? `${leadingIndicators.county} County · Forward-Looking Signals` : 'Forward-Looking Signals'}
                title="Leading Indicators"
              />

              {leadingLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              )}

              {!leadingLoading && leadingIndicators && (
                <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>

                  {/* Building Permits */}
                  <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                      Building Permits
                    </div>
                    {!leadingIndicators.permits.available ? (
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: '#3d4a5c' }}>
                        Not loaded yet — run<br />
                        <code style={{ color: '#5a6478' }}>scripts/import-permits.ts</code>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '32px', color: '#F0F2F7', lineHeight: 1 }}>
                            {leadingIndicators.permits.trend[0]?.totalPermits.toLocaleString() ?? '—'}
                          </span>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#8A98AE' }}>
                            units · {leadingIndicators.permits.trend[0]?.year}
                          </span>
                        </div>
                        {leadingIndicators.permits.momentumPct != null && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', marginBottom: '10px' }}>
                            <span style={{ color: leadingIndicators.permits.momentumPct >= 0 ? '#2DD4BF' : '#FF6B6B' }}>
                              {leadingIndicators.permits.momentumPct >= 0 ? '+' : ''}{leadingIndicators.permits.momentumPct.toFixed(1)}%
                            </span>
                            <span style={{ color: '#5a6478' }}> vs prior year</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '36px' }}>
                          {[...leadingIndicators.permits.trend].reverse().map((p, i, arr) => {
                            const maxP = Math.max(...arr.map(x => x.totalPermits))
                            const h = maxP > 0 ? Math.max(4, (p.totalPermits / maxP) * 36) : 4
                            return (
                              <div key={p.year} title={`${p.year}: ${p.totalPermits.toLocaleString()}`}
                                style={{ flex: 1, height: h, borderRadius: '2px 2px 0 0',
                                  background: i === arr.length - 1 ? '#E8B84B' : 'rgba(232,184,75,0.3)' }} />
                            )
                          })}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '6px' }}>
                          SF: {leadingIndicators.permits.trend[0]?.sfPermits.toLocaleString() ?? '—'} · MF: {leadingIndicators.permits.trend[0]?.mfPermits.toLocaleString() ?? '—'}
                        </div>
                      </>
                    )}
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '8px' }}>
                      Census BPS · County-level · {leadingIndicators.county} County
                    </div>
                  </div>

                  {/* School Enrollment */}
                  <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                      School Enrollment
                    </div>
                    {!leadingIndicators.enrollment.available ? (
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: '#3d4a5c' }}>
                        Not loaded yet — run<br />
                        <code style={{ color: '#5a6478' }}>scripts/import-tea.ts</code>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '32px', color: '#F0F2F7', lineHeight: 1 }}>
                            {leadingIndicators.enrollment.trend[leadingIndicators.enrollment.trend.length - 1]?.enrollment.toLocaleString() ?? '—'}
                          </span>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#8A98AE' }}>
                            students · {leadingIndicators.enrollment.trend[leadingIndicators.enrollment.trend.length - 1]?.year}
                          </span>
                        </div>
                        {leadingIndicators.enrollment.cagrPct != null && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', marginBottom: '10px' }}>
                            <span style={{ color: leadingIndicators.enrollment.cagrPct >= 0 ? '#4EAEFF' : '#FF6B6B' }}>
                              {leadingIndicators.enrollment.cagrPct >= 0 ? '+' : ''}{leadingIndicators.enrollment.cagrPct.toFixed(1)}%
                            </span>
                            <span style={{ color: '#5a6478' }}> CAGR</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '36px' }}>
                          {leadingIndicators.enrollment.trend.map((e, i, arr) => {
                            const maxE = Math.max(...arr.map(x => x.enrollment))
                            const h = maxE > 0 ? Math.max(4, (e.enrollment / maxE) * 36) : 4
                            return (
                              <div key={e.year} title={`${e.year}: ${e.enrollment.toLocaleString()}`}
                                style={{ flex: 1, height: h, borderRadius: '2px 2px 0 0',
                                  background: i === arr.length - 1 ? '#4EAEFF' : 'rgba(78,174,255,0.3)' }} />
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '6px' }}>
                          <span>{leadingIndicators.enrollment.trend[0]?.year}</span>
                          <span>{leadingIndicators.enrollment.trend[leadingIndicators.enrollment.trend.length - 1]?.year}</span>
                        </div>
                      </>
                    )}
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '8px' }}>
                      TEA PEIMS · County aggregate · {leadingIndicators.county} County ISDs
                    </div>
                  </div>

                  {/* County Projection */}
                  <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                      Population Projection
                    </div>
                    {!leadingIndicators.projection.available ? (
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: '#3d4a5c' }}>
                        Not loaded yet — run<br />
                        <code style={{ color: '#5a6478' }}>scripts/import-tdc.ts</code>
                      </div>
                    ) : (
                      <>
                        {[
                          { label: '2020 Base', value: leadingIndicators.projection.base2020 },
                          { label: '2030 Proj.', value: leadingIndicators.projection.proj2030 },
                          { label: '2040 Proj.', value: leadingIndicators.projection.proj2040 },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1f2e' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#8A98AE' }}>{label}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: '#F0F2F7', fontWeight: 600 }}>
                              {value != null ? fmtK(value) : '—'}
                            </span>
                          </div>
                        ))}
                        {leadingIndicators.projection.base2020 && leadingIndicators.projection.proj2040 && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#A78BFA', marginTop: '10px' }}>
                            +{fmtK(leadingIndicators.projection.proj2040 - leadingIndicators.projection.base2020)} projected 2020→2040
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '8px' }}>
                      Texas Demographic Center Vintage 2024 · Mid scenario · County level
                    </div>
                  </div>

                </div>

                {/* Place-level Permit Breakdown */}
                {leadingIndicators.placesPermits.available && leadingIndicators.placesPermits.top.length > 0 && (
                  <div style={{ marginTop: '16px', border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                      Top Cities by Permits · {leadingIndicators.county} County · {leadingIndicators.placesPermits.year}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {(() => {
                        const maxTotal = Math.max(...leadingIndicators.placesPermits.top.map(p => p.totalPermits))
                        return leadingIndicators.placesPermits.top.map(place => {
                          const pct = maxTotal > 0 ? (place.totalPermits / maxTotal) * 100 : 0
                          return (
                            <div key={place.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '130px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#8A98AE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                {place.name}
                              </div>
                              <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'linear-gradient(90deg,#E8B84B,#E8B84B50)' }} />
                              </div>
                              <div style={{ width: '50px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#E8B84B', fontWeight: 600 }}>
                                {place.totalPermits.toLocaleString()}
                              </div>
                              {place.yoyPct != null && (
                                <div style={{ width: '48px', flexShrink: 0, fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: place.yoyPct >= 0 ? '#2DD4BF' : '#FF6B6B' }}>
                                  {place.yoyPct >= 0 ? '+' : ''}{place.yoyPct.toFixed(0)}%
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '10px' }}>
                      Census BPS · Place-level · SF + MF units authorized
                    </div>
                  </div>
                )}
                {!leadingIndicators.placesPermits.available && (
                  <div style={{ marginTop: '16px', border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '8px' }}>
                      City-level Permits
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: '#3d4a5c' }}>
                      Not loaded yet — run<br />
                      <code style={{ color: '#5a6478' }}>scripts/import-bps-places.ts</code>
                    </div>
                  </div>
                )}
                </>
              )}
            </Surface>
          )}

          {/* Giving Capacity — IRS SOI (Phase 4.4); renders only when the ZIP has SOI data */}
          {giving?.available && (
            <Surface style={{ marginBottom: '16px' }}>
              <SectionHeader
                eyebrow={`Charitable Giving · IRS SOI ${giving.year}`}
                title="Giving Capacity"
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Avg gift per giving return */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#E8B84B', lineHeight: 1 }}>
                    {giving.avgGiftPerGivingReturn != null ? `$${giving.avgGiftPerGivingReturn.toLocaleString()}` : '—'}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Avg gift · giving return
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                    {giving.charitableReturns?.toLocaleString()} returns claimed charity
                  </div>
                </div>

                {/* Charitable share of AGI */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#2DD4BF', lineHeight: 1 }}>
                      {giving.charitablePctAgi != null ? giving.charitablePctAgi.toFixed(2) : '—'}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: '#2DD4BF' }}>%</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Charitable share of AGI
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                    {giving.totalCharitable != null ? `$${(giving.totalCharitable / 1e6).toFixed(1)}M total` : ''}
                  </div>
                </div>

                {/* Itemizer rate (the caveat metric) */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#A78BFA', lineHeight: 1 }}>
                      {giving.itemizerRate != null ? giving.itemizerRate.toFixed(1) : '—'}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: '#A78BFA' }}>%</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Filers who itemize
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                    {giving.avgAgiPerReturn != null ? `$${giving.avgAgiPerReturn.toLocaleString()} avg AGI` : ''}
                  </div>
                </div>
              </div>

              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '12px', lineHeight: 1.6 }}>
                IRS SOI ZIP-code data · {giving.year} · charitable deductions on Schedule A. Post-2017 TCJA only ~{giving.itemizerRate != null ? giving.itemizerRate.toFixed(0) : '10'}% of filers here itemize, so deductions undercount true giving and skew toward higher-income households — read as a <span style={{ color: '#8A98AE' }}>relative</span> generosity signal, not a giving total. Counts rounded to nearest 10; small ZIPs are volatile.
              </div>
            </Surface>
          )}

          {/* Home Value Trend — Zillow ZHVI (Phase 4.7); renders only when the ZIP has ZHVI data */}
          {homeValues?.available && homeValues.zhvi != null && (
            <Surface style={{ marginBottom: '16px' }}>
              <SectionHeader
                eyebrow={`Current Home Values · Zillow ZHVI ${homeValues.latestMonth ?? ''}`}
                title="Home Value Trend"
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Typical home value */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#E8B84B', lineHeight: 1 }}>
                    ${homeValues.zhvi.toLocaleString()}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Typical home value
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                    Smoothed · seasonally adjusted
                  </div>
                </div>

                {/* Year-over-year change */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  {(() => {
                    const v = homeValues.zhviYoy
                    const color = v == null ? '#5a6478' : v >= 0 ? '#2DD4BF' : '#FF6B6B'
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color, lineHeight: 1 }}>
                            {v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
                          </span>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color }}>%</span>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                          Year-over-year change
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                          vs. same month last year
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Sparkline */}
                {homeValues.series && homeValues.series.length > 1 && (
                  <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                      Trailing-year trend
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '40px' }}>
                      {homeValues.series.map((s, i, arr) => {
                        const max = Math.max(...arr.map(x => x.value))
                        const min = Math.min(...arr.map(x => x.value))
                        const range = max - min || 1
                        const h = 8 + ((s.value - min) / range) * 32
                        return (
                          <div key={s.month} title={`${s.month}: $${s.value.toLocaleString()}`}
                            style={{ flex: 1, height: h, borderRadius: '2px 2px 0 0',
                              background: i === arr.length - 1 ? '#E8B84B' : 'rgba(232,184,75,0.3)' }} />
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '6px' }}>
                      <span>{homeValues.series[0]?.month}</span>
                      <span>{homeValues.series[homeValues.series.length - 1]?.month}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '12px', lineHeight: 1.6 }}>
                Zillow Home Value Index (ZHVI) · all-homes, 35th–65th-percentile tier (SFR + condo) · ZIP level · updated monthly. A smoothed, seasonally adjusted measure of typical value — fresher than the ACS self-reported median, which lags ~2 years. Context signal, not scored.
              </div>
            </Surface>
          )}

          {/* Address Momentum — HUD USPS (Phase 4.1); renders only when data is loaded */}
          {addressMomentum?.available && addressMomentum.series && addressMomentum.series.length > 0 && (
            <Surface style={{ marginBottom: '16px' }}>
              <SectionHeader
                eyebrow="Freshest Growth Signal · USPS Residential Addresses"
                title="Address Momentum"
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Active residential addresses */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#F0F2F7', lineHeight: 1 }}>
                    {addressMomentum.resActive?.toLocaleString() ?? '—'}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Active residential addresses
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                    {addressMomentum.latestQuarter}
                  </div>
                </div>

                {/* Trailing 4-quarter momentum */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  {(() => {
                    const m = addressMomentum.momentumPct
                    const fallback = addressMomentum.qoqPct
                    const val = m ?? fallback
                    const label = m != null ? 'Trailing 4-quarter' : 'Quarter-over-quarter'
                    const color = val == null ? '#5a6478' : val >= 0 ? '#2DD4BF' : '#FF6B6B'
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color, lineHeight: 1 }}>
                            {val == null ? '—' : `${val >= 0 ? '+' : ''}${val.toFixed(1)}`}
                          </span>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color }}>%</span>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                          {label} change
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                          {m != null ? 'vs. same quarter last year' : 'vs. prior quarter'}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Sparkline */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                    Quarterly trend
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '40px' }}>
                    {addressMomentum.series.map((s, i, arr) => {
                      const max = Math.max(...arr.map(x => x.resActive))
                      const min = Math.min(...arr.map(x => x.resActive))
                      const range = max - min || 1
                      // scale to emphasize change while keeping bars visible
                      const h = 8 + ((s.resActive - min) / range) * 32
                      return (
                        <div key={s.quarter} title={`${s.quarter}: ${s.resActive.toLocaleString()}`}
                          style={{ flex: 1, height: h, borderRadius: '2px 2px 0 0',
                            background: i === arr.length - 1 ? '#E8B84B' : 'rgba(232,184,75,0.3)' }} />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '6px' }}>
                    <span>{addressMomentum.series[0]?.quarter}</span>
                    <span>{addressMomentum.series[addressMomentum.series.length - 1]?.quarter}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '12px' }}>
                HUD Aggregated USPS Administrative Data · ZIP level · active residential = addresses with mail collected in the prior 90 days · updated quarterly
              </div>
            </Surface>
          )}

          {/* Commute Corridors — LODES (Phase 4.5) */}
          {commute?.available && commute.corridors && commute.corridors.length > 0 && (
            <Surface style={{ marginBottom: '16px' }}>
              <SectionHeader
                eyebrow={`${commute.county ?? ''} ${commute.county ? '· ' : ''}Where Residents Work · Daily Drive`}
                title="Commute Corridors"
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                {/* Net commute direction */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ flexShrink: 0, width: '52px', height: '52px', borderRadius: '50%', border: '1px solid #232940', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {commute.direction?.bearingDeg != null ? (
                      <svg width="26" height="26" viewBox="0 0 24 24" style={{ transform: `rotate(${commute.direction.bearingDeg}deg)` }}>
                        <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="#4EAEFF" />
                      </svg>
                    ) : <span style={{ color: '#3d4a5c' }}>—</span>}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#F0F2F7', lineHeight: 1 }}>
                      {commute.direction?.label ?? '—'}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '4px' }}>
                      Net direction
                    </div>
                    {commute.direction?.concentration != null && (
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '2px' }}>
                        {Math.round(commute.direction.concentration * 100)}% aligned
                      </div>
                    )}
                  </div>
                </div>

                {/* Resident workers */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#F0F2F7', lineHeight: 1 }}>
                    {commute.totalWorkers?.toLocaleString() ?? '—'}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Resident workers
                  </div>
                  {commute.topDestLabel && (
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      Top: {commute.topDestLabel}
                    </div>
                  )}
                </div>

                {/* Self-containment */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#2DD4BF', lineHeight: 1 }}>
                      {commute.selfContainmentPct?.toFixed(0) ?? '—'}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', color: '#2DD4BF' }}>%</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Live &amp; work in-ZIP
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                    {commute.workInZip?.toLocaleString()} of {commute.totalWorkers?.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Top destination corridors */}
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                Top Work Destinations · jobs (▸ = % earning &gt; $40k)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(() => {
                  const maxJobs = Math.max(...commute.corridors.map(c => c.jobs))
                  return commute.corridors.map(c => {
                    const pct = maxJobs > 0 ? (c.jobs / maxJobs) * 100 : 0
                    return (
                      <div key={c.zip} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '150px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#8A98AE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {c.label} <span style={{ color: '#3d4a5c' }}>{c.zip}</span>
                        </div>
                        <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'linear-gradient(90deg,#4EAEFF,#4EAEFF50)' }} />
                        </div>
                        <div style={{ width: '52px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#4EAEFF', fontWeight: 600 }}>
                          {c.jobs.toLocaleString()}
                        </div>
                        <div style={{ width: '40px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#2DD4BF' }}>
                          ▸{c.highPct}%
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '12px' }}>
                LEHD LODES8 · {commute.year} · intra-DFW resident worker flows · block→ZCTA · &quot;Net direction&quot; is the job-weighted bearing toward work
              </div>
            </Surface>
          )}

          {/* Migration Flows — IRS SOI county-to-county (Phase 4.6) */}
          {migration?.available && migration.topOrigins && migration.topOrigins.length > 0 && (
            <Surface style={{ marginBottom: '16px' }}>
              <SectionHeader
                eyebrow={`${migration.county ?? ''} County · Who's Moving In · IRS SOI TY2022→2023`}
                title="Migration Flows"
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                {/* Net household migration */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  {(() => {
                    const net = migration.netHouseholds ?? 0
                    const color = net > 0 ? '#2DD4BF' : net < 0 ? '#FF6B6B' : '#8A98AE'
                    return (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '16px', color, lineHeight: 1 }}>{net > 0 ? '+' : net < 0 ? '−' : ''}</span>
                        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color, lineHeight: 1 }}>
                          {Math.abs(net).toLocaleString()}
                        </span>
                      </div>
                    )
                  })()}
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Net households / yr
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                    inbound − outbound returns
                  </div>
                </div>

                {/* Households in */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#2DD4BF', lineHeight: 1 }}>
                    {migration.inboundHouseholds?.toLocaleString() ?? '—'}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Households in
                  </div>
                  {migration.inboundAvgAgi != null && (
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                      avg AGI ${Math.round(migration.inboundAvgAgi / 1000)}k
                    </div>
                  )}
                </div>

                {/* Households out */}
                <div style={{ border: '1px solid #1e2b3c', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: '#FF6B6B', lineHeight: 1 }}>
                    {migration.outboundHouseholds?.toLocaleString() ?? '—'}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A98AE', marginTop: '6px' }}>
                    Households out
                  </div>
                  {migration.outboundAvgAgi != null && (
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#5a6478', marginTop: '4px' }}>
                      avg AGI ${Math.round(migration.outboundAvgAgi / 1000)}k
                    </div>
                  )}
                </div>
              </div>

              {/* Top origin counties */}
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A98AE', marginBottom: '12px' }}>
                Top Origin Counties · households (▸ = avg AGI of movers)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(() => {
                  const top = migration.topOrigins!.slice(0, 10)
                  const maxRet = Math.max(...top.map(o => o.returns))
                  return top.map(o => {
                    const pct = maxRet > 0 ? (o.returns / maxRet) * 100 : 0
                    return (
                      <div key={o.fips} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '170px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#8A98AE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {o.name} <span style={{ color: '#3d4a5c' }}>{o.state}</span>
                        </div>
                        <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'linear-gradient(90deg,#2DD4BF,#2DD4BF50)' }} />
                        </div>
                        <div style={{ width: '52px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#2DD4BF', fontWeight: 600 }}>
                          {o.returns.toLocaleString()}
                        </div>
                        <div style={{ width: '52px', flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#E8B84B' }}>
                          {o.avgAgi != null ? `▸$${Math.round(o.avgAgi / 1000)}k` : '—'}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#3d4a5c', marginTop: '12px' }}>
                IRS SOI county-to-county migration · TY{migration.year != null ? `${migration.year - 1}→${migration.year}` : '2022→2023'} · county level (ZIP&apos;s county) · 1 return ≈ 1 household · AGI = adjusted gross income · context only, not scored
              </div>
            </Surface>
          )}

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
