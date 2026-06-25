'use client'

import { useState, useEffect, useRef } from 'react'
import { ZIP_GROUPS, CAMPUS_ZIPS } from '@/lib/zips'
import { StatCardAccent as StatCard } from '@/components/ui/StatCardAccent'
import { Surface } from '@/components/ui/Surface'
import { SectionHeader } from '@/components/ui/SectionHeader'

interface SectorRow { label: string; estab: number; avgWage?: number | null }

interface Overview {
  totalEstab: number
  totalEmp: number
  totalPayroll: number
  avgWage: number | null
  zipCount: number
  sectors: SectorRow[]
  sizeDist: { label: string; estab: number }[]
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
  sizeDist: { label: string; estab: number }[]
  population: number | null
  medianHouseholdIncome: number | null
}

const PALETTE = ['#7AA3AA','#D4883A','#F04B28','#7A9E8A','#C45A46']

function fmt$(n: number) { return '$' + n.toLocaleString() }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

// ── CSS Horizontal Bar List ────────────────────────────────────────
// Pure CSS — no SVG scaling issues. Height is always pixel-exact.
function BarList({ rows, formatValue, singleColor }: {
  rows: { label: string; value: number }[]
  formatValue: (v: number) => string
  singleColor?: string
}) {
  const maxVal = Math.max(...rows.map(r => r.value), 1)
  if (!rows.length) return (
    <div style={{ fontFamily:"'Gotham'", fontSize:'11px', color:'#B4A490', padding:'8px 0' }}>
      No data available
    </div>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {rows.map((r, i) => {
        const pct = (r.value / maxVal) * 100
        const color = singleColor ?? PALETTE[i % PALETTE.length]
        return (
          <div key={r.label} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{
              width:'130px', flexShrink:0, textAlign:'right',
              fontFamily:"'Gotham'", fontSize:'10px', color:'#A89A88',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{r.label}</div>
            <div style={{ flex:1, height:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', position:'relative', overflow:'hidden' }}>
              <div style={{
                position:'absolute', left:0, top:0, bottom:0,
                width:`${pct}%`,
                background:`linear-gradient(90deg,${color},${color}50)`,
                borderRadius:'2px',
              }} />
            </div>
            <div style={{
              width:'60px', flexShrink:0, textAlign:'right',
              fontFamily:"'Gotham'", fontSize:'10px', color, fontWeight:'600',
            }}>{formatValue(r.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Donut Chart (per-ZIP) ─────────────────────────────────────────
// totalEstab: the CBP NAICS='00' all-industries total (authoritative). Passed
// separately because the sector-sum double-counts sub-NAICS hierarchy levels.
function DonutChart({ sectors, totalEstab }: { sectors: SectorRow[]; totalEstab?: number }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const top = sectors.slice(0, 8)
  const otherEstab = sectors.slice(8).reduce((s, x) => s + x.estab, 0)
  const slices = otherEstab > 0 ? [...top, { label: 'Other', estab: otherEstab }] : top
  const total = slices.reduce((s, x) => s + x.estab, 0)
  const displayTotal = totalEstab ?? total
  if (total === 0) return <div style={{ color:'#B4A490', fontFamily:"'Gotham'", fontSize:'11px' }}>No data</div>

  const cx = 110, cy = 110, r = 84, inner = 54
  let angle = -Math.PI / 2
  const donutPalette = ['#7AA3AA','#D4883A','#F04B28','#7A9E8A','#C45A46','#7AA3AA88','#D4883A88','#F04B2888','#7A9E8A88']
  const paths = slices.map((s, i) => {
    const sweep = (s.estab / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    const xi1 = cx + inner * Math.cos(angle - sweep), yi1 = cy + inner * Math.sin(angle - sweep)
    const xi2 = cx + inner * Math.cos(angle), yi2 = cy + inner * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const color = donutPalette[i % donutPalette.length]
    return { d:`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${inner},${inner} 0 ${large},0 ${xi1},${yi1} Z`, color, label:s.label, estab:s.estab, pct:Math.round(s.estab/total*100), i }
  })

  const hov = hovered !== null ? paths[hovered] : null
  return (
    <div style={{ display:'flex', gap:'24px', alignItems:'center' }}>
      <svg width="220" height="220" style={{ flexShrink:0 }}>
        {paths.map(p => (
          <path key={p.i} d={p.d} fill={p.color}
            opacity={hovered === null || hovered === p.i ? 1 : 0.35}
            style={{ cursor:'pointer', transition:'opacity 0.15s' }}
            onMouseEnter={() => setHovered(p.i)} onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#FFFFFF" fontSize="20" fontFamily="Gotham" letterSpacing="0.05em">
          {hov ? hov.pct + '%' : displayTotal.toLocaleString()}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#A89A88" fontSize="9" fontFamily="Gotham">
          {hov ? hov.label.slice(0,14) : 'establishments'}
        </text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1 }}>
        {paths.map((p, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'7px', opacity:hovered===null||hovered===i?1:0.35, transition:'opacity 0.15s', cursor:'default' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div style={{ width:'7px', height:'7px', borderRadius:'2px', background:p.color, flexShrink:0 }} />
            <span style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#C8BCA8', flex:1 }}>{p.label}</span>
            <span style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490' }}>{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Employer Size Chart (per-ZIP) ─────────────────────────────────
function SizeChart({ sizeDist }: { sizeDist: { label: string; estab: number }[] }) {
  if (!sizeDist.length) return <div style={{ color:'#B4A490', fontFamily:"'Gotham'", fontSize:'11px' }}>No size data</div>
  const maxVal = Math.max(...sizeDist.map(s => s.estab), 1)
  const barW = 44, gap = 10, padLeft = 4, padTop = 22, chartH = 140
  const svgW = padLeft + sizeDist.length * (barW + gap)
  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${chartH + 48}`} style={{ overflow:'visible', maxHeight:'220px' }}>
      <defs>
        {sizeDist.map((_, i) => (
          <linearGradient key={i} id={`szG-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} />
            <stop offset="100%" stopColor={`${PALETTE[i % PALETTE.length]}40`} />
          </linearGradient>
        ))}
      </defs>
      {sizeDist.map((s, i) => {
        const x = padLeft + i * (barW + gap)
        const bh = (s.estab / maxVal) * chartH
        const y = padTop + chartH - bh
        const color = PALETTE[i % PALETTE.length]
        return (
          <g key={s.label}>
            <rect x={x} y={y} width={barW} height={bh} fill={`url(#szG-${i})`} rx="2" />
            <text x={x+barW/2} y={y-4} textAnchor="middle" fill={color} fontSize="9" fontFamily="Gotham" fontWeight="600">{s.estab}</text>
            <text x={x+barW/2} y={padTop+chartH+14} textAnchor="middle" fill="#A89A88" fontSize="8" fontFamily="Gotham">{s.label}</text>
            <text x={x+barW/2} y={padTop+chartH+25} textAnchor="middle" fill="#B4A490" fontSize="7" fontFamily="Gotham">emp</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Top Employers (named) — labeled placeholder ───────────────────
// Census CBP is anonymized aggregate data and cannot name individual
// businesses. Named-employer data needs a licensed source (Data Axle) or
// on-demand Google Places. Kept as a visible slot until that lands (Phase 3).
function TopEmployersPlaceholder({ scope }: { scope: string }) {
  return (
    <Surface padding="20px" style={{ marginBottom: '12px' }}>
      <SectionHeader title="Top Employers in Area" sub={scope} marginBottom="12px" />
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '16px', background: 'rgba(255,255,255,0.02)',
        border: '1px dashed #2a3350', borderRadius: '4px',
      }}>
        <div style={{ fontFamily: "'Gotham'", fontSize: '11px', color: '#A89A88', lineHeight: 1.7 }}>
          Company-level employer names aren&apos;t available from anonymized Census CBP (it reports establishment
          counts by sector &amp; size band only). Reinstating the named top-employer list needs a licensed business
          directory (Data Axle) or an on-demand Google Places lookup — <span style={{ color: '#B4A490' }}>pending Phase 3</span>.
        </div>
      </div>
    </Surface>
  )
}

// ── Campus Dot ────────────────────────────────────────────────────
function CampusDot({ status, size = 8 }: { status: 'existing' | 'soon'; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background: status === 'existing' ? '#F04B28' : 'transparent',
      border: status === 'soon' ? '1.5px solid #F04B28' : 'none',
      boxShadow: status === 'existing' ? '0 0 5px rgba(240,75,40,0.5)' : 'none',
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

  const selected = value ? ZIP_GROUPS.flatMap(g => g.zips).find(z => z.zip === value) : null
  const selectedCampus = value ? CAMPUS_ZIPS[value] : undefined

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block', background:'#3C3C3C', borderRadius:'4px', zIndex:10 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        WebkitAppearance:'none', appearance:'none', backgroundColor:'#3C3C3C',
        border:`1px solid ${open ? '#F04B28' : '#4A4A4A'}`, color:'#FFFFFF',
        padding:'9px 36px 9px 14px', fontFamily:"'Gotham'", fontSize:'13px',
        letterSpacing:'0.04em', cursor:'pointer', outline:'none', minWidth:'240px',
        position:'relative', textAlign:'left', transition:'border-color 0.15s ease', borderRadius:'4px',
        display:'flex', alignItems:'center', gap:'8px',
      }}>
        {selectedCampus && <CampusDot status={selectedCampus} size={7} />}
        <span style={{ flex:1 }}>{selected ? `${value} — ${selected.label}` : 'DFW Metro Overview'}</span>
        <svg width="12" height="7" viewBox="0 0 12 7" fill="none" style={{
          position:'absolute', right:'12px', top:'50%',
          transform:`translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition:'transform 0.15s ease',
        }}>
          <path d="M1 1l5 5 5-5" stroke="#F04B28" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', right:0,
          minWidth:'240px', maxHeight:'360px', overflowY:'auto',
          background:'#323232', border:'1px solid #4A4A4A',
          zIndex:200, boxShadow:'0 8px 32px rgba(0,0,0,0.7)',
        }}>
          <div onClick={() => { onChange(''); setOpen(false) }}
            onMouseEnter={() => setHovered('__metro')} onMouseLeave={() => setHovered(null)}
            style={{
              padding:'10px 14px', fontFamily:"'Gotham'", fontSize:'12px',
              color: value==='' ? '#F04B28' : hovered==='__metro' ? '#FFFFFF' : '#C8BCA8',
              background: value==='' ? 'rgba(240,75,40,0.08)' : hovered==='__metro' ? 'rgba(255,255,255,0.04)' : 'transparent',
              cursor:'pointer', letterSpacing:'0.04em', borderBottom:'1px solid #424242',
            }}>DFW Metro Overview</div>
          {ZIP_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490',
                letterSpacing:'0.15em', textTransform:'uppercase', padding:'10px 14px 4px',
                position:'sticky', top:0, background:'#323232', zIndex:1,
              }}>{group.label}</div>
              {group.zips.map(({ zip, label }) => {
                const isSelected = zip === value, isHov = hovered === zip
                const campus = CAMPUS_ZIPS[zip]
                return (
                  <div key={zip}
                    onClick={() => { onChange(zip); setOpen(false) }}
                    onMouseEnter={() => setHovered(zip)} onMouseLeave={() => setHovered(null)}
                    style={{
                      padding:'7px 14px', fontFamily:"'Gotham'", fontSize:'12px',
                      color: isSelected ? '#F04B28' : isHov ? '#FFFFFF' : '#C8BCA8',
                      background: isSelected ? 'rgba(240,75,40,0.08)' : isHov ? 'rgba(255,255,255,0.04)' : 'transparent',
                      cursor:'pointer', letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:'8px',
                    }}>
                    <span style={{ color: isSelected ? '#F04B28' : '#B4A490', flexShrink:0, width:'38px' }}>{zip}</span>
                    {campus && <CampusDot status={campus} size={7} />}
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

// ── Page ──────────────────────────────────────────────────────────
export default function EmployersPage() {
  const [selectedZip, setSelectedZip] = useState('')
  const [overview, setOverview]       = useState<Overview | null>(null)
  const [zipData, setZipData]         = useState<ZipData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [zipLoading, setZipLoading]   = useState(false)

  useEffect(() => {
    fetch('/api/employers')
      .then(r => r.json())
      .then(d => { setOverview(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedZip) { setZipData(null); return }
    setZipLoading(true)
    fetch(`/api/employers?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { setZipData(d); setZipLoading(false) })
      .catch(() => setZipLoading(false))
  }, [selectedZip])

  const dfw = overview
  const payrollB = dfw ? (dfw.totalPayroll / 1_000_000).toFixed(1) : '—'

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ padding:'32px 32px', maxWidth:'1440px', margin:'0 auto' }}>

        {/* Header */}
        <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px', gap:'24px', position:'relative', zIndex:20 }}>
          <div>
            <div style={{ fontFamily:"'Gotham'", fontSize:'11px', letterSpacing:'0.2em', color:'#F04B28', textTransform:'uppercase', marginBottom:'10px' }}>Dashboard · Employers</div>
            <h1 style={{ fontWeight: 900, fontFamily:"'Gotham',sans-serif", fontSize:'clamp(32px,3.5vw,48px)', letterSpacing:'0.05em', lineHeight:0.92, color:'#FFFFFF' }}>Business &<br />Employment</h1>
            <div style={{ width:'40px', height:'2px', background:'linear-gradient(90deg,#F04B28,rgba(240,75,40,0))', marginTop:'12px' }} />
            <div style={{ fontFamily:"'Gotham'", fontSize:'11px', color:'#A89A88', letterSpacing:'0.08em', marginTop:'10px', textTransform:'uppercase' }}>
              Census CBP 2022 · {loading ? '—' : dfw?.zipCount ?? '—'} DFW ZIPs
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:"'Gotham'", fontSize:'11px', color:'#A89A88', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px' }}>
              Select ZIP Code
            </div>
            <ZipDropdown value={selectedZip} onChange={setSelectedZip} />
          </div>
        </div>

        {/* ── DFW Metro Overview ── */}
        {!selectedZip && (
          <>
            {/* Stat cards */}
            <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
              <StatCard label="Total Establishments" value={loading ? '—' : fmtK(dfw?.totalEstab ?? 0)} sub="DFW Metro"             accent="gold"   loading={loading} />
              <StatCard label="Total Employment"     value={loading ? '—' : fmtK(dfw?.totalEmp ?? 0)}   sub="CBP 2022"              accent="blue"   loading={loading} />
              <StatCard label="Annual Payroll"       value={loading ? '—' : `$${payrollB}B`}             sub="in $1,000s"             accent="teal"   loading={loading} />
              <StatCard label="Avg Annual Wage"      value={loading || !dfw?.avgWage ? '—' : fmt$(dfw.avgWage)} sub="payroll ÷ employment" accent="purple" loading={loading} />
            </div>

            {/* Industry Mix (donut) + Size Distribution — mirrors the per-ZIP view */}
            <div className="fade-up-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>

              {/* Industry Mix — donut */}
              <Surface padding="20px">
                <SectionHeader title="DFW Industry Mix" sub="Establishments by sector" marginBottom="14px" />
                {loading
                  ? <div style={{ height:'220px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
                  : <DonutChart sectors={dfw?.sectors ?? []} totalEstab={dfw?.totalEstab} />
                }
              </Surface>

              {/* Employer Size Distribution */}
              <Surface padding="20px">
                <SectionHeader title="Employer Size Distribution" sub="DFW Metro · establishments by employee-count band" marginBottom="14px" />
                {loading
                  ? <div style={{ height:'220px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
                  : <SizeChart sizeDist={dfw?.sizeDist ?? []} />
                }
              </Surface>
            </div>

            {/* Avg Wage by Sector — full width */}
            <Surface className="fade-up-3" padding="20px" style={{ marginBottom:'12px' }}>
              <SectionHeader title="Avg Annual Wage by Sector" sub="DFW Metro · county-level CBP (Dallas / Tarrant / Collin / Denton)" marginBottom="14px" />
              {loading
                ? <div style={{ height:'220px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
                : (() => {
                    const wageRows = (dfw?.sectors ?? []).filter(s => s.avgWage != null).map(s => ({ label: s.label, value: s.avgWage! })).sort((a,b) => b.value - a.value)
                    return wageRows.length
                      ? <BarList rows={wageRows} formatValue={v => `$${(v/1000).toFixed(0)}K`} singleColor="#7AA3AA" />
                      : <div style={{ fontFamily:"'Gotham'", fontSize:'11px', color:'#B4A490', padding:'8px 0' }}>Available after next /api/refresh run</div>
                  })()
              }
            </Surface>

            {/* Top ZIPs — compact table */}
            <Surface className="fade-up-4" padding="16px 20px" style={{ marginBottom:'16px' }}>
              <SectionHeader title="Top ZIPs by Establishments" marginBottom="12px" />
              {loading
                ? <div style={{ height:'60px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
                : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'6px' }}>
                    {(dfw?.topZips ?? []).slice(0,10).map((z, i) => (
                      <div key={z.zip} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', background:'rgba(255,255,255,0.02)', border:'1px solid #424242', borderRadius:'3px' }}>
                        <span style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490', flexShrink:0, width:'12px' }}>{i+1}</span>
                        <span style={{ fontFamily:"'Gotham'", fontSize:'11px', color:'#F04B28', flexShrink:0 }}>{z.zip}</span>
                        <span style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#C8BCA8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{z.name}</span>
                        <span style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#FFFFFF', flexShrink:0 }}>{z.totalEstab.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </Surface>

            {/* Top Employers — named (labeled placeholder) */}
            <TopEmployersPlaceholder scope="DFW Metro · all coverage ZIPs" />
          </>
        )}

        {/* ── Per-ZIP View ── */}
        {selectedZip && (
          <>
            {zipLoading && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
                {Array.from({length:4}).map((_,i) => (
                  <div key={i} style={{ height:'88px', background:'rgba(255,255,255,0.03)', borderRadius:'4px', border:'1px solid #4A4A4A', animation:'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            )}

            {zipData && !zipLoading && (
              <>
                <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
                  <StatCard label="Total Establishments"  value={zipData.totalEstab.toLocaleString()} sub={zipData.name}                     accent="gold"   />
                  <StatCard label="Large Employers (100+)" value={String(zipData.largeEstab || '—')} sub="100+ employee firms"               accent="blue"   />
                  <StatCard label="Avg Annual Wage"        value={zipData.avgWage ? fmt$(zipData.avgWage) : '—'} sub="payroll ÷ employment"  accent="teal"   />
                  <StatCard label="Top Sector"             value={zipData.topSector?.split(' ')[0] ?? '—'} sub={zipData.topSector ?? 'by estab count'} accent="purple" />
                </div>

                <div className="fade-up-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #424242', borderRadius:'4px', padding:'18px' }}>
                    <div style={{ fontFamily:"'Gotham'", fontSize:'10px', letterSpacing:'0.14em', color:'#A89A88', textTransform:'uppercase', marginBottom:'3px' }}>Industry Mix</div>
                    <div style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490', marginBottom:'14px' }}>Establishments by sector · {zipData.name}</div>
                    <DonutChart sectors={zipData.sectors} totalEstab={zipData.totalEstab} />
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #424242', borderRadius:'4px', padding:'18px' }}>
                    <div style={{ fontFamily:"'Gotham'", fontSize:'10px', letterSpacing:'0.14em', color:'#A89A88', textTransform:'uppercase', marginBottom:'3px' }}>Employer Size Distribution</div>
                    <div style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490', marginBottom:'14px' }}>Establishments by employee count band</div>
                    <SizeChart sizeDist={zipData.sizeDist} />
                  </div>
                </div>

                {zipData.sectorWages?.length > 0 && (
                  <div className="fade-up-4" style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #424242', borderRadius:'4px', padding:'18px', marginBottom:'12px' }}>
                    <div style={{ fontFamily:"'Gotham'", fontSize:'10px', letterSpacing:'0.14em', color:'#A89A88', textTransform:'uppercase', marginBottom:'3px' }}>Sector Wages</div>
                    <div style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490', marginBottom:'14px' }}>Avg annual wage by sector · {zipData.name} · CBP 2022 (where not suppressed)</div>
                    <BarList rows={zipData.sectorWages.map(w => ({ label: w.label, value: w.avgWage }))} formatValue={v => `$${(v/1000).toFixed(0)}K`} singleColor="#7AA3AA" />
                  </div>
                )}

                {/* Top Employers — named (labeled placeholder) */}
                <TopEmployersPlaceholder scope={zipData.name} />

                <div style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490', letterSpacing:'0.06em' }}>
                  {zipData.name} · {zipData.sectors.length} active sectors · CBP 2022 · per-sector employment suppressed for privacy in most ZIPs
                </div>
              </>
            )}
          </>
        )}

        <div style={{ fontFamily:"'Gotham'", fontSize:'10px', color:'#B4A490', marginTop:'16px', letterSpacing:'0.06em' }}>
          Source: U.S. Census Bureau County Business Patterns 2022 · establishment, employment &amp; payroll aggregates (anonymized; no company-level names)
        </div>

      </div>
    </>
  )
}
