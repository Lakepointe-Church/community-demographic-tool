'use client'

import { useState, useEffect } from 'react'
import { ZIP_GROUPS } from '@/lib/zips'

interface SectorRow { label: string; estab: number; avgWage?: number | null }

interface Overview {
  totalEstab: number
  totalEmp: number
  totalPayroll: number
  avgWage: number | null
  zipCount: number
  sectors: SectorRow[]
  topZips: { zip: string; name: string; totalEstab: number; totalEmp: number }[]
}

interface ZipData {
  zip: string
  name: string
  totalEstab: number
  totalEmp: number
  totalPayroll: number
  largeEstab: number
  topSector: string | null
  avgWage: number | null
  sectors: SectorRow[]
  sectorWages: { label: string; avgWage: number }[]
  sizeDist: SectorRow[]
  population: number | null
  medianHouseholdIncome: number | null
}

const CARD_BG = 'linear-gradient(145deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%)'

const PALETTE = ['#4EAEFF','#2DD4BF','#E8B84B','#A78BFA','#FF6B6B','#4EAEFF88','#2DD4BF88','#E8B84B88','#A78BFA88','#FF6B6B88']
const RGB_MAP: Record<string, string> = {
  '#E8B84B':'232,184,75','#4EAEFF':'78,174,255',
  '#2DD4BF':'45,212,191','#A78BFA':'167,139,250','#FF6B6B':'255,107,107',
}

function fmt$(n: number) { return '$' + n.toLocaleString() }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, loading }: {
  label: string; value: string; sub?: string; color: string; loading?: boolean
}) {
  const [hov, setHov] = useState(false)
  const rgb = RGB_MAP[color] ?? '232,184,75'
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      background: hov
        ? `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.22) 0%,transparent 60%),linear-gradient(145deg,rgba(${rgb},0.08) 0%,rgba(255,255,255,0.01) 100%)`
        : `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.1) 0%,transparent 55%),${CARD_BG}`,
      border: `1px solid ${hov ? `rgba(${rgb},0.4)` : '#232940'}`,
      borderRadius: '4px', padding: '20px 24px', transition: 'all 0.2s',
    }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'10px' }}>{label}</div>
      {loading
        ? <div style={{ height:'36px', width:'60%', background:'rgba(255,255,255,0.05)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
        : <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'40px', letterSpacing:'0.04em', color, lineHeight:1 }}>{value}</div>
      }
      {sub && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#5a6478', marginTop:'8px', letterSpacing:'0.04em' }}>{sub}</div>}
    </div>
  )
}

// ── Donut Chart ────────────────────────────────────────────────────
function DonutChart({ sectors }: { sectors: SectorRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const top = sectors.slice(0, 8)
  const otherEstab = sectors.slice(8).reduce((s, x) => s + x.estab, 0)
  const slices = otherEstab > 0 ? [...top, { label: 'Other', estab: otherEstab }] : top
  const total = slices.reduce((s, x) => s + x.estab, 0)
  if (total === 0) return <div style={{ color:'#5a6478', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px' }}>No data</div>

  const cx = 110, cy = 110, r = 80, inner = 52
  let angle = -Math.PI / 2
  const paths = slices.map((s, i) => {
    const sweep = (s.estab / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const xi1 = cx + inner * Math.cos(angle - sweep)
    const yi1 = cy + inner * Math.sin(angle - sweep)
    const xi2 = cx + inner * Math.cos(angle)
    const yi2 = cy + inner * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const color = PALETTE[i % PALETTE.length]
    const midAngle = angle - sweep / 2
    return { d: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${inner},${inner} 0 ${large},0 ${xi1},${yi1} Z`, color, label: s.label, estab: s.estab, pct: Math.round(s.estab / total * 100), midAngle, i }
  })

  const hov = hovered !== null ? paths[hovered] : null

  return (
    <div style={{ display:'flex', gap:'24px', alignItems:'center', flexWrap:'wrap' }}>
      <svg width="220" height="220" style={{ flexShrink:0 }}>
        {paths.map(p => (
          <path key={p.i} d={p.d}
            fill={p.color}
            opacity={hovered === null || hovered === p.i ? 1 : 0.4}
            style={{ cursor:'pointer', transition:'opacity 0.15s' }}
            onMouseEnter={() => setHovered(p.i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#F0F2F7" fontSize="18" fontFamily="Bebas Neue" letterSpacing="0.05em">
          {hov ? hov.pct + '%' : total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#8A98AE" fontSize="9" fontFamily="IBM Plex Mono">
          {hov ? hov.label.slice(0, 14) : 'establishments'}
        </text>
      </svg>
      {/* Legend */}
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {paths.map((p, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', opacity: hovered === null || hovered === i ? 1 : 0.4, transition:'opacity 0.15s', cursor:'default' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:p.color, flexShrink:0 }} />
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#A8B4C5' }}>{p.label}</span>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginLeft:'auto', paddingLeft:'12px' }}>{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Size Distribution Bar Chart ────────────────────────────────────
function SizeChart({ sizeDist }: { sizeDist: SectorRow[] }) {
  if (!sizeDist.length) return <div style={{ color:'#5a6478', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px' }}>No size data available</div>
  const maxVal = Math.max(...sizeDist.map(s => s.estab), 1)
  const barW = 44, gap = 12, padLeft = 8, padTop = 24, chartH = 140
  const svgW = padLeft + sizeDist.length * (barW + gap)
  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${chartH + 52}`} style={{ overflow:'visible' }}>
      <defs>
        {sizeDist.map((_, i) => (
          <linearGradient key={i} id={`szGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE[i % PALETTE.length].replace('88','')} />
            <stop offset="100%" stopColor={`${PALETTE[i % PALETTE.length].replace('88','')}40`} />
          </linearGradient>
        ))}
      </defs>
      {sizeDist.map((s, i) => {
        const x = padLeft + i * (barW + gap)
        const bh = (s.estab / maxVal) * chartH
        const y = padTop + chartH - bh
        const color = PALETTE[i % PALETTE.length].replace('88','')
        return (
          <g key={s.label}>
            <rect x={x} y={y} width={barW} height={bh} fill={`url(#szGrad-${i})`} rx="2" />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill={color} fontSize="10" fontFamily="IBM Plex Mono" fontWeight="600">{s.estab}</text>
            <text x={x + barW / 2} y={padTop + chartH + 14} textAnchor="middle" fill="#8A98AE" fontSize="9" fontFamily="IBM Plex Mono">{s.label}</text>
            <text x={x + barW / 2} y={padTop + chartH + 26} textAnchor="middle" fill="#5a6478" fontSize="8" fontFamily="IBM Plex Mono">emp</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Horizontal bar for DFW overview ────────────────────────────────
function SectorBarChart({ sectors }: { sectors: SectorRow[] }) {
  const top = sectors.slice(0, 15)
  const maxVal = Math.max(...top.map(s => s.estab), 1)
  const rowH = 30, labelW = 155, barAreaW = 300, numW = 65
  const svgW = labelW + barAreaW + numW
  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${top.length * rowH + 16}`} style={{ overflow:'visible' }}>
      <defs>
        {top.map((_, i) => (
          <linearGradient key={i} id={`bGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PALETTE[i % 5]} />
            <stop offset="100%" stopColor={`${PALETTE[i % 5]}40`} />
          </linearGradient>
        ))}
      </defs>
      {top.map((s, i) => {
        const y = i * rowH + 8
        const bw = (s.estab / maxVal) * barAreaW
        const color = PALETTE[i % 5]
        return (
          <g key={s.label}>
            <text x={labelW - 8} y={y + 10} textAnchor="end" fill="#8A98AE" fontSize="10" fontFamily="IBM Plex Mono">{s.label}</text>
            <rect x={labelW} y={y} width={Math.max(bw, 2)} height={18} fill={`url(#bGrad-${i})`} rx="2" />
            <text x={labelW + bw + 8} y={y + 12} fill={color} fontSize="10" fontFamily="IBM Plex Mono" fontWeight="600">{s.estab.toLocaleString()}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Wage Bar Chart ────────────────────────────────────────────────
function WageBarChart({ sectors }: { sectors: SectorRow[] }) {
  const withWage = sectors.filter(s => s.avgWage != null).sort((a, b) => (b.avgWage ?? 0) - (a.avgWage ?? 0))
  if (!withWage.length) return (
    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#5a6478', padding:'12px 0' }}>
      Wage data available after next data refresh
    </div>
  )
  const maxWage = Math.max(...withWage.map(s => s.avgWage ?? 0))
  const rowH = 30, labelW = 155, barAreaW = 300, numW = 85
  const svgW = labelW + barAreaW + numW
  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${withWage.length * rowH + 16}`} style={{ overflow:'visible' }}>
      <defs>
        {withWage.map((_, i) => (
          <linearGradient key={i} id={`wGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PALETTE[i % 5]} />
            <stop offset="100%" stopColor={`${PALETTE[i % 5]}40`} />
          </linearGradient>
        ))}
      </defs>
      {withWage.map((s, i) => {
        const y = i * rowH + 8
        const bw = ((s.avgWage ?? 0) / maxWage) * barAreaW
        const color = PALETTE[i % 5]
        return (
          <g key={s.label}>
            <text x={labelW - 8} y={y + 10} textAnchor="end" fill="#8A98AE" fontSize="10" fontFamily="IBM Plex Mono">{s.label}</text>
            <rect x={labelW} y={y} width={Math.max(bw, 2)} height={18} fill={`url(#wGrad-${i})`} rx="2" />
            <text x={labelW + bw + 8} y={y + 12} fill={color} fontSize="10" fontFamily="IBM Plex Mono" fontWeight="600">${((s.avgWage ?? 0) / 1000).toFixed(0)}K</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function EmployersPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [zipData, setZipData] = useState<ZipData | null>(null)
  const [selectedZip, setSelectedZip] = useState('')
  const [loading, setLoading] = useState(true)
  const [zipLoading, setZipLoading] = useState(false)

  useEffect(() => {
    fetch('/api/employers')
      .then(r => r.json())
      .then(d => { setOverview(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleZipChange(zip: string) {
    setSelectedZip(zip)
    if (!zip) { setZipData(null); return }
    setZipLoading(true)
    fetch(`/api/employers?zip=${zip}`)
      .then(r => r.json())
      .then(d => { setZipData(d); setZipLoading(false) })
      .catch(() => setZipLoading(false))
  }

  const dfw = overview
  const payrollB = dfw ? (dfw.totalPayroll / 1_000_000).toFixed(1) : '—'

  return (
    <>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .zip-select option{background:#13161f;color:#F0F2F7}
      `}</style>
      <div style={{ padding:'40px 32px', maxWidth:'1440px', margin:'0 auto' }}>

        {/* Header */}
        <div className="fade-up" style={{ marginBottom:'36px' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', letterSpacing:'0.2em', color:'#E8B84B', textTransform:'uppercase', marginBottom:'12px' }}>Dashboard · Employers</div>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(36px,4vw,52px)', letterSpacing:'0.05em', lineHeight:0.92, color:'#F0F2F7' }}>Business &<br />Employment</h1>
          <div style={{ width:'48px', height:'2px', background:'linear-gradient(90deg,#E8B84B,rgba(232,184,75,0))', marginTop:'16px' }} />
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#8A98AE', letterSpacing:'0.08em', marginTop:'12px', textTransform:'uppercase' }}>
            Census County Business Patterns 2022 · {loading ? '—' : dfw?.zipCount ?? '—'} DFW ZIPs
          </div>
        </div>

        {/* DFW Metro Cards */}
        <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
          <StatCard label="Total Establishments" value={loading ? '—' : fmtK(dfw?.totalEstab ?? 0)} sub="DFW Metro" color="#E8B84B" loading={loading} />
          <StatCard label="Total Employment" value={loading ? '—' : fmtK(dfw?.totalEmp ?? 0)} sub="CBP 2022" color="#4EAEFF" loading={loading} />
          <StatCard label="Annual Payroll" value={loading ? '—' : `$${payrollB}B`} sub="in $1,000s" color="#2DD4BF" loading={loading} />
          <StatCard label="Avg Annual Wage" value={loading || !dfw?.avgWage ? '—' : fmt$(dfw.avgWage)} sub="payroll ÷ employment" color="#A78BFA" loading={loading} />
        </div>

        {/* DFW Charts */}
        <div className="fade-up-3" style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'16px', marginBottom:'24px' }}>
          <div style={{ background:CARD_BG, border:'1px solid #232940', padding:'24px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>DFW Industry Mix</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'20px' }}>Establishments by sector · all {dfw?.zipCount ?? 370} ZIPs</div>
            {loading
              ? <div style={{ height:'450px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
              : <SectorBarChart sectors={dfw?.sectors ?? []} />
            }
          </div>
          <div style={{ background:CARD_BG, border:'1px solid #232940', padding:'24px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>Top ZIPs by Establishments</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'16px' }}>Highest business density</div>
            {loading
              ? <div style={{ height:'400px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
              : (dfw?.topZips ?? []).map((z, i) => (
                <div key={z.zip} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:'1px solid #1e2b3c' }}>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', width:'16px', textAlign:'right', flexShrink:0 }}>{i + 1}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#E8B84B', flexShrink:0, width:'44px' }}>{z.zip}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#A8B4C5', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{z.name}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#F0F2F7', flexShrink:0 }}>{z.totalEstab.toLocaleString()}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* DFW Avg Wage by Sector */}
        <div className="fade-up-4" style={{ background:CARD_BG, border:'1px solid #232940', padding:'24px', marginBottom:'24px' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>Avg Annual Wage by Sector</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'20px' }}>DFW Metro · Derived from CBP 2022 payroll ÷ employment per sector</div>
          {loading
            ? <div style={{ height:'300px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
            : <WageBarChart sectors={dfw?.sectors ?? []} />
          }
        </div>

        {/* Per-ZIP Drill-down */}
        <div className="fade-up-4" style={{ background:CARD_BG, border:'1px solid #232940', padding:'24px' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'16px' }}>ZIP Code Drill-down</div>

          {/* Selector */}
          <div style={{ marginBottom:'24px', position:'relative', display:'inline-block' }}>
            <select className="zip-select" value={selectedZip} onChange={e => handleZipChange(e.target.value)} style={{
              fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', letterSpacing:'0.06em',
              background:'#13161f', color: selectedZip ? '#F0F2F7' : '#8A98AE',
              border:'1px solid #232940', borderRadius:'4px',
              padding:'10px 40px 10px 14px', cursor:'pointer', outline:'none',
              appearance:'none', WebkitAppearance:'none', minWidth:'280px',
            }}>
              <option value="">Select a ZIP code…</option>
              {ZIP_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.zips.map(z => (
                    <option key={z.zip} value={z.zip}>{z.zip} — {z.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#8A98AE', fontSize:'10px' }}>▼</div>
          </div>

          {!selectedZip && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', color:'#5a6478', padding:'24px 0', letterSpacing:'0.06em' }}>
              Select a ZIP above to see its employer breakdown.
            </div>
          )}

          {selectedZip && zipLoading && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
              {Array.from({length:4}).map((_,i) => (
                <div key={i} style={{ height:'90px', background:'rgba(255,255,255,0.03)', borderRadius:'4px', border:'1px solid #232940', animation:'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          )}

          {zipData && !zipLoading && (
            <>
              {/* ZIP Stat Cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
                <StatCard label="Total Establishments" value={zipData.totalEstab.toLocaleString()} sub={zipData.name} color="#E8B84B" />
                <StatCard label="Large Employers (100+)" value={String(zipData.largeEstab || '—')} sub="establishments" color="#4EAEFF" />
                <StatCard label="Avg Annual Wage" value={zipData.avgWage ? fmt$(zipData.avgWage) : '—'} sub="payroll ÷ employment" color="#2DD4BF" />
                <StatCard
                  label="Top Industry"
                  value={zipData.topSector?.split(' ')[0] ?? '—'}
                  sub={zipData.topSector ?? ''}
                  color="#A78BFA"
                />
              </div>

              {/* Charts row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

                {/* Industry Mix Donut */}
                <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #1e2b3c', borderRadius:'4px', padding:'20px' }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>Industry Mix (Establishments)</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'20px' }}>By sector · {zipData.name}</div>
                  <DonutChart sectors={zipData.sectors} />
                </div>

                {/* Employer Size Distribution */}
                <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #1e2b3c', borderRadius:'4px', padding:'20px' }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>Employer Size Distribution</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'20px' }}>Establishments by employee count band</div>
                  <SizeChart sizeDist={zipData.sizeDist} />
                </div>
              </div>

              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'16px', letterSpacing:'0.06em' }}>
                {zipData.name} · {zipData.sectors.length} active sectors · CBP 2022 · employment at sector level suppressed for privacy
              </div>
            </>
          )}
        </div>

        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'16px', letterSpacing:'0.06em' }}>
          Source: U.S. Census Bureau County Business Patterns 2022 · Named employer data (Top Employers by company) requires Data Axle or similar — Phase 3
        </div>

      </div>
    </>
  )
}
