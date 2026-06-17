'use client'

import { useState, useEffect, useMemo } from 'react'
import { downloadCsv } from '@/lib/csv'
import { ZIP_GROUPS, DFW_ZIPS, CORE_MSA_ZIPS } from '@/lib/zips'
import { StatCard } from '@/components/ui/StatCard'
import { Surface } from '@/components/ui/Surface'
import { SectionHeader } from '@/components/ui/SectionHeader'

interface ZipHealth {
  zip: string
  name: string
  diabetes: number | null
  obesity: number | null
  uninsured: number | null
  depression: number | null
  mentalDistress: number | null
  cfpbComplaints: number | null
  population: number | null
}

interface Overview {
  zipCount: number
  avgDiabetes: number | null
  avgObesity: number | null
  avgSmoking: number | null
  avgUninsured: number | null
  avgHighBP: number | null
  avgDepression: number | null
  avgMentalDistress: number | null
  avgPhysInactivity: number | null
  avgGenPoorHealth: number | null
  totalComplaints: number
  complaintsPer1k: number | null
  zips: ZipHealth[]
}

interface ZipData {
  zip: string
  name: string
  diabetes: number | null
  obesity: number | null
  smoking: number | null
  uninsured: number | null
  highBloodPressure: number | null
  depression: number | null
  mentalDistress: number | null
  physInactivity: number | null
  genPoorHealth: number | null
  cfpbComplaints: number | null
  cfpbPer1k: number | null
  population: number | null
  sesLabel: string | null
}

function fmtPct(n: number | null) { return n != null ? n.toFixed(1) + '%' : '—' }
function fmtN(n: number | null) { return n != null ? n.toLocaleString() : '—' }

// Color thresholds — higher = worse for most health metrics
function healthColor(val: number | null, warn: number, danger: number): string {
  if (val == null) return '#8A98AE'
  if (val >= danger) return '#FF6B6B'
  if (val >= warn)   return '#E8B84B'
  return '#2DD4BF'
}

// ── Health Metric Row (horizontal fill bar) ────────────────────────
function MetricRow({ label, value, warn, danger, benchmark, unit = '%' }: {
  label: string; value: number | null; warn: number; danger: number; benchmark?: number; unit?: string
}) {
  const color = healthColor(value, warn, danger)
  const pct = value != null ? Math.min(value / danger * 100, 100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'9px 0', borderBottom:'1px solid #1e2b3c' }}>
      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#A8B4C5', flex:1 }}>{label}</span>
      <div style={{ width:'120px', height:'4px', background:'#1e2b3c', borderRadius:'2px', flexShrink:0 }}>
        <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${color},${color}80)`, borderRadius:'2px', transition:'width 0.4s ease' }} />
      </div>
      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', color, width:'44px', textAlign:'right', flexShrink:0 }}>
        {value != null ? value.toFixed(1) + unit : '—'}
      </span>
      {benchmark != null && (
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', width:'52px', textAlign:'right', flexShrink:0 }}>
          DFW: {benchmark.toFixed(1)}{unit}
        </span>
      )}
    </div>
  )
}

// ── Radar-style comparison bars for ZIP vs DFW avg ─────────────────
function ComparisonChart({ zipData, overview }: { zipData: ZipData; overview: Overview }) {
  const metrics = [
    { label: 'Diabetes',          zip: zipData.diabetes,       dfw: overview.avgDiabetes,       warn: 10, danger: 14 },
    { label: 'Obesity',           zip: zipData.obesity,        dfw: overview.avgObesity,         warn: 33, danger: 40 },
    { label: 'Smoking',           zip: zipData.smoking,        dfw: overview.avgSmoking,         warn: 12, danger: 18 },
    { label: 'Uninsured',         zip: zipData.uninsured,      dfw: overview.avgUninsured,       warn: 12, danger: 20 },
    { label: 'High Blood Pressure', zip: zipData.highBloodPressure, dfw: overview.avgHighBP,     warn: 32, danger: 38 },
    { label: 'Depression',        zip: zipData.depression,     dfw: overview.avgDepression,      warn: 22, danger: 28 },
    { label: 'Mental Distress',   zip: zipData.mentalDistress, dfw: overview.avgMentalDistress,  warn: 15, danger: 20 },
    { label: 'Physical Inactivity', zip: zipData.physInactivity, dfw: overview.avgPhysInactivity, warn: 22, danger: 30 },
    { label: 'Poor Health',       zip: zipData.genPoorHealth,  dfw: overview.avgGenPoorHealth,   warn: 14, danger: 20 },
  ]
  return (
    <div>
      {metrics.map(m => (
        <MetricRow key={m.label} label={m.label} value={m.zip} warn={m.warn} danger={m.danger} benchmark={m.dfw ?? undefined} />
      ))}
    </div>
  )
}

// ── Sortable ZIP table ─────────────────────────────────────────────
type SortKey = 'diabetes' | 'obesity' | 'uninsured' | 'depression' | 'mentalDistress' | 'cfpbComplaints'

function ZipTable({ zips }: { zips: ZipHealth[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('diabetes')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const sorted = useMemo(() => [...zips].sort((a, b) => {
    const va = a[sortKey] ?? -1
    const vb = b[sortKey] ?? -1
    return sortDir === 'desc' ? vb - va : va - vb
  }), [zips, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const cols: { label: string; key: SortKey; warn: number; danger: number }[] = [
    { label: 'Diabetes %',     key: 'diabetes',       warn: 10, danger: 14 },
    { label: 'Obesity %',      key: 'obesity',        warn: 33, danger: 40 },
    { label: 'Uninsured %',    key: 'uninsured',      warn: 12, danger: 20 },
    { label: 'Depression %',   key: 'depression',     warn: 22, danger: 28 },
    { label: 'Mental Dist %',  key: 'mentalDistress', warn: 15, danger: 20 },
    { label: 'Complaints',     key: 'cfpbComplaints', warn: 500, danger: 1500 },
  ]

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'8px' }}>
        <button
          onClick={() => downloadCsv('lakepointe-community-health.csv',
            ['ZIP', 'Area', 'Diabetes %', 'Obesity %', 'Uninsured %', 'Depression %', 'Mental Distress %', 'CFPB Complaints', 'Population'],
            sorted.map(z => [z.zip, z.name, z.diabetes, z.obesity, z.uninsured, z.depression, z.mentalDistress, z.cfpbComplaints, z.population])
          )}
          style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', padding:'5px 12px', borderRadius:'3px', cursor:'pointer', border:'1px solid #232940', background:'transparent', color:'#8A98AE' }}
        >↓ CSV</button>
      </div>
    <div style={{ maxHeight:'320px', overflowY:'auto', overflowX:'auto', scrollbarGutter:'stable' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead style={{ position:'sticky', top:0, background:'#13161f', zIndex:1 }}>
          <tr>
            <th style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.1em', color:'#8A98AE', textTransform:'uppercase', textAlign:'left', padding:'0 16px 12px 0', borderBottom:'1px solid #232940', whiteSpace:'nowrap' }}>ZIP</th>
            <th style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.1em', color:'#8A98AE', textTransform:'uppercase', textAlign:'left', padding:'0 16px 12px 0', borderBottom:'1px solid #232940', whiteSpace:'nowrap' }}>Area</th>
            {cols.map((c, ci) => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={{
                fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.1em',
                color: sortKey === c.key ? '#E8B84B' : '#8A98AE',
                textTransform:'uppercase', textAlign:'right',
                padding: ci === cols.length - 1 ? '0 20px 12px 16px' : '0 0 12px 16px',
                borderBottom:'1px solid #232940', whiteSpace:'nowrap', cursor:'pointer',
              }}>
                {c.label}{sortKey === c.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(z => (
            <tr key={z.zip} style={{ borderBottom:'1px solid #1e2b3c' }}>
              <td style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', color:'#F0F2F7', padding:'10px 16px 10px 0', whiteSpace:'nowrap' }}>{z.zip}</td>
              <td style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#A8B4C5', padding:'10px 16px 10px 0', whiteSpace:'nowrap' }}>{z.name}</td>
              {cols.map((c, ci) => {
                const val = z[c.key] as number | null
                const color = healthColor(val, c.warn, c.danger)
                return (
                  <td key={c.key} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', color, padding: ci === cols.length - 1 ? '10px 20px 10px 16px' : '10px 0 10px 16px', textAlign:'right', whiteSpace:'nowrap' }}>
                    {c.key === 'cfpbComplaints' ? fmtN(val) : fmtPct(val)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'12px' }}>
        {zips.length} ZIPs · Color: teal = below avg, gold = elevated, red = high · Click headers to sort
      </div>
    </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function CommunityNeedsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [zipData, setZipData] = useState<ZipData | null>(null)
  const [selectedZip, setSelectedZip] = useState('')
  const [loading, setLoading] = useState(true)
  const [zipLoading, setZipLoading] = useState(false)
  const [coverage, setCoverage] = useState<'core' | 'all'>('core')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('coverage') === 'all') setCoverage('all')
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/community-needs?coverage=${coverage}`)
      .then(r => r.json())
      .then(d => { setOverview(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [coverage, refreshKey])

  function handleCoverageChange(val: 'core' | 'all') {
    setCoverage(val)
    const url = new URL(window.location.href)
    val === 'all' ? url.searchParams.set('coverage', 'all') : url.searchParams.delete('coverage')
    window.history.replaceState(null, '', url.toString())
  }

  function handleZipChange(zip: string) {
    setSelectedZip(zip)
    if (!zip) { setZipData(null); return }
    setZipLoading(true)
    fetch(`/api/community-needs?zip=${zip}`)
      .then(r => r.json())
      .then(d => { setZipData(d); setZipLoading(false) })
      .catch(() => setZipLoading(false))
  }

  return (
    <>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .zip-select option{background:#13161f;color:#F0F2F7}
        .cn-row:hover{background:rgba(255,255,255,0.02)}
      `}</style>
      <div style={{ padding:'40px 32px', maxWidth:'1440px', margin:'0 auto' }}>

        {/* Header */}
        <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'36px' }}>
          <div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', letterSpacing:'0.2em', color:'#E8B84B', textTransform:'uppercase', marginBottom:'12px' }}>Dashboard · Community Needs</div>
            <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(36px,4vw,52px)', letterSpacing:'0.05em', lineHeight:0.92, color:'#F0F2F7' }}>Community<br />Health & Needs</h1>
            <div style={{ width:'48px', height:'2px', background:'linear-gradient(90deg,#E8B84B,rgba(232,184,75,0))', marginTop:'16px' }} />
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#8A98AE', letterSpacing:'0.08em', marginTop:'12px', textTransform:'uppercase' }}>
              CDC PLACES 2023 · CFPB Consumer Complaints · {overview?.zipCount ?? DFW_ZIPS.length} DFW ZIPs
            </div>
          </div>
          {/* Coverage + Refresh controls */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0, marginTop:'4px' }}>
            <select
              value={coverage}
              onChange={e => handleCoverageChange(e.target.value as 'core' | 'all')}
              style={{
                fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', letterSpacing:'0.06em',
                background:'#13161f', color:'#C8D4E4',
                border:'1px solid #232940', borderRadius:'4px',
                padding:'6px 10px', cursor:'pointer', outline:'none',
                appearance:'none' as const, WebkitAppearance:'none' as const,
              }}
            >
              <option value="core">Core MSA · 11 counties</option>
              <option value="all">All ZIPs · Full coverage</option>
            </select>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              title="Refresh data from database"
              style={{
                fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', letterSpacing:'0.06em',
                background:'transparent', color:'#8A98AE',
                border:'1px solid #232940', borderRadius:'4px',
                padding:'6px 10px', cursor:'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#C8D4E4'; e.currentTarget.style.borderColor = '#4EAEFF' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8A98AE'; e.currentTarget.style.borderColor = '#232940' }}
            >
              ↺ Reload
            </button>
          </div>
        </div>

        {/* DFW Overview Cards */}
        <div className="fade-up-2" style={{ marginBottom:'16px', paddingBottom:'16px', borderBottom:'1px solid #232940' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'28px', letterSpacing:'0.08em', color:'#F0F2F7', lineHeight:1, marginBottom:'6px' }}>{coverage === 'core' ? 'DFW Core MSA' : 'DFW Metro (All)'} Averages</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#8A98AE', letterSpacing:'0.08em' }}>Across {overview?.zipCount ?? (coverage === 'core' ? CORE_MSA_ZIPS.length : DFW_ZIPS.length)} ZIP codes{coverage === 'core' ? ' · Core MSA (11 counties)' : ' · Full coverage area'} · CDC PLACES 2023</div>
        </div>
        <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
          <StatCard label="Avg Diabetes Rate" value={loading ? '—' : fmtPct(overview?.avgDiabetes ?? null)} sub="% adults diagnosed" color="#FF6B6B" loading={loading} />
          <StatCard label="Avg Obesity Rate"  value={loading ? '—' : fmtPct(overview?.avgObesity ?? null)}  sub="% adults" color="#E8B84B" loading={loading} />
          <StatCard label="Avg Uninsured"     value={loading ? '—' : fmtPct(overview?.avgUninsured ?? null)} sub="% without coverage" color="#4EAEFF" loading={loading} />
          <StatCard label="Avg Depression"    value={loading ? '—' : fmtPct(overview?.avgDepression ?? null)} sub="% adults" color="#A78BFA" loading={loading} />
        </div>

        {/* Second row of cards */}
        <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
          <StatCard label="Avg Smoking"        value={loading ? '—' : fmtPct(overview?.avgSmoking ?? null)}       sub="current cigarette use" color="#FF6B6B" loading={loading} />
          <StatCard label="Avg Mental Distress" value={loading ? '—' : fmtPct(overview?.avgMentalDistress ?? null)} sub="frequent bad mental health days" color="#A78BFA" loading={loading} />
          <StatCard label="Avg High Blood Pressure" value={loading ? '—' : fmtPct(overview?.avgHighBP ?? null)}   sub="% adults" color="#E8B84B" loading={loading} />
          <StatCard label="CFPB Complaints"    value={loading ? '—' : fmtN(overview?.totalComplaints ?? null)}    sub={overview?.complaintsPer1k != null ? `${overview.complaintsPer1k}/1K residents` : undefined} color="#4EAEFF" loading={loading} />
        </div>

        {/* ZIP Rankings Table */}
        <Surface className="fade-up-3" style={{ marginBottom:'24px' }}>
          <SectionHeader title="ZIP Rankings by Health Indicator" sub="All ZIPs · scroll to explore · sort by column to find highest-need areas" marginBottom="20px" />
          {loading
            ? <div style={{ height:'300px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
            : overview?.zips?.length
              ? <ZipTable zips={overview.zips} />
              : <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', color:'#5a6478', padding:'24px 0' }}>No data yet — run the PLACES import script to populate.</div>
          }
        </Surface>

        {/* Per-ZIP Drill-down */}
        <Surface className="fade-up-4">
          <SectionHeader title="ZIP Code Health Profile" />

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
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', color:'#5a6478', padding:'24px 0' }}>
              Select a ZIP to see its full health profile compared to the DFW average.
            </div>
          )}

          {selectedZip && zipLoading && (
            <div style={{ height:'300px', background:'rgba(255,255,255,0.03)', borderRadius:'2px', animation:'pulse 1.5s ease-in-out infinite' }} />
          )}

          {zipData && !zipLoading && overview && (
            <>
              {/* ZIP stat cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
                <StatCard label="Diabetes" value={fmtPct(zipData.diabetes)} sub="% adults diagnosed" color={healthColor(zipData.diabetes, 10, 14)} />
                <StatCard label="Obesity"  value={fmtPct(zipData.obesity)}  sub="% adults" color={healthColor(zipData.obesity, 33, 40)} />
                <StatCard label="Uninsured" value={fmtPct(zipData.uninsured)} sub="% without coverage" color={healthColor(zipData.uninsured, 12, 20)} />
                <StatCard label="Depression" value={fmtPct(zipData.depression)} sub="% adults" color={healthColor(zipData.depression, 22, 28)} />
              </div>

              {/* Metric comparison vs DFW avg */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #1e2b3c', borderRadius:'4px', padding:'20px' }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>Health Metrics vs DFW Avg</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'16px' }}>{zipData.name} · % of adults</div>
                  <ComparisonChart zipData={zipData} overview={overview} />
                </div>

                <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #1e2b3c', borderRadius:'4px', padding:'20px' }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.14em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'4px' }}>Financial Stress Indicators</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#5a6478', letterSpacing:'0.08em', marginBottom:'16px' }}>{zipData.name}</div>

                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    <div style={{ background:'#0d0f14', border:'1px solid #1e2b3c', borderRadius:'4px', padding:'16px' }}>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', letterSpacing:'0.1em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'6px' }}>CFPB Consumer Complaints</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'32px', color: healthColor(zipData.cfpbComplaints, 500, 1500), lineHeight:1 }}>{fmtN(zipData.cfpbComplaints)}</div>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'4px' }}>trailing 36 mo · {zipData.cfpbPer1k != null ? zipData.cfpbPer1k + '/1K residents' : ''}</div>
                    </div>

                    <div style={{ background:'#0d0f14', border:'1px solid #1e2b3c', borderRadius:'4px', padding:'16px' }}>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', letterSpacing:'0.1em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'6px' }}>Physical Inactivity</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'32px', color: healthColor(zipData.physInactivity, 22, 30), lineHeight:1 }}>{fmtPct(zipData.physInactivity)}</div>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'4px' }}>% adults · DFW avg: {fmtPct(overview.avgPhysInactivity)}</div>
                    </div>

                    <div style={{ background:'#0d0f14', border:'1px solid #1e2b3c', borderRadius:'4px', padding:'16px' }}>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', letterSpacing:'0.1em', color:'#8A98AE', textTransform:'uppercase', marginBottom:'6px' }}>SES Class</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'32px', color:'#E8B84B', lineHeight:1 }}>{zipData.sesLabel ?? '—'}</div>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'4px' }}>socioeconomic tier</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </Surface>

        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'16px', letterSpacing:'0.06em' }}>
          Health data: CDC PLACES 2023 (age-adjusted prevalence estimates) · Complaints: CFPB Consumer Complaint Database (trailing 36 months) · HMDA mortgage denial rates — Phase 2
        </div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#3d4a5c', marginTop:'6px', letterSpacing:'0.06em' }}>
          Census data is reported by ZCTA (ZIP Code Tabulation Area), which approximates but does not exactly match USPS ZIP boundaries.
          {coverage === 'core' && ' · Averages use Core MSA (11 counties). Toggle to "All ZIPs" to include extended coverage area.'}
        </div>

      </div>
    </>
  )
}
