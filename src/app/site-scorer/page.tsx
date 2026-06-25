'use client'

import { useEffect, useState, useRef } from 'react'
import { downloadCsv } from '@/lib/csv'
import { BOUNDARY_CHANGED } from '@/lib/zips'
import { CAMPUSES } from '@/lib/campuses'
import {
  growthScore, satOpportunityScore, distanceScore,
  effectivePct, computeFitScore, type Weights,
} from '@/lib/scoring'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZipScore {
  zip: string
  label: string
  population: number
  populationGrowth: number | null
  sesScore: number
  sesLabel: string
  yfi: number
  wfi: number
  totalChurches: number
  churchesPer10k: number
  enrollmentGrowthScore: number
  distanceToCampusMi: number | null
  county: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: Weights = {
  yfi: 23, wfi: 23, ses: 18, growth: 14, saturation: 12, enrollment: 10, distance: 0,
}

const WEIGHT_KEYS = ['yfi', 'wfi', 'ses', 'growth', 'saturation', 'enrollment', 'distance'] as const

// Signals leadership can toggle in/out of the score. Distance is included but
// defaults OFF (straight-line to nearest existing campus; penalises nearness).
const SIGNALS = [
  { key: 'yfi',        label: 'YFI',        full: 'Young Family Index (YFI)',   color: '#7AA3AA' },
  { key: 'wfi',        label: 'WFI',        full: 'Working Family Index (WFI)', color: '#D4883A' },
  { key: 'ses',        label: 'SES',        full: 'SES Score',                  color: '#7A9E8A' },
  { key: 'growth',     label: 'Growth',     full: 'Population Growth',          color: '#C45A46' },
  { key: 'saturation', label: 'Saturation', full: 'Church Saturation Opp.',     color: '#F04B28' },
  { key: 'enrollment', label: 'Enrollment', full: 'School Enrollment Growth',   color: '#D4883A' },
  { key: 'distance',   label: 'Distance',   full: 'Distance from Campus',       color: '#FB923C' },
] as const

type ToggleKey = typeof SIGNALS[number]['key']
const TOGGLE_KEYS = SIGNALS.map(s => s.key) as ToggleKey[]
// Default selection: the six demand/supply signals on, distance off (reserved opt-in).
const DEFAULT_ENABLED: Record<ToggleKey, boolean> = {
  yfi: true, wfi: true, ses: true, growth: true, saturation: true, enrollment: true, distance: false,
}
const DISTANCE_DEFAULT_WEIGHT = 10 // applied when distance is first toggled on (if still 0)

const PRESETS: Record<string, Weights> = {
  'Balanced':       { yfi: 23, wfi: 23, ses: 18, growth: 14, saturation: 12, enrollment: 10, distance: 0 },
  'Young Families': { yfi: 40, wfi: 30, ses: 10, growth: 10, saturation:  5, enrollment:  5, distance: 0 },
  'Underserved':    { yfi: 15, wfi: 10, ses:  5, growth: 25, saturation: 40, enrollment:  5, distance: 0 },
}

const EXISTING_CAMPUS_ZIPS = new Set(CAMPUSES.filter(c => c.status === 'existing').map(c => c.zip))
const CAMPUS_LABEL = Object.fromEntries(CAMPUSES.map(c => [c.zip, c.label]))

// Scoring helpers (growthScore / satOpportunityScore / distanceScore /
// effectivePct / computeFitScore) live in @/lib/scoring — imported above, unit-tested.

const DRIVER_LABELS: Record<string, string> = {
  yfi:        'young family concentration',
  wfi:        'working family rate',
  ses:        'SES score',
  growth:     'population growth',
  saturation: 'low saturation',
  enrollment: 'enrollment growth',
  distance:   'distance from campus',
}

function topDrivers(z: ZipScore, eff: Weights): [string, string] {
  const growthW = z.populationGrowth != null ? eff.growth : 0
  const distW = z.distanceToCampusMi != null ? eff.distance : 0
  const scores: Record<string, number> = {
    yfi:        z.yfi * eff.yfi,
    wfi:        z.wfi * eff.wfi,
    ses:        z.sesScore * eff.ses,
    growth:     z.populationGrowth != null ? growthScore(z.populationGrowth) * growthW : 0,
    saturation: satOpportunityScore(z.churchesPer10k) * eff.saturation,
    enrollment: z.enrollmentGrowthScore * eff.enrollment,
    distance:   z.distanceToCampusMi != null ? distanceScore(z.distanceToCampusMi) * distW : 0,
  }
  const keys = Object.keys(scores).sort((a, b) => scores[b] - scores[a])
  return [DRIVER_LABELS[keys[0]], DRIVER_LABELS[keys[1]]]
}

function scoreColor(score: number): string {
  if (score >= 75) return '#F04B28'
  if (score >= 60) return '#7AA3AA'
  if (score >= 45) return '#D4883A'
  return '#A89A88'
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function weightsFromSearch(search: string): Weights | null {
  const p = new URLSearchParams(search)
  if (!WEIGHT_KEYS.some(k => p.has(k))) return null
  const w: Record<string, number> = {}
  for (const k of WEIGHT_KEYS) {
    const v = parseInt(p.get(k) ?? '')
    w[k] = Number.isFinite(v) && v >= 0 && v <= 100 ? v : DEFAULT_WEIGHTS[k]
  }
  return w as unknown as Weights
}

// ── Scatter chart ─────────────────────────────────────────────────────────────

interface ScatterProps {
  data: ZipScore[]
  eff: Weights
  onHover: (z: ZipScore | null) => void
  hovered: ZipScore | null
}

function ScatterChart({ data, eff, onHover, hovered }: ScatterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })

  const ML = 58, MR = 16, MT = 28, MB = 50
  const VW = 620, VH = 400
  const CW = VW - ML - MR
  const CH = VH - MT - MB

  const plotData = data.filter(d => d.populationGrowth != null)

  const growths = plotData.map(d => d.populationGrowth!)
  const rawMin = Math.min(...growths)
  const rawMax = Math.max(...growths)
  const xMin = Math.floor(rawMin / 5) * 5 - 2
  const xMax = Math.ceil(rawMax / 5) * 5 + 2
  const Y_MAX = 35

  const sortedG = [...growths].sort((a, b) => a - b)
  const medianGrowth = sortedG[Math.floor(sortedG.length / 2)]

  const sortedS = [...plotData.map(d => d.churchesPer10k)].sort((a, b) => a - b)
  const medianSat = sortedS[Math.floor(sortedS.length / 2)]

  const toX = (g: number) => ML + ((g - xMin) / (xMax - xMin)) * CW
  const toY = (s: number) => MT + (Math.min(s, Y_MAX) / Y_MAX) * CH

  const xDiv = toX(medianGrowth)
  const yDiv = toY(medianSat)

  const xTicks = Array.from({ length: Math.ceil((xMax - xMin) / 10) + 1 }, (_, i) => {
    const v = Math.ceil(xMin / 10) * 10 + i * 10
    return v <= xMax ? v : null
  }).filter(v => v != null) as number[]

  const yTicks = [0, 5, 10, 15, 20, 25, 30, 35].filter(t => t <= Y_MAX)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    setTipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHover(null)}
        style={{ overflow: 'visible', display: 'block' }}
      >
        {/* Target quadrant highlight */}
        <rect
          x={xDiv} y={MT}
          width={ML + CW - xDiv} height={yDiv - MT}
          fill="rgba(240,75,40,0.06)"
        />

        {/* Quadrant dividers */}
        <line x1={xDiv} y1={MT - 4} x2={xDiv} y2={MT + CH} stroke="#4A4A4A" strokeWidth={1} strokeDasharray="4,3" />
        <line x1={ML} y1={yDiv} x2={ML + CW} y2={yDiv} stroke="#4A4A4A" strokeWidth={1} strokeDasharray="4,3" />

        {/* Quadrant labels */}
        <text x={xDiv + 6} y={MT + 12} fontSize={8} fontFamily="'Gotham'" fill="rgba(240,75,40,0.7)">
          HIGH GROWTH · LOW SATURATION ▲
        </text>
        <text x={ML + 6} y={MT + 12} fontSize={8} fontFamily="'Gotham'" fill="#A08E7A">
          LOW GROWTH · LOW SAT.
        </text>
        <text x={xDiv + 6} y={MT + CH - 4} fontSize={8} fontFamily="'Gotham'" fill="#A08E7A">
          HIGH GROWTH · HIGH SAT.
        </text>
        <text x={ML + 6} y={MT + CH - 4} fontSize={8} fontFamily="'Gotham'" fill="#A08E7A">
          LOW GROWTH · HIGH SAT.
        </text>

        {/* Y axis */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#424242" strokeWidth={1} />
        {yTicks.map(t => {
          const y = toY(t)
          return (
            <g key={t}>
              <line x1={ML - 4} y1={y} x2={ML} y2={y} stroke="#4A4A4A" strokeWidth={1} />
              <text x={ML - 7} y={y + 3} fontSize={9} fontFamily="'Gotham'" fill="#B4A490" textAnchor="end">{t}</text>
            </g>
          )
        })}
        <text
          transform={`translate(11,${MT + CH / 2}) rotate(-90)`}
          fontSize={9} fontFamily="'Gotham'" fill="#A89A88" textAnchor="middle"
        >Churches / 10K</text>
        <text
          transform={`translate(11,${MT + 10})`}
          fontSize={8} fontFamily="'Gotham'" fill="#B4A490" textAnchor="middle"
        >← opportunity</text>

        {/* X axis */}
        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#424242" strokeWidth={1} />
        {xTicks.map(t => {
          const x = toX(t)
          return (
            <g key={t}>
              <line x1={x} y1={MT + CH} x2={x} y2={MT + CH + 4} stroke="#4A4A4A" strokeWidth={1} />
              <text x={x} y={MT + CH + 14} fontSize={9} fontFamily="'Gotham'" fill="#B4A490" textAnchor="middle">{t}%</text>
            </g>
          )
        })}
        <text x={ML + CW / 2} y={VH - 4} fontSize={9} fontFamily="'Gotham'" fill="#A89A88" textAnchor="middle">
          Population Growth (%)
        </text>

        {/* Dots */}
        {plotData.map(d => {
          const x = toX(d.populationGrowth!)
          const y = toY(d.churchesPer10k)
          const score = computeFitScore(d, eff)
          const color = scoreColor(score)
          const isH = hovered?.zip === d.zip
          const isCampus = EXISTING_CAMPUS_ZIPS.has(d.zip)
          return (
            <circle
              key={d.zip}
              cx={x} cy={y}
              r={isH ? 5.5 : isCampus ? 4.5 : 3.5}
              fill={color}
              fillOpacity={isH ? 1 : 0.65}
              stroke={isCampus ? '#F04B28' : isH ? color : 'none'}
              strokeWidth={isCampus ? 1.5 : isH ? 1.5 : 0}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => onHover(d)}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: Math.min(tipPos.x + 14, 480),
          top: Math.max(tipPos.y - 80, 0),
          pointerEvents: 'none',
          background: '#3C3C3C',
          border: `1px solid ${scoreColor(computeFitScore(hovered, eff))}40`,
          borderRadius: 6,
          padding: '10px 14px',
          fontFamily: "'Gotham'",
          fontSize: 11,
          minWidth: 180,
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ color: '#F04B28', fontWeight: 600, marginBottom: 6 }}>
            {hovered.zip} · {hovered.label}
            {EXISTING_CAMPUS_ZIPS.has(hovered.zip) && (
              <span style={{ marginLeft: 6, fontSize: 9, color: '#F04B28', opacity: 0.7, border: '1px solid rgba(240,75,40,0.4)', borderRadius: 3, padding: '1px 4px' }}>
                {CAMPUS_LABEL[hovered.zip]}
              </span>
            )}
          </div>
          <div style={{ color: '#E8DDD0', marginBottom: 3 }}>
            Fit Score: <span style={{ color: scoreColor(computeFitScore(hovered, eff)) }}>{computeFitScore(hovered, eff)}</span>
          </div>
          <div style={{ color: '#A89A88' }}>Growth: {hovered.populationGrowth != null ? `${hovered.populationGrowth.toFixed(1)}%` : '—'}</div>
          <div style={{ color: '#A89A88' }}>Churches/10K: {hovered.churchesPer10k.toFixed(1)}</div>
          <div style={{ color: '#A89A88' }}>YFI: {hovered.yfi} · WFI: {hovered.wfi}</div>
          <div style={{ color: '#A89A88' }}>SES: {hovered.sesLabel}</div>
          <div style={{ color: '#A89A88' }}>Dist to campus: {hovered.distanceToCampusMi != null ? `${hovered.distanceToCampusMi} mi` : '—'}</div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490', flexWrap: 'wrap' }}>
        {[['#F04B28', '≥ 75'], ['#7AA3AA', '60–74'], ['#D4883A', '45–59'], ['#A89A88', '< 45']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
            Fit Score {l}
          </span>
        ))}
        <span style={{ marginLeft: 8, color: 'rgba(240,75,40,0.5)' }}>■ Target quadrant</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(240,75,40,0.6)', border: '1.5px solid #F04B28', display: 'inline-block' }} />
          Existing campus
        </span>
      </div>
    </div>
  )
}

// ── Weight slider ─────────────────────────────────────────────────────────────

function WeightSlider({
  label, color, value, effPct, onChange,
}: {
  label: string; color: string; value: number; effPct: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 180, fontFamily: "'Gotham'", fontSize: 11, color: '#C8BCA8', flexShrink: 0 }}>
        {label}
      </div>
      <input
        type="range" min={0} max={100} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: color, cursor: 'pointer' }}
      />
      <div style={{ width: 44, textAlign: 'right', fontFamily: "'Gotham'", fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>
        {effPct.toFixed(0)}%
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortKey = 'fitScore' | 'populationGrowth' | 'churchesPer10k' | 'sesScore' | 'yfi' | 'wfi' | 'population' | 'enrollmentGrowthScore' | 'distanceToCampusMi'

export default function SiteScorerPage() {
  const [data, setData]             = useState<ZipScore[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [coverage, setCoverage]     = useState<'core' | 'all'>('core')
  const [refreshKey, setRefreshKey] = useState(0)
  const [weights, setWeights]       = useState<Weights>(DEFAULT_WEIGHTS)
  const [enabled, setEnabled]       = useState<Record<ToggleKey, boolean>>(DEFAULT_ENABLED)
  const [hovered, setHovered]       = useState<ZipScore | null>(null)
  const [sortKey, setSortKey]       = useState<SortKey>('fitScore')
  const [sortAsc, setSortAsc]       = useState(false)
  const [showAll, setShowAll]       = useState(false)
  const [copied, setCopied]         = useState(false)
  const skipUrlWrite                = useRef(true)

  // Read weights + coverage from URL on mount (once)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('coverage') === 'all') setCoverage('all')
    const fromUrl = weightsFromSearch(window.location.search)
    if (fromUrl) setWeights(fromUrl)
    const off = (p.get('off') ?? '').split(',').filter(Boolean)
    if (off.length || p.get('dist') === '1') {
      const e = { ...DEFAULT_ENABLED }
      for (const k of off) if (k in e) e[k as ToggleKey] = false
      if (p.get('dist') === '1') e.distance = true
      if (TOGGLE_KEYS.some(k => e[k])) setEnabled(e) // never leave the score empty
    }
  }, [])

  // Sync weights + coverage to URL whenever they change (skip first render)
  useEffect(() => {
    if (skipUrlWrite.current) { skipUrlWrite.current = false; return }
    const p = new URLSearchParams()
    if (coverage === 'all') p.set('coverage', 'all')
    for (const k of WEIGHT_KEYS) p.set(k, String(weights[k]))
    // Distance defaults off, so encode it as dist=1 (on) and only list the other off signals.
    const offKeys = TOGGLE_KEYS.filter(k => k !== 'distance' && !enabled[k])
    if (offKeys.length) p.set('off', offKeys.join(','))
    if (enabled.distance) p.set('dist', '1')
    window.history.replaceState(null, '', `/site-scorer?${p.toString()}`)
  }, [weights, coverage, enabled])

  // Fetch site-scorer data
  useEffect(() => {
    setLoading(true)
    fetch(`/api/site-scorer?coverage=${coverage}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(d.zips)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load data'); setLoading(false) })
  }, [coverage, refreshKey])

  function toggleSignal(k: ToggleKey) {
    const turningOn = !enabled[k]
    setEnabled(prev => {
      const next = { ...prev, [k]: !prev[k] }
      if (!TOGGLE_KEYS.some(key => next[key])) return prev // keep at least one signal in the score
      return next
    })
    // Distance defaults to weight 0; give it a usable weight the first time it's switched on.
    if (k === 'distance' && turningOn) {
      setWeights(w => (w.distance === 0 ? { ...w, distance: DISTANCE_DEFAULT_WEIGHT } : w))
    }
  }

  function handleNormalize() {
    const enabledTotal = TOGGLE_KEYS.filter(k => enabled[k]).reduce((s, k) => s + weights[k], 0)
    if (enabledTotal === 0) return
    setWeights(w => {
      const nw = { ...w }
      for (const k of TOGGLE_KEYS) if (enabled[k]) nw[k] = Math.round(w[k] / enabledTotal * 100)
      return nw
    })
  }

  function handleCoverageChange(val: 'core' | 'all') {
    setCoverage(val)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Mask out toggled-off signals before normalizing, so the score uses only the
  // enabled signals (the remaining weights renormalize to 100%).
  const maskedWeights: Weights = { ...weights }
  for (const k of TOGGLE_KEYS) if (!enabled[k]) maskedWeights[k] = 0
  const eff = effectivePct(maskedWeights)
  const isDefaultEnabled = TOGGLE_KEYS.every(k => enabled[k] === DEFAULT_ENABLED[k])

  // Score all ZIPs and compute percentile ranks
  const scored = data.map(z => ({ ...z, fitScore: computeFitScore(z, eff) }))
  const byScoreDesc = [...scored].sort((a, b) => b.fitScore - a.fitScore)
  const rankMap = new Map(byScoreDesc.map((z, i) => [z.zip, i + 1]))
  const totalZips = scored.length

  function topPct(zip: string) {
    return Math.max(1, Math.round(((rankMap.get(zip) ?? 1) / totalZips) * 100))
  }

  const sorted = [...scored].sort((a, b) => {
    const av = sortKey === 'fitScore' ? a.fitScore : (a[sortKey] ?? -999)
    const bv = sortKey === 'fitScore' ? b.fitScore : (b[sortKey] ?? -999)
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const topZips = sorted.slice(0, 10)
  const tableRows = showAll ? sorted : sorted.slice(0, 50)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function handleExport() {
    downloadCsv('site-scorer.csv', [
      'ZIP', 'Area', 'County', 'Fit Score', 'Percentile', 'Growth %', 'Churches/10K',
      'SES Score', 'SES Class', 'YFI', 'WFI', 'Enrollment Growth Score', 'Dist to Campus (mi)', 'Population', 'Total Churches',
    ], sorted.map(z => [
      z.zip, z.label, z.county ?? '', z.fitScore, `top ${topPct(z.zip)}%`,
      z.populationGrowth ?? '', z.churchesPer10k, z.sesScore, z.sesLabel,
      z.yfi, z.wfi, z.enrollmentGrowthScore, z.distanceToCampusMi ?? '', z.population, z.totalChurches,
    ]))
  }

  const thStyle = (key: SortKey): React.CSSProperties => ({
    textAlign: ['fitScore', 'population', 'yfi', 'wfi', 'sesScore', 'populationGrowth', 'churchesPer10k', 'enrollmentGrowthScore', 'distanceToCampusMi'].includes(key) ? 'right' : 'left',
    padding: '6px 10px 10px',
    color: sortKey === key ? '#F04B28' : '#B4A490',
    fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    borderBottom: '1px solid #424242', cursor: 'pointer', whiteSpace: 'nowrap' as const,
    fontFamily: "'Gotham'",
  })

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span style={{ marginLeft: 4 }}>{sortAsc ? '▲' : '▼'}</span> : null

  return (
    <div style={{ minHeight: '100vh', background: '#323232', color: '#E8DDD0' }}>
      <style>{`
        body { margin: 0; }
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');
        input[type=range] { height: 4px; }
        .ss-row:hover { background: rgba(255,255,255,0.03) !important; }
        .ss-campus-row { background: rgba(240,75,40,0.04) !important; }
        .ss-campus-row:hover { background: rgba(240,75,40,0.08) !important; }
      `}</style>

      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '40px 32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#F04B28', fontFamily: "'Gotham'", marginBottom: 6, textTransform: 'uppercase' }}>
              Lakepointe · Campus Opportunity
            </div>
            <h1 style={{ fontWeight: 900, fontFamily: "'Gotham',sans-serif", fontSize: 48, margin: 0, color: '#E8DDD0', letterSpacing: '0.02em' }}>
              Site Scorer
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={coverage}
              onChange={e => handleCoverageChange(e.target.value as 'core' | 'all')}
              style={{ fontFamily: "'Gotham'", fontSize: '11px', background: '#3C3C3C', color: '#E8DDD0', border: '1px solid #4A4A4A', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const }}
            >
              <option value="core">Core MSA · 11 counties</option>
              <option value="all">All ZIPs · Full coverage</option>
            </select>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              title="Reload data from database"
              style={{ fontFamily: "'Gotham'", fontSize: '11px', background: 'transparent', border: '1px solid #4A4A4A', borderRadius: '4px', color: '#A89A88', padding: '6px 12px', cursor: 'pointer' }}
            >↺ Reload</button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(196,90,70,0.1)', border: '1px solid rgba(196,90,70,0.3)', borderRadius: 8, padding: '16px 20px', marginBottom: 24, color: '#C45A46', fontFamily: "'Gotham'", fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ color: '#B4A490', fontFamily: "'Gotham'", fontSize: 13, padding: '40px 0' }}>Loading…</div>
        )}

        {!loading && !error && (
          <>
            {/* Weight controls */}
            <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, padding: '24px 28px', marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A89A88', fontFamily: "'Gotham'", marginBottom: 4 }}>
                    Scoring Weights
                  </div>
                  <div style={{ fontSize: 11, color: '#B4A490', fontFamily: "'Gotham'" }}>
                    Toggle which signals count, weight them with the sliders · share scenario via Copy Link
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Preset buttons */}
                  {Object.keys(PRESETS).map(name => (
                    <button
                      key={name}
                      onClick={() => { setWeights(PRESETS[name]); setEnabled(DEFAULT_ENABLED) }}
                      style={{
                        fontFamily: "'Gotham'", fontSize: 10,
                        background: isDefaultEnabled && JSON.stringify(weights) === JSON.stringify(PRESETS[name])
                          ? 'rgba(240,75,40,0.15)' : 'transparent',
                        border: isDefaultEnabled && JSON.stringify(weights) === JSON.stringify(PRESETS[name])
                          ? '1px solid rgba(240,75,40,0.5)' : '1px solid #4A4A4A',
                        borderRadius: 4, color: '#C8BCA8', padding: '5px 10px',
                        cursor: 'pointer', letterSpacing: '0.06em',
                      }}
                    >{name}</button>
                  ))}
                  <button
                    onClick={handleNormalize}
                    style={{ fontFamily: "'Gotham'", fontSize: 10, background: 'rgba(240,75,40,0.08)', border: '1px solid rgba(240,75,40,0.3)', borderRadius: 4, color: '#F04B28', padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >Normalize</button>
                  <button
                    onClick={() => { setWeights(DEFAULT_WEIGHTS); setEnabled(DEFAULT_ENABLED) }}
                    style={{ fontFamily: "'Gotham'", fontSize: 10, background: 'transparent', border: '1px solid #4A4A4A', borderRadius: 4, color: '#A89A88', padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >Reset</button>
                  <button
                    onClick={handleCopyLink}
                    style={{ fontFamily: "'Gotham'", fontSize: 10, background: copied ? 'rgba(212,136,58,0.1)' : 'transparent', border: `1px solid ${copied ? 'rgba(212,136,58,0.4)' : '#4A4A4A'}`, borderRadius: 4, color: copied ? '#D4883A' : '#A89A88', padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.06em' }}
                  >{copied ? '✓ Copied!' : '⎘ Copy Link'}</button>
                </div>
              </div>
              {/* Signal toggles — pick which signals are in the score */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B4A490', fontFamily: "'Gotham'", marginBottom: 9 }}>
                  Signals in score · click to include / exclude
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SIGNALS.map(s => {
                    const on = enabled[s.key]
                    return (
                      <button
                        key={s.key}
                        onClick={() => toggleSignal(s.key)}
                        title={on ? `${s.full} — included (${eff[s.key].toFixed(0)}% of score)` : `${s.full} — excluded from score`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          fontFamily: "'Gotham'", fontSize: 11,
                          padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                          background: on ? `${s.color}1A` : 'transparent',
                          border: `1px solid ${on ? s.color + '80' : '#4A4A4A'}`,
                          color: on ? '#E8E8EC' : '#B4A490',
                          transition: 'all 0.12s',
                        }}
                      >
                        <span style={{
                          width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                          background: on ? s.color : 'transparent',
                          border: `1.5px solid ${on ? s.color : '#A08E7A'}`,
                        }} />
                        {s.label}
                        <span style={{ color: on ? s.color : '#A08E7A', fontWeight: 600 }}>
                          {on ? `${eff[s.key].toFixed(0)}%` : 'off'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {SIGNALS.filter(s => enabled[s.key]).map(s => (
                  <WeightSlider
                    key={s.key}
                    label={s.full}
                    color={s.color}
                    value={weights[s.key]}
                    effPct={eff[s.key]}
                    onChange={v => setWeights(w => ({ ...w, [s.key]: v }))}
                  />
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 10, color: '#B4A490', fontFamily: "'Gotham'" }}>
                Church Saturation Opportunity = inverse of churches/10K. School Enrollment Growth = TEA PEIMS county CAGR (0 when not loaded). <span style={{ color: '#FB923C' }}>Distance</span> = straight-line miles to the nearest existing campus (farther = more open territory); off by default. See <a href="/methodology#site-scorer" style={{ color: '#B4A490', textDecoration: 'underline' }}>/methodology</a>.
              </div>
            </div>

            {/* Scatter + Top 10 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginBottom: 32, alignItems: 'start' }}>

              {/* Scatter chart */}
              <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, padding: '24px 28px' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A89A88', fontFamily: "'Gotham'", marginBottom: 16 }}>
                  Opportunity Quadrant · Growth vs. Church Saturation
                </div>
                <ScatterChart data={data} eff={eff} onHover={setHovered} hovered={hovered} />
              </div>

              {/* Top 10 */}
              <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, padding: '24px 24px' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A89A88', fontFamily: "'Gotham'", marginBottom: 16 }}>
                  Top 10 · Fit Score
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topZips.map((z, i) => {
                    const color = scoreColor(z.fitScore)
                    const pct = topPct(z.zip)
                    const [d1, d2] = topDrivers(z, eff)
                    return (
                      <div key={z.zip} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 9 ? '1px solid #1a1f2e' : 'none' }}>
                        <div style={{ width: 20, fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490', textAlign: 'right', flexShrink: 0 }}>
                          #{i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Gotham'", fontSize: 11, color: '#F04B28', marginBottom: 1 }}>
                            {z.zip}
                            {EXISTING_CAMPUS_ZIPS.has(z.zip) && (
                              <span style={{ marginLeft: 5, fontSize: 9, color: 'rgba(240,75,40,0.6)', border: '1px solid rgba(240,75,40,0.3)', borderRadius: 3, padding: '1px 3px' }}>
                                {CAMPUS_LABEL[z.zip]}
                              </span>
                            )}
                          </div>
                          <div style={{ fontFamily: "'Gotham',sans-serif", fontSize: 10, color: '#A89A88', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.label}</div>
                          <div style={{ fontFamily: "'Gotham'", fontSize: 9, color: '#A08E7A', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {d1} + {d2}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: "'Gotham',sans-serif", fontSize: 22, color, lineHeight: 1 }}>
                            {z.fitScore}
                          </div>
                          <div style={{ fontFamily: "'Gotham'", fontSize: 9, color: '#B4A490', marginTop: 2 }}>
                            top {pct}%
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Full ranked table */}
            <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A89A88', fontFamily: "'Gotham'" }}>
                    All ZIPs · Ranked by Fit Score
                  </div>
                  <div style={{ fontSize: 10, color: '#A08E7A', fontFamily: "'Gotham'", marginTop: 3 }}>
                    {totalZips} ZIPs · gold rows = existing Lakepointe campuses
                  </div>
                </div>
                <button
                  onClick={handleExport}
                  style={{ fontFamily: "'Gotham'", fontSize: 10, background: 'transparent', border: '1px solid #4A4A4A', borderRadius: 4, color: '#A89A88', padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >↓ CSV</button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Gotham'", fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle('fitScore'), textAlign: 'center' }} onClick={() => handleSort('fitScore')}>Rank</th>
                      <th style={{ ...thStyle('fitScore'), textAlign: 'left' }} onClick={() => handleSort('fitScore')}>ZIP</th>
                      <th style={{ ...thStyle('fitScore'), textAlign: 'left' }}>Area</th>
                      <th style={thStyle('fitScore')} onClick={() => handleSort('fitScore')}>Fit Score <SortArrow k="fitScore" /></th>
                      <th style={{ ...thStyle('fitScore'), textAlign: 'left' }}>Percentile</th>
                      <th style={thStyle('populationGrowth')} onClick={() => handleSort('populationGrowth')}>Growth % <SortArrow k="populationGrowth" /></th>
                      <th style={thStyle('churchesPer10k')} onClick={() => handleSort('churchesPer10k')}>Chr/10K <SortArrow k="churchesPer10k" /></th>
                      <th style={thStyle('sesScore')} onClick={() => handleSort('sesScore')}>SES <SortArrow k="sesScore" /></th>
                      <th style={thStyle('yfi')} onClick={() => handleSort('yfi')}>YFI <SortArrow k="yfi" /></th>
                      <th style={thStyle('wfi')} onClick={() => handleSort('wfi')}>WFI <SortArrow k="wfi" /></th>
                      <th style={thStyle('enrollmentGrowthScore')} onClick={() => handleSort('enrollmentGrowthScore')}>Enroll. <SortArrow k="enrollmentGrowthScore" /></th>
                      <th style={thStyle('distanceToCampusMi')} onClick={() => handleSort('distanceToCampusMi')}>Dist mi <SortArrow k="distanceToCampusMi" /></th>
                      <th style={thStyle('population')} onClick={() => handleSort('population')}>Pop. <SortArrow k="population" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((z, i) => {
                      const color = scoreColor(z.fitScore)
                      const isCampus = EXISTING_CAMPUS_ZIPS.has(z.zip)
                      const pct = topPct(z.zip)
                      return (
                        <tr
                          key={z.zip}
                          className={isCampus ? 'ss-campus-row' : 'ss-row'}
                          style={{
                            borderBottom: '1px solid #1a1f2e',
                            borderLeft: isCampus ? '2px solid rgba(240,75,40,0.4)' : '2px solid transparent',
                          }}
                          onMouseEnter={() => setHovered(z)}
                          onMouseLeave={() => setHovered(null)}
                        >
                          <td style={{ padding: '7px 10px', color: '#B4A490', textAlign: 'center' }}>{i + 1}</td>
                          <td style={{ padding: '7px 10px', color: '#F04B28' }}>
                            {z.zip}
                            {isCampus && (
                              <span style={{ marginLeft: 5, fontSize: 9, color: 'rgba(240,75,40,0.6)', border: '1px solid rgba(240,75,40,0.25)', borderRadius: 3, padding: '1px 3px' }}>
                                {CAMPUS_LABEL[z.zip]}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '7px 10px', color: '#C8BCA8', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.label}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                            <span style={{ color, fontWeight: 600, fontSize: 13 }}>{z.fitScore}</span>
                          </td>
                          <td style={{ padding: '7px 10px', color: '#B4A490', fontSize: 10 }}>
                            top {pct}%
                            <span style={{ color: '#A08E7A', marginLeft: 3 }}>of {totalZips}</span>
                          </td>
                          <td
                            style={{ padding: '7px 10px', textAlign: 'right', color: (z.populationGrowth ?? 0) > 0 ? '#D4883A' : '#C45A46' }}
                            title={z.populationGrowth == null && BOUNDARY_CHANGED.has(z.zip) ? 'ZCTA boundary changed 2020→2023 — growth comparison invalid' : undefined}
                          >
                            {z.populationGrowth != null ? `${z.populationGrowth.toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#A89A88' }}>
                            {z.churchesPer10k.toFixed(1)}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#7A9E8A' }}>
                            {z.sesScore.toFixed(0)}
                            <span style={{ fontSize: 9, color: '#B4A490', marginLeft: 4 }}>{z.sesLabel.replace(' Income', '').replace(' Middle', 'M').replace('Upper', 'U')}</span>
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#7AA3AA' }}>{z.yfi}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#D4883A' }}>{z.wfi}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: z.enrollmentGrowthScore > 0 ? '#D4883A' : '#A08E7A' }}>
                            {z.enrollmentGrowthScore > 0 ? z.enrollmentGrowthScore : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: z.distanceToCampusMi != null ? '#FB923C' : '#A08E7A' }}>
                            {z.distanceToCampusMi != null ? z.distanceToCampusMi.toFixed(1) : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#B4A490' }}>{z.population.toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {sorted.length > 50 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  style={{ marginTop: 14, background: 'transparent', border: '1px solid #4A4A4A', borderRadius: 6, color: '#A89A88', fontFamily: "'Gotham'", fontSize: 11, padding: '7px 16px', cursor: 'pointer' }}
                >
                  {showAll ? '▲ Show fewer' : `Show all ${sorted.length} ZIPs ▼`}
                </button>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid #424242', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490' }}>
                Church saturation: IRS BMF Christian orgs (NTEE X20/X21/X22) · Updated monthly
              </span>
              <span style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490' }}>
                BMF undercounts congregations — use index for relative comparison only
              </span>
              <span style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490' }}>
                * ZCTA boundaries approximate USPS ZIP codes
              </span>
              <a
                href="/admin/decisions"
                style={{ marginLeft: 'auto', fontFamily: "'Gotham'", fontSize: 10, color: '#F04B28', textDecoration: 'none', border: '1px solid rgba(240,75,40,0.3)', borderRadius: 4, padding: '4px 10px', opacity: 0.8 }}
              >📋 Log a site decision →</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
