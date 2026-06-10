'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { downloadCsv } from '@/lib/csv'

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
}

interface Weights {
  yfi: number
  wfi: number
  ses: number
  growth: number
  saturation: number
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: Weights = { yfi: 25, wfi: 25, ses: 20, growth: 15, saturation: 15 }

function effectivePct(w: Weights): Weights {
  const total = w.yfi + w.wfi + w.ses + w.growth + w.saturation || 1
  return {
    yfi:        (w.yfi / total) * 100,
    wfi:        (w.wfi / total) * 100,
    ses:        (w.ses / total) * 100,
    growth:     (w.growth / total) * 100,
    saturation: (w.saturation / total) * 100,
  }
}

function growthScore(g: number | null): number {
  if (g == null) return 0
  return Math.min(100, Math.max(0, (g + 10) / 50 * 100))
}

function satOpportunityScore(cper10k: number): number {
  // 0 churches/10K = 100 (max opportunity), 30+/10K = 0
  return Math.max(0, 100 - Math.min(100, (cper10k / 30) * 100))
}

function computeFitScore(z: ZipScore, eff: Weights): number {
  return Math.round(
    z.yfi * eff.yfi / 100 +
    z.wfi * eff.wfi / 100 +
    z.sesScore * eff.ses / 100 +
    satOpportunityScore(z.churchesPer10k) * eff.saturation / 100 +
    growthScore(z.populationGrowth) * eff.growth / 100
  )
}

function scoreColor(score: number): string {
  if (score >= 75) return '#E8B84B'
  if (score >= 60) return '#4EAEFF'
  if (score >= 45) return '#2DD4BF'
  return '#8A98AE'
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
          fill="rgba(232,184,75,0.06)"
        />

        {/* Quadrant dividers */}
        <line x1={xDiv} y1={MT - 4} x2={xDiv} y2={MT + CH} stroke="#232940" strokeWidth={1} strokeDasharray="4,3" />
        <line x1={ML} y1={yDiv} x2={ML + CW} y2={yDiv} stroke="#232940" strokeWidth={1} strokeDasharray="4,3" />

        {/* Quadrant labels */}
        <text x={xDiv + 6} y={MT + 12} fontSize={8} fontFamily="'IBM Plex Mono',monospace" fill="rgba(232,184,75,0.7)">
          HIGH GROWTH · LOW SATURATION ▲
        </text>
        <text x={ML + 6} y={MT + 12} fontSize={8} fontFamily="'IBM Plex Mono',monospace" fill="#3d4a5c">
          LOW GROWTH · LOW SAT.
        </text>
        <text x={xDiv + 6} y={MT + CH - 4} fontSize={8} fontFamily="'IBM Plex Mono',monospace" fill="#3d4a5c">
          HIGH GROWTH · HIGH SAT.
        </text>
        <text x={ML + 6} y={MT + CH - 4} fontSize={8} fontFamily="'IBM Plex Mono',monospace" fill="#3d4a5c">
          LOW GROWTH · HIGH SAT.
        </text>

        {/* Y axis */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#1e2b3c" strokeWidth={1} />
        {yTicks.map(t => {
          const y = toY(t)
          return (
            <g key={t}>
              <line x1={ML - 4} y1={y} x2={ML} y2={y} stroke="#232940" strokeWidth={1} />
              <text x={ML - 7} y={y + 3} fontSize={9} fontFamily="'IBM Plex Mono',monospace" fill="#5a6478" textAnchor="end">{t}</text>
            </g>
          )
        })}
        <text
          transform={`translate(11,${MT + CH / 2}) rotate(-90)`}
          fontSize={9} fontFamily="'IBM Plex Mono',monospace" fill="#8A98AE" textAnchor="middle"
        >Churches / 10K</text>
        <text
          transform={`translate(11,${MT + 10})`}
          fontSize={8} fontFamily="'IBM Plex Mono',monospace" fill="#5a6478" textAnchor="middle"
        >← opportunity</text>

        {/* X axis */}
        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#1e2b3c" strokeWidth={1} />
        {xTicks.map(t => {
          const x = toX(t)
          return (
            <g key={t}>
              <line x1={x} y1={MT + CH} x2={x} y2={MT + CH + 4} stroke="#232940" strokeWidth={1} />
              <text x={x} y={MT + CH + 14} fontSize={9} fontFamily="'IBM Plex Mono',monospace" fill="#5a6478" textAnchor="middle">{t}%</text>
            </g>
          )
        })}
        <text x={ML + CW / 2} y={VH - 4} fontSize={9} fontFamily="'IBM Plex Mono',monospace" fill="#8A98AE" textAnchor="middle">
          Population Growth (%)
        </text>

        {/* Dots */}
        {plotData.map(d => {
          const x = toX(d.populationGrowth!)
          const y = toY(d.churchesPer10k)
          const score = computeFitScore(d, eff)
          const color = scoreColor(score)
          const isH = hovered?.zip === d.zip
          return (
            <circle
              key={d.zip}
              cx={x} cy={y}
              r={isH ? 5.5 : 3.5}
              fill={color}
              fillOpacity={isH ? 1 : 0.65}
              stroke={isH ? color : 'none'}
              strokeWidth={isH ? 1.5 : 0}
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
          background: '#13161f',
          border: `1px solid ${scoreColor(computeFitScore(hovered, eff))}40`,
          borderRadius: 6,
          padding: '10px 14px',
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 11,
          minWidth: 180,
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ color: '#E8B84B', fontWeight: 600, marginBottom: 6 }}>
            {hovered.zip} · {hovered.label}
          </div>
          <div style={{ color: '#C8D4E4', marginBottom: 3 }}>
            Fit Score: <span style={{ color: scoreColor(computeFitScore(hovered, eff)) }}>{computeFitScore(hovered, eff)}</span>
          </div>
          <div style={{ color: '#8A98AE' }}>Growth: {hovered.populationGrowth != null ? `${hovered.populationGrowth.toFixed(1)}%` : '—'}</div>
          <div style={{ color: '#8A98AE' }}>Churches/10K: {hovered.churchesPer10k.toFixed(1)}</div>
          <div style={{ color: '#8A98AE' }}>YFI: {hovered.yfi} · WFI: {hovered.wfi}</div>
          <div style={{ color: '#8A98AE' }}>SES: {hovered.sesLabel}</div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#5a6478', flexWrap: 'wrap' }}>
        {[['#E8B84B', '≥ 75'], ['#4EAEFF', '60–74'], ['#2DD4BF', '45–59'], ['#8A98AE', '< 45']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
            Fit Score {l}
          </span>
        ))}
        <span style={{ marginLeft: 8, color: 'rgba(232,184,75,0.5)' }}>■ Target quadrant</span>
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
      <div style={{ width: 160, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#A8B4C5', flexShrink: 0 }}>
        {label}
      </div>
      <input
        type="range" min={0} max={100} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: color, cursor: 'pointer' }}
      />
      <div style={{ width: 44, textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>
        {effPct.toFixed(0)}%
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortKey = 'fitScore' | 'populationGrowth' | 'churchesPer10k' | 'sesScore' | 'yfi' | 'wfi' | 'population'

export default function SiteScorerPage() {
  const [data, setData]           = useState<ZipScore[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [coverage, setCoverage]   = useState<'core' | 'all'>('core')
  const [refreshKey, setRefreshKey] = useState(0)
  const [weights, setWeights]     = useState<Weights>(DEFAULT_WEIGHTS)

  function handleNormalize() {
    const total = weights.yfi + weights.wfi + weights.ses + weights.growth + weights.saturation
    if (total === 0) return
    setWeights({
      yfi:        Math.round(weights.yfi / total * 100),
      wfi:        Math.round(weights.wfi / total * 100),
      ses:        Math.round(weights.ses / total * 100),
      growth:     Math.round(weights.growth / total * 100),
      saturation: Math.round(weights.saturation / total * 100),
    })
  }
  const [hovered, setHovered]     = useState<ZipScore | null>(null)
  const [sortKey, setSortKey]     = useState<SortKey>('fitScore')
  const [sortAsc, setSortAsc]     = useState(false)
  const [showAll, setShowAll]     = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('coverage') === 'all') setCoverage('all')
  }, [])

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

  function handleCoverageChange(val: 'core' | 'all') {
    setCoverage(val)
    const url = new URL(window.location.href)
    val === 'all' ? url.searchParams.set('coverage', 'all') : url.searchParams.delete('coverage')
    window.history.replaceState(null, '', url.toString())
  }

  const eff = effectivePct(weights)

  const scored = data.map(z => ({ ...z, fitScore: computeFitScore(z, eff) }))

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
      'ZIP', 'Area', 'Fit Score', 'Growth %', 'Churches/10K', 'SES Score', 'SES Class', 'YFI', 'WFI', 'Population', 'Total Churches',
    ], sorted.map(z => [
      z.zip, z.label, z.fitScore, z.populationGrowth ?? '', z.churchesPer10k, z.sesScore, z.sesLabel, z.yfi, z.wfi, z.population, z.totalChurches,
    ]))
  }

  const thStyle = (key: SortKey): React.CSSProperties => ({
    textAlign: key === 'fitScore' || key === 'population' || key === 'yfi' || key === 'wfi' || key === 'sesScore' || key === 'populationGrowth' || key === 'churchesPer10k' ? 'right' : 'left',
    padding: '6px 10px 10px',
    color: sortKey === key ? '#E8B84B' : '#5a6478',
    fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    borderBottom: '1px solid #1e2b3c', cursor: 'pointer', whiteSpace: 'nowrap' as const,
    fontFamily: "'IBM Plex Mono',monospace",
  })

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span style={{ marginLeft: 4 }}>{sortAsc ? '▲' : '▼'}</span> : null

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f14', color: '#C8D4E4' }}>
      <style>{`
        body { margin: 0; }
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');
        input[type=range] { height: 4px; }
        .ss-row:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#E8B84B', fontFamily: "'IBM Plex Mono',monospace", marginBottom: 6, textTransform: 'uppercase' }}>
              Lakepointe · Campus Opportunity
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, margin: 0, color: '#C8D4E4', letterSpacing: '0.02em' }}>
              Site Scorer
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={coverage}
              onChange={e => handleCoverageChange(e.target.value as 'core' | 'all')}
              style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', background: '#13161f', color: '#C8D4E4', border: '1px solid #232940', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const }}
            >
              <option value="core">Core MSA · 11 counties</option>
              <option value="all">All ZIPs · Full coverage</option>
            </select>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', background: 'transparent', border: '1px solid #232940', borderRadius: '4px', color: '#8A98AE', padding: '6px 12px', cursor: 'pointer' }}
            >↺ Refresh</button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '16px 20px', marginBottom: 24, color: '#FF6B6B', fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ color: '#5a6478', fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: '40px 0' }}>Loading…</div>
        )}

        {!loading && !error && (
          <>
            {/* Weight controls */}
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px', marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4 }}>
                    Scoring Weights
                  </div>
                  <div style={{ fontSize: 11, color: '#5a6478', fontFamily: "'IBM Plex Mono',monospace" }}>
                    Adjust sliders, then click Normalize to snap all values to 100%
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleNormalize}
                    style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.3)', borderRadius: 4, color: '#E8B84B', padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >Normalize</button>
                  <button
                    onClick={() => setWeights(DEFAULT_WEIGHTS)}
                    style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, background: 'transparent', border: '1px solid #232940', borderRadius: 4, color: '#8A98AE', padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >Reset</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <WeightSlider label="Young Family Index (YFI)"   color="#4EAEFF" value={weights.yfi}        effPct={eff.yfi}        onChange={v => setWeights(w => ({ ...w, yfi: v }))} />
                <WeightSlider label="Working Family Index (WFI)" color="#2DD4BF" value={weights.wfi}        effPct={eff.wfi}        onChange={v => setWeights(w => ({ ...w, wfi: v }))} />
                <WeightSlider label="SES Score"                  color="#A78BFA" value={weights.ses}        effPct={eff.ses}        onChange={v => setWeights(w => ({ ...w, ses: v }))} />
                <WeightSlider label="Population Growth"          color="#FF6B6B" value={weights.growth}     effPct={eff.growth}     onChange={v => setWeights(w => ({ ...w, growth: v }))} />
                <WeightSlider label="Church Saturation Opp."     color="#E8B84B" value={weights.saturation} effPct={eff.saturation} onChange={v => setWeights(w => ({ ...w, saturation: v }))} />
              </div>
              <div style={{ marginTop: 16, fontSize: 10, color: '#5a6478', fontFamily: "'IBM Plex Mono',monospace" }}>
                Church Saturation Opportunity = inverse of churches/10K — lower saturation = higher score. Source: IRS BMF Christian orgs (NTEE X20–X22). See <a href="/methodology#site-scorer" style={{ color: '#5a6478', textDecoration: 'underline' }}>/methodology</a> for full formulas.
              </div>
            </div>

            {/* Scatter + Top 10 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginBottom: 32, alignItems: 'start' }}>

              {/* Scatter chart */}
              <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono',monospace", marginBottom: 16 }}>
                  Opportunity Quadrant · Growth vs. Church Saturation
                </div>
                <ScatterChart data={data} eff={eff} onHover={setHovered} hovered={hovered} />
              </div>

              {/* Top 10 */}
              <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 24px' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono',monospace", marginBottom: 16 }}>
                  Top 10 · Fit Score
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topZips.map((z, i) => {
                    const color = scoreColor(z.fitScore)
                    return (
                      <div key={z.zip} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 9 ? '1px solid #1a1f2e' : 'none' }}>
                        <div style={{ width: 20, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#5a6478', textAlign: 'right', flexShrink: 0 }}>
                          #{i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#E8B84B', marginBottom: 1 }}>{z.zip}</div>
                          <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, color: '#8A98AE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.label}</div>
                        </div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color, lineHeight: 1, flexShrink: 0 }}>
                          {z.fitScore}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Full ranked table */}
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono',monospace" }}>
                  All ZIPs · Ranked by Fit Score
                </div>
                <button
                  onClick={handleExport}
                  style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, background: 'transparent', border: '1px solid #232940', borderRadius: 4, color: '#8A98AE', padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >↓ CSV</button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle('fitScore'), textAlign: 'center' }} onClick={() => handleSort('fitScore')}>Rank</th>
                      <th style={{ ...thStyle('fitScore'), textAlign: 'left' }} onClick={() => handleSort('fitScore')}>ZIP</th>
                      <th style={{ ...thStyle('fitScore'), textAlign: 'left' }}>Area</th>
                      <th style={thStyle('fitScore')} onClick={() => handleSort('fitScore')}>Fit Score <SortArrow k="fitScore" /></th>
                      <th style={thStyle('populationGrowth')} onClick={() => handleSort('populationGrowth')}>Growth % <SortArrow k="populationGrowth" /></th>
                      <th style={thStyle('churchesPer10k')} onClick={() => handleSort('churchesPer10k')}>Churches/10K <SortArrow k="churchesPer10k" /></th>
                      <th style={thStyle('sesScore')} onClick={() => handleSort('sesScore')}>SES <SortArrow k="sesScore" /></th>
                      <th style={thStyle('yfi')} onClick={() => handleSort('yfi')}>YFI <SortArrow k="yfi" /></th>
                      <th style={thStyle('wfi')} onClick={() => handleSort('wfi')}>WFI <SortArrow k="wfi" /></th>
                      <th style={thStyle('population')} onClick={() => handleSort('population')}>Pop. <SortArrow k="population" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((z, i) => {
                      const color = scoreColor(z.fitScore)
                      return (
                        <tr
                          key={z.zip}
                          className="ss-row"
                          style={{ borderBottom: '1px solid #1a1f2e' }}
                          onMouseEnter={() => setHovered(z)}
                          onMouseLeave={() => setHovered(null)}
                        >
                          <td style={{ padding: '7px 10px', color: '#5a6478', textAlign: 'center' }}>{i + 1}</td>
                          <td style={{ padding: '7px 10px', color: '#E8B84B' }}>{z.zip}</td>
                          <td style={{ padding: '7px 10px', color: '#A8B4C5', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.label}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                            <span style={{ color, fontWeight: 600, fontSize: 13 }}>{z.fitScore}</span>
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: (z.populationGrowth ?? 0) > 0 ? '#2DD4BF' : '#FF6B6B' }}>
                            {z.populationGrowth != null ? `${z.populationGrowth.toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#8A98AE' }}>
                            {z.churchesPer10k.toFixed(1)}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#A78BFA' }}>
                            {z.sesScore.toFixed(0)}
                            <span style={{ fontSize: 9, color: '#5a6478', marginLeft: 4 }}>{z.sesLabel.replace(' Income', '').replace(' Middle', 'M').replace('Upper', 'U')}</span>
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#4EAEFF' }}>{z.yfi}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#2DD4BF' }}>{z.wfi}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#5a6478' }}>{z.population.toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {sorted.length > 50 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  style={{ marginTop: 14, background: 'transparent', border: '1px solid #232940', borderRadius: 6, color: '#8A98AE', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, padding: '7px 16px', cursor: 'pointer' }}
                >
                  {showAll ? '▲ Show fewer' : `Show all ${sorted.length} ZIPs ▼`}
                </button>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid #1e2b3c', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#5a6478' }}>
                Church saturation: IRS BMF Christian orgs (NTEE X20/X21/X22) · Updated monthly
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#5a6478' }}>
                BMF undercounts congregations — use index for relative comparison only, not absolute counts
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#5a6478' }}>
                * ZCTA boundaries approximate USPS ZIP codes
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
