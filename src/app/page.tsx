'use client'

import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { downloadCsv } from '@/lib/csv'
import { CAMPUSES } from '@/lib/campuses'
import { BOUNDARY_CHANGED } from '@/lib/zips'
import type { AttendeeZip } from '@/components/MapboxChoropleth'

const MapboxChoropleth = lazy(() => import('@/components/MapboxChoropleth'))

const DRIVE_MINUTES_OPTIONS = [15, 20, 30]

const CAMPUS_PALETTE = ['#4EAEFF','#2DD4BF','#A78BFA','#FF6B6B','#86EFAC','#FB923C','#F472B6','#FACC15']

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
  mapZips: ZipRow[]
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
  const [data, setData]           = useState<OverviewData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [coverage, setCoverage]   = useState<'core' | 'all'>('core')
  const [refreshKey, setRefreshKey] = useState(0)

  // Phase 4.1 — attendee overlay
  const [attendeeData, setAttendeeData]     = useState<AttendeeZip[]>([])
  const [showAttendees, setShowAttendees]   = useState(false)
  const [attendeeLoaded, setAttendeeLoaded] = useState(false)
  const [attendeeUploadDate, setAttendeeUploadDate] = useState<string | null>(null)

  // Assign a stable color to each campus name (sorted for consistency across re-renders)
  const campusColorMap = useMemo<Record<string, string>>(() => {
    const names = new Set<string>()
    for (const a of attendeeData) {
      if (a.campusBreakdown) Object.keys(a.campusBreakdown).forEach(n => names.add(n))
    }
    const sorted = [...names].sort()
    const map: Record<string, string> = {}
    sorted.forEach((name, i) => { map[name] = CAMPUS_PALETTE[i % CAMPUS_PALETTE.length] })
    return map
  }, [attendeeData])

  // Phase 4.2 — isochrones + candidate pin
  const [selectedCampusZip, setSelectedCampusZip] = useState<string>('')
  const [driveMinutes, setDriveMinutes]           = useState<number>(20)
  const [isochroneGeoJson, setIsochroneGeoJson]   = useState<GeoJSON.FeatureCollection | null>(null)
  const [isochroneLoading, setIsochroneLoading]   = useState(false)
  const [pinMode, setPinMode]                     = useState(false)
  const [candidatePin, setCandidatePin]           = useState<{ lng: number; lat: number } | null>(null)
  const [candidateIsochrone, setCandidateIsochrone] = useState<GeoJSON.FeatureCollection | null>(null)
  const [candidateIsoLoading, setCandidateIsoLoading] = useState(false)

  // Read initial coverage from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('coverage') === 'all') setCoverage('all')
  }, [])

  // Fetch overview data whenever coverage or refresh changes
  useEffect(() => {
    setLoading(true)
    fetch(`/api/overview?coverage=${coverage}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [coverage, refreshKey])

  // Fetch attendee density once (data changes rarely)
  useEffect(() => {
    if (attendeeLoaded) return
    fetch('/api/attendee-density')
      .then(r => r.json())
      .then(d => {
        setAttendeeData(d.data ?? [])
        if (d.lastUpload?.uploadedAt) {
          const dt = new Date(d.lastUpload.uploadedAt)
          setAttendeeUploadDate(dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
        }
        setAttendeeLoaded(true)
      })
      .catch(() => setAttendeeLoaded(true))
  }, [attendeeLoaded])

  // Fetch isochrone when campus selection or drive time changes
  useEffect(() => {
    if (!selectedCampusZip) {
      setIsochroneGeoJson(null)
      return
    }
    const campus = CAMPUSES.find(c => c.zip === selectedCampusZip)
    if (!campus) return

    setIsochroneLoading(true)
    fetch(`/api/isochrone?lng=${campus.lng}&lat=${campus.lat}&minutes=${driveMinutes}`)
      .then(r => r.json())
      .then(d => { setIsochroneGeoJson(d); setIsochroneLoading(false) })
      .catch(() => setIsochroneLoading(false))
  }, [selectedCampusZip, driveMinutes])

  // Fetch isochrone for candidate pin when dropped
  useEffect(() => {
    if (!candidatePin || !pinMode) {
      setCandidateIsochrone(null)
      return
    }
    setCandidateIsoLoading(true)
    fetch(`/api/isochrone?lng=${candidatePin.lng}&lat=${candidatePin.lat}&minutes=${driveMinutes}`)
      .then(r => r.json())
      .then(d => { setCandidateIsochrone(d); setCandidateIsoLoading(false) })
      .catch(() => setCandidateIsoLoading(false))
  }, [candidatePin, driveMinutes, pinMode])

  function handleCoverageChange(val: 'core' | 'all') {
    setCoverage(val)
    const url = new URL(window.location.href)
    val === 'all' ? url.searchParams.set('coverage', 'all') : url.searchParams.delete('coverage')
    window.history.replaceState(null, '', url.toString())
  }

  function handleMapClick(coords: { lng: number; lat: number }) {
    if (!pinMode) return
    setCandidatePin(coords)
  }

  // Merge campus + candidate isochrones for map display
  const activeIsochrone: GeoJSON.FeatureCollection | null =
    candidateIsochrone ?? isochroneGeoJson ?? null

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

        {/* Mapbox Choropleth Map — Phase 4 */}
        <div className="fade-up-3" style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px', marginBottom: '20px' }}>
          <SectionHeader eyebrow="Population Growth · 2020 to 2023 · Hover for Details" title="ZIP Code Growth Map" />

          {/* Phase 4 map controls */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
            marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #1e2b3c',
          }}>
            {/* Campus isochrone selector */}
            <select
              value={selectedCampusZip}
              onChange={e => { setSelectedCampusZip(e.target.value); setCandidatePin(null); setCandidateIsochrone(null) }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.06em',
                background: '#0d0f14', color: '#C8D4E4', border: '1px solid #232940',
                borderRadius: '3px', padding: '5px 8px', cursor: 'pointer', outline: 'none',
                appearance: 'none' as const,
              }}
            >
              <option value="">Drive-time: select campus…</option>
              {CAMPUSES.map(c => (
                <option key={c.zip} value={c.zip}>
                  {c.status === 'existing' ? '● ' : '◌ '}{c.label}
                </option>
              ))}
            </select>

            {/* Drive time minutes */}
            <select
              value={driveMinutes}
              onChange={e => setDriveMinutes(Number(e.target.value))}
              disabled={!selectedCampusZip && !candidatePin}
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                background: '#0d0f14', color: !selectedCampusZip && !candidatePin ? '#3a4154' : '#C8D4E4',
                border: '1px solid #232940', borderRadius: '3px',
                padding: '5px 8px', cursor: 'pointer', outline: 'none',
                appearance: 'none' as const,
              }}
            >
              {DRIVE_MINUTES_OPTIONS.map(m => (
                <option key={m} value={m}>{m}-min drive</option>
              ))}
            </select>

            {/* Isochrone status */}
            {isochroneLoading || candidateIsoLoading ? (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4EAEFF', letterSpacing: '0.1em' }}>
                FETCHING ISOCHRONE…
              </span>
            ) : (isochroneGeoJson || candidateIsochrone) ? (
              <button
                onClick={() => { setSelectedCampusZip(''); setIsochroneGeoJson(null); setCandidatePin(null); setCandidateIsochrone(null) }}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.1em',
                  background: 'rgba(78,174,255,0.1)', color: '#4EAEFF',
                  border: '1px solid rgba(78,174,255,0.3)', borderRadius: '3px',
                  padding: '4px 10px', cursor: 'pointer',
                }}
              >
                ✕ Clear Isochrone
              </button>
            ) : null}

            {/* Attendee overlay toggle */}
            <button
              onClick={() => setShowAttendees(v => !v)}
              title={
                !attendeeLoaded || !attendeeData.length
                  ? 'No attendee data — upload via /admin/attendee-upload'
                  : attendeeUploadDate
                    ? `Last upload: ${attendeeUploadDate}`
                    : undefined
              }
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.1em',
                background: showAttendees ? 'rgba(232,184,75,0.12)' : 'transparent',
                color: showAttendees ? '#E8B84B' : (!attendeeData.length ? '#3a4154' : '#8A98AE'),
                border: `1px solid ${showAttendees ? 'rgba(232,184,75,0.4)' : '#232940'}`,
                borderRadius: '3px', padding: '4px 10px', cursor: 'pointer',
              }}
            >
              {showAttendees ? '● ' : '○ '}Attendees
              {!attendeeData.length
                ? <span style={{ color: '#5a6478' }}> (no data)</span>
                : attendeeUploadDate && <span style={{ color: '#5a6478' }}> · {attendeeUploadDate}</span>
              }
            </button>

            {/* Candidate pin mode toggle */}
            <button
              onClick={() => {
                setPinMode(v => {
                  if (v) { setCandidatePin(null); setCandidateIsochrone(null) }
                  return !v
                })
                setSelectedCampusZip('')
                setIsochroneGeoJson(null)
              }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.1em',
                background: pinMode ? 'rgba(167,139,250,0.12)' : 'transparent',
                color: pinMode ? '#A78BFA' : '#8A98AE',
                border: `1px solid ${pinMode ? 'rgba(167,139,250,0.4)' : '#232940'}`,
                borderRadius: '3px', padding: '4px 10px', cursor: 'pointer',
              }}
            >
              {pinMode ? '◎ ' : '◌ '}Drop Candidate Pin
            </button>
          </div>

          {/* Isochrone stats bar */}
          {(isochroneGeoJson || candidateIsochrone) && (() => {
            const activeCampus = CAMPUSES.find(c => c.zip === selectedCampusZip)
            const label = candidatePin ? 'Candidate Site' : (activeCampus?.label ?? '')
            const geoProps = (activeIsochrone?.features?.[0]?.properties ?? {}) as Record<string, unknown>
            const contourMins = geoProps['contour'] as number | undefined
            const minutes = contourMins ?? driveMinutes
            return (
              <div style={{
                display: 'flex', gap: '24px', alignItems: 'center',
                marginBottom: '12px', padding: '10px 14px',
                background: 'rgba(78,174,255,0.06)', border: '1px solid rgba(78,174,255,0.15)',
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#4EAEFF', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '2px' }}>
                    Drive-time Isochrone
                  </div>
                  <div style={{ fontSize: '12px', color: '#F0F2F7' }}>
                    {label} · {minutes}-min
                  </div>
                </div>
                <div style={{ fontSize: '9px', color: '#8A98AE', lineHeight: 1.6 }}>
                  Polygon shows approximate drive-time coverage area.{' '}
                  Population & ZIP stats within the isochrone coming in a future update.
                </div>
              </div>
            )
          })()}

          <Suspense fallback={
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A98AE', letterSpacing: '0.12em' }}>LOADING MAP...</span>
            </div>
          }>
            <MapboxChoropleth
              zipData={data?.mapZips ?? data?.zips ?? []}
              loading={loading}
              campuses={CAMPUSES}
              attendeeData={attendeeData}
              showAttendees={showAttendees}
              campusColorMap={campusColorMap}
              isochroneGeoJson={activeIsochrone}
              isochroneMinutes={driveMinutes}
              candidatePin={candidatePin}
              onMapClick={pinMode ? handleMapClick : undefined}
            />
          </Suspense>
        </div>

        {/* Attendee Analysis Panel — visible when overlay is toggled on */}
        {showAttendees && (() => {
          const valid = attendeeData.filter(a => a.households !== -1)
          if (!valid.length) return null

          const labelMap = new Map((data?.zips ?? []).map(z => [z.zip, z.label]))
          const totalHH  = valid.reduce((s, a) => s + a.households, 0)

          // Campus totals — sorted by household count descending
          const byCampus = new Map<string, { total: number; zips: { zip: string; hh: number }[] }>()
          for (const a of valid) {
            const bd = a.campusBreakdown ?? {}
            for (const [campus, hh] of Object.entries(bd)) {
              if (!byCampus.has(campus)) byCampus.set(campus, { total: 0, zips: [] })
              const entry = byCampus.get(campus)!
              entry.total += hh
              entry.zips.push({ zip: a.zip, hh })
            }
          }
          const campusList = [...byCampus.entries()]
            .map(([name, { total, zips }]) => ({
              name,
              total,
              color: campusColorMap[name] ?? '#E8B84B',
              topZips: zips.sort((a, b) => b.hh - a.hh).slice(0, 5),
            }))
            .sort((a, b) => b.total - a.total)

          const maxCampusHH = campusList[0]?.total ?? 1
          const MONO = { fontFamily: "'IBM Plex Mono', monospace" }

          return (
            <div style={{ background: CARD_SURFACE, border: '1px solid #232940', padding: '24px', marginBottom: '20px' }}>

              {/* Header + summary stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ ...MONO, fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Attendee Analysis
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '0.05em', color: '#F0F2F7' }}>
                    Campus Draw Areas
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                  <div>
                    <div style={{ ...MONO, fontSize: '9px', color: '#5a6478', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total HH</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '26px', color: '#E8B84B' }}>{totalHH.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ ...MONO, fontSize: '9px', color: '#5a6478', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ZIPs</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '26px', color: '#4EAEFF' }}>{valid.length}</div>
                  </div>
                  <div>
                    <div style={{ ...MONO, fontSize: '9px', color: '#5a6478', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Campuses</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '26px', color: '#2DD4BF' }}>{campusList.length}</div>
                  </div>
                </div>
              </div>

              {/* Campus bars + top ZIPs side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

                {/* Left: campus bar list */}
                <div>
                  <div style={{ ...MONO, fontSize: '10px', letterSpacing: '0.12em', color: '#A8B4C5', textTransform: 'uppercase', marginBottom: '14px' }}>
                    Households by Campus
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {campusList.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                        <div style={{ width: '120px', flexShrink: 0, ...MONO, fontSize: '11px', color: '#C8D4E4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(c.total / maxCampusHH) * 100}%`, background: `linear-gradient(90deg,${c.color},${c.color}50)` }} />
                        </div>
                        <div style={{ width: '60px', flexShrink: 0, textAlign: 'right', ...MONO, fontSize: '11px', color: c.color, fontWeight: 600 }}>
                          {c.total.toLocaleString()}
                        </div>
                        <div style={{ width: '36px', flexShrink: 0, textAlign: 'right', ...MONO, fontSize: '10px', color: '#5a6478' }}>
                          {Math.round((c.total / totalHH) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: top ZIPs per campus */}
                <div>
                  <div style={{ ...MONO, fontSize: '10px', letterSpacing: '0.12em', color: '#A8B4C5', textTransform: 'uppercase', marginBottom: '14px' }}>
                    Top ZIP Codes per Campus
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {campusList.slice(0, 4).map(c => (
                      <div key={c.name}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                          <span style={{ ...MONO, fontSize: '10px', color: c.color, letterSpacing: '0.06em' }}>{c.name}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '14px' }}>
                          {c.topZips.map(z => (
                            <div key={z.zip} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ ...MONO, fontSize: '10px', color: '#8A98AE' }}>
                                {z.zip}{labelMap.get(z.zip) ? ` · ${labelMap.get(z.zip)}` : ''}
                              </span>
                              <span style={{ ...MONO, fontSize: '10px', color: '#C8D4E4', fontWeight: 600 }}>{z.hh.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <SectionHeader eyebrow="Sorted by Population Growth" title="Top Growth ZIP Codes" />
            <button
              disabled={!data?.zips?.length}
              onClick={() => downloadCsv('lakepointe-growth-zips.csv',
                ['ZIP', 'Area', 'Population', 'Growth %', 'Median HHI', '% HH w/ Children', 'Avg HH Size', 'SES Class'],
                (data?.zips ?? []).map(z => [z.zip, z.label, z.population, z.populationGrowth, z.medianHouseholdIncome, z.hhWithChildrenPct, z.avgHouseholdSize, z.sesLabel])
              )}
              style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', padding:'5px 12px', borderRadius:'3px', cursor:'pointer', border:'1px solid #232940', background:'transparent', color:'#8A98AE', flexShrink:0, marginTop:'4px' }}
            >↓ CSV</button>
          </div>
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
                    <td
                      style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid #1e2b3c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: growthColor(z.populationGrowth), fontWeight: 600 }}
                      title={z.populationGrowth == null && BOUNDARY_CHANGED.has(z.zip) ? 'ZCTA boundary changed 2020→2023 — growth comparison invalid' : undefined}
                    >
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
