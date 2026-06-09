'use client'

import { useState, useEffect } from 'react'
import { ZIP_GROUPS } from '@/lib/zips'

interface SectorRow { label: string; estab: number }

interface Overview {
  totalEstab: number
  totalEmp: number
  totalPayroll: number
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
  sectors: SectorRow[]
  population: number | null
  medianHouseholdIncome: number | null
}

const CARD_BG = 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'

// Sector colors — cycle through brand palette
const SECTOR_COLORS = [
  '#4EAEFF','#E8B84B','#2DD4BF','#A78BFA','#FF6B6B',
  '#4EAEFF','#E8B84B','#2DD4BF','#A78BFA','#FF6B6B',
  '#4EAEFF','#E8B84B','#2DD4BF','#A78BFA','#FF6B6B',
  '#4EAEFF','#E8B84B','#2DD4BF','#A78BFA','#FF6B6B',
]

function fmt$(n: number, decimals = 0) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: decimals })
}
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function StatCard({ label, value, sub, color, loading }: {
  label: string; value: string; sub?: string; color: string; loading?: boolean
}) {
  const [hovered, setHov] = useState(false)
  const rgbMap: Record<string, string> = {
    '#E8B84B':'232,184,75','#4EAEFF':'78,174,255',
    '#2DD4BF':'45,212,191','#A78BFA':'167,139,250','#FF6B6B':'255,107,107',
  }
  const rgb = rgbMap[color] ?? '232,184,75'
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hovered
          ? `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.22) 0%,transparent 60%),linear-gradient(145deg,rgba(${rgb},0.08) 0%,rgba(255,255,255,0.01) 100%)`
          : `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.1) 0%,transparent 55%),${CARD_BG}`,
        border: `1px solid ${hovered ? `rgba(${rgb},0.4)` : '#232940'}`,
        borderRadius: '4px', padding: '20px 24px', transition: 'all 0.2s',
      }}
    >
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'10px' }}>{label}</div>
      {loading
        ? <div style={{ height:'36px', width:'60%', background:'rgba(255,255,255,0.05)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
        : <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'40px', letterSpacing:'0.04em', color, lineHeight:1 }}>{value}</div>
      }
      {sub && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#5a6478', marginTop:'8px', letterSpacing:'0.04em' }}>{sub}</div>}
    </div>
  )
}

// Horizontal bar chart — works for both overview (many sectors) and ZIP view
function SectorChart({ sectors, maxBars = 15 }: { sectors: SectorRow[]; maxBars?: number }) {
  const top = sectors.slice(0, maxBars)
  const maxVal = Math.max(...top.map(s => s.estab), 1)
  const rowH = 32
  const labelW = 160
  const barAreaW = 320
  const numW = 60
  const svgW = labelW + barAreaW + numW
  const svgH = top.length * rowH + 24

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow:'visible' }}>
      <defs>
        {top.map((_, i) => (
          <linearGradient key={i} id={`sGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
            <stop offset="100%" stopColor={`${SECTOR_COLORS[i % SECTOR_COLORS.length]}40`} />
          </linearGradient>
        ))}
      </defs>
      {top.map((s, i) => {
        const y = i * rowH + 12
        const bw = (s.estab / maxVal) * barAreaW
        const color = SECTOR_COLORS[i % SECTOR_COLORS.length]
        return (
          <g key={s.label}>
            <text x={labelW - 8} y={y + 9} textAnchor="end" fill="#8A98AE" fontSize="10" fontFamily="IBM Plex Mono">{s.label}</text>
            <rect x={labelW} y={y} width={Math.max(bw, 2)} height={16} fill={`url(#sGrad-${i})`} rx="2" />
            <text x={labelW + bw + 8} y={y + 11} fill={color} fontSize="10" fontFamily="IBM Plex Mono" fontWeight="600">{s.estab.toLocaleString()}</text>
          </g>
        )
      })}
    </svg>
  )
}

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

  const payrollBillions = overview ? (overview.totalPayroll / 1_000_000).toFixed(1) : '—'
  const avgWage = overview && overview.totalEmp > 0
    ? Math.round((overview.totalPayroll * 1000) / overview.totalEmp)
    : null

  const zipEstabPer1k = zipData?.population && zipData.totalEstab
    ? (zipData.totalEstab / zipData.population * 1000).toFixed(1)
    : null
  const zipAvgWage = zipData && zipData.totalEmp > 0
    ? Math.round((zipData.totalPayroll * 1000) / zipData.totalEmp)
    : null

  return (
    <>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .zip-select option{background:#13161f;color:#F0F2F7}
      `}</style>
      <div style={{ padding:'40px 32px', maxWidth:'1440px', margin:'0 auto' }}>

        {/* Header */}
        <div className="fade-up" style={{ marginBottom:'36px' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', letterSpacing:'0.2em', color:'#E8B84B', textTransform:'uppercase', marginBottom:'12px' }}>
            Dashboard · Employers
          </div>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(36px,4vw,52px)', letterSpacing:'0.05em', lineHeight:0.92, color:'#F0F2F7' }}>
            Business &<br />Employment
          </h1>
          <div style={{ width:'48px', height:'2px', background:'linear-gradient(90deg,#E8B84B,rgba(232,184,75,0))', marginTop:'16px' }} />
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#8A98AE', letterSpacing:'0.08em', marginTop:'12px', textTransform:'uppercase' }}>
            Census County Business Patterns 2022 · {loading ? '—' : overview?.zipCount ?? '—'} DFW ZIPs
          </div>
        </div>

        {/* DFW Metro Stat Cards */}
        <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
          <StatCard label="Total Establishments" value={loading ? '—' : fmtK(overview?.totalEstab ?? 0)} sub="DFW Metro" color="#E8B84B" loading={loading} />
          <StatCard label="Total Employment" value={loading ? '—' : fmtK(overview?.totalEmp ?? 0)} sub="CBP 2022" color="#4EAEFF" loading={loading} />
          <StatCard label="Annual Payroll" value={loading ? '—' : `$${payrollBillions}B`} sub="in $1000s × 1000" color="#2DD4BF" loading={loading} />
          <StatCard label="Avg Annual Wage" value={loading || !avgWage ? '—' : fmt$(avgWage)} sub="payroll ÷ employment" color="#A78BFA" loading={loading} />
        </div>

        {/* DFW Industry Mix */}
        <div className="fade-up-3" style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'16px', marginBottom:'24px' }}>
          <div style={{ background:CARD_BG, border:'1px solid #232940', padding:'24px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>DFW Industry Mix</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'20px' }}>Establishments by sector · all {overview?.zipCount ?? 370} ZIPs</div>
            {loading
              ? <div style={{ height:'480px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
              : <SectorChart sectors={overview?.sectors ?? []} maxBars={20} />
            }
          </div>

          {/* Top ZIPs by establishment count */}
          <div style={{ background:CARD_BG, border:'1px solid #232940', padding:'24px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>Top ZIPs by Establishments</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'16px' }}>Highest business density</div>
            {loading
              ? <div style={{ height:'400px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
              : (overview?.topZips ?? []).map((z, i) => (
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

        {/* Per-ZIP Drill-down */}
        <div className="fade-up-4" style={{ background:CARD_BG, border:'1px solid #232940', padding:'24px' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'16px' }}>
            ZIP Code Drill-down
          </div>

          {/* ZIP selector */}
          <div style={{ marginBottom:'24px', position:'relative', display:'inline-block' }}>
            <select
              className="zip-select"
              value={selectedZip}
              onChange={e => handleZipChange(e.target.value)}
              style={{
                fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', letterSpacing:'0.06em',
                background:'#13161f', color: selectedZip ? '#F0F2F7' : '#8A98AE',
                border:'1px solid #232940', borderRadius:'4px',
                padding:'10px 40px 10px 14px', cursor:'pointer', outline:'none',
                appearance:'none', WebkitAppearance:'none', minWidth:'280px',
              }}
            >
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
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
              {Array.from({length:4}).map((_,i) => (
                <div key={i} style={{ height:'90px', background:'rgba(255,255,255,0.03)', borderRadius:'4px', border:'1px solid #232940', animation:'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          )}

          {zipData && !zipLoading && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
                <StatCard label="Establishments" value={zipData.totalEstab.toLocaleString()} sub={zipData.name} color="#E8B84B" />
                <StatCard label="Employment" value={fmtK(zipData.totalEmp)} sub="CBP 2022" color="#4EAEFF" />
                <StatCard label="Annual Payroll" value={fmt$(zipData.totalPayroll * 1000)} sub="in thousands" color="#2DD4BF" />
                <StatCard label="Est / 1K Residents" value={zipEstabPer1k ?? '—'} sub="business density" color="#A78BFA" />
              </div>

              <div style={{ marginBottom:'8px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase' }}>
                {zipData.name} · Industry Breakdown
              </div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'20px' }}>
                {zipData.sectors.length} active sectors · establishments by type
              </div>
              <SectorChart sectors={zipData.sectors} maxBars={zipData.sectors.length} />

              {zipAvgWage && (
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'16px', letterSpacing:'0.06em' }}>
                  Avg annual wage: {fmt$(zipAvgWage)} · {zipData.sectors.length} sectors reported
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'16px', letterSpacing:'0.06em' }}>
          Source: U.S. Census Bureau County Business Patterns 2022 · Employment figures at sector level may be suppressed for privacy · Total employment available at ZIP level
        </div>

      </div>
    </>
  )
}
