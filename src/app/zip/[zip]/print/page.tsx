'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DFW_ZIPS } from '@/lib/zips'

// ── Types ────────────────────────────────────────────────────────

interface CensusData {
  zip: string
  name: string
  population: number
  populationGrowth: number | null
  medianHouseholdIncome: number
  medianHomeValue: number
  totalHouseholds: number
  avgHouseholdSize: number | null
  hhWithChildrenPct: number | null
  unemploymentRate: number | null
  bachelorsRate: number | null
  sesLabel: string
  sesScore: number
  dualEarnerPct: number | null
  commute30PlusPct: number | null
  occMgmtProfPct: number | null
  fertilityRate: number | null
  race: { white: number; hispanic: number; black: number; asian: number; other: number }
  ageDistribution: { age0_17: number; age18_34: number; age35_54: number; age55_74: number; age75plus: number } | null
  householdTypes: { marriedWithChildren: number; marriedNoChildren: number; singleParent: number; livingAlone: number; other: number } | null
}

interface HealthData {
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
}

interface EmployerData {
  totalEstab: number | null
  totalEmp: number | null
  avgWage: number | null
  topSector: string | null
  sectors: { label: string; estab: number }[]
}

interface ReligiousData {
  counts: { ntee_category: string; count: number }[]
}

// ── Formatters ───────────────────────────────────────────────────

const fmt$ = (n: number | null) => n && n > 0 ? '$' + n.toLocaleString() : '—'
const fmtK = (n: number | null) => {
  if (!n || n < 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
const fmtPct = (n: number | null, decimals = 1) => n != null ? n.toFixed(decimals) + '%' : '—'

const SES_COLOR: Record<string, string> = {
  'Upper': '#7C3AED', 'Upper Middle': '#1D4ED8', 'Middle': '#0F766E',
  'Lower Middle': '#B45309', 'Lower Income': '#B91C1C',
}

// ── Page ─────────────────────────────────────────────────────────

export default function PrintPage() {
  const { zip } = useParams<{ zip: string }>()
  const [census, setCensus]     = useState<CensusData | null>(null)
  const [health, setHealth]     = useState<HealthData | null>(null)
  const [employers, setEmployers] = useState<EmployerData | null>(null)
  const [religious, setReligious] = useState<ReligiousData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)

  const areaName = DFW_ZIPS.find(z => z.zip === zip)?.label ?? zip
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  useEffect(() => {
    if (!zip) return
    setLoading(true)
    Promise.all([
      fetch(`/api/census?zip=${zip}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/community-needs?zip=${zip}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/employers?zip=${zip}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/religious?zip=${zip}`).then(r => r.ok ? r.json() : null),
    ]).then(([c, h, e, rel]) => {
      if (c) setCensus(c)
      else setError(true)
      if (h) setHealth(h)
      if (e) setEmployers(e)
      if (rel) setReligious({ counts: rel.counts ?? [] })
      setLoading(false)
    }).catch(() => { setError(true); setLoading(false) })
  }, [zip])

  const totalReligious = religious?.counts.reduce((s, c) => s + c.count, 0) ?? 0

  return (
    <>
      <style>{`
        @media print {
          nav, .print-hide { display: none !important; }
          body { background: white !important; }
          body::before, body::after { display: none !important; }
          .print-doc { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; border: none !important; }
          @page { margin: 0.5in; size: letter portrait; }
        }
        .print-doc { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>

      {/* Screen wrapper — dark bg with centered white document */}
      <div style={{ minHeight: '100vh', background: '#0d0f14', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Print / Back controls (hidden on print) */}
        <div className="print-hide" style={{ width: '100%', maxWidth: '780px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <a href={`/demographics`} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#8A98AE', textDecoration:'none', letterSpacing:'0.1em' }}>
            ← Back to Demographics
          </a>
          <button
            onClick={() => window.print()}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', letterSpacing:'0.12em', textTransform:'uppercase', padding:'7px 18px', borderRadius:'3px', cursor:'pointer', border:'1px solid rgba(232,184,75,0.4)', background:'rgba(232,184,75,0.1)', color:'#E8B84B' }}
          >
            Print / Save as PDF
          </button>
        </div>

        {/* Document */}
        <div className="print-doc" style={{ width: '100%', maxWidth: '780px', background: '#ffffff', borderRadius: '4px', boxShadow: '0 4px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>

          {loading && (
            <div style={{ padding: '80px', textAlign: 'center', fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', color:'#8A98AE' }}>
              Loading ZIP {zip}…
            </div>
          )}

          {error && (
            <div style={{ padding: '80px', textAlign: 'center', fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', color:'#B91C1C' }}>
              No data found for ZIP {zip}. Check that this ZIP has been refreshed.
            </div>
          )}

          {!loading && !error && census && (
            <>
              {/* ── Doc Header ──────────────────────────────────── */}
              <div style={{ background: '#0d0f14', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'42px', letterSpacing:'0.06em', color:'#E8B84B', lineHeight:1 }}>
                    ZIP {zip}
                  </div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', color:'#C8D4E4', marginTop:'4px' }}>
                    {areaName}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.18em', color:'#E8B84B', textTransform:'uppercase' }}>
                    LAKEPOINTE CHURCH
                  </div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5a6478', marginTop:'3px' }}>
                    Community Intelligence · {today}
                  </div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#3d4a5c', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                    Internal Use Only
                  </div>
                </div>
              </div>

              {/* ── Core Stats Grid ─────────────────────────────── */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
                  <StatPill label="Population" value={fmtK(census.population)} sub={census.populationGrowth != null ? `${census.populationGrowth > 0 ? '+' : ''}${census.populationGrowth}% since 2020` : 'vs. 2020'} />
                  <StatPill label="Median HHI" value={fmt$(census.medianHouseholdIncome)} sub="ACS 2023 estimate" />
                  <StatPill label="Median Home Value" value={fmt$(census.medianHomeValue)} sub="owner-occupied" />
                  <StatPill label="SES Class" value={census.sesLabel} sub={`Score ${census.sesScore}/100`} accent={SES_COLOR[census.sesLabel] ?? '#374151'} />
                  <StatPill label="HH w/ Children" value={fmtPct(census.hhWithChildrenPct)} sub="under 18" />
                  <StatPill label="Bachelor's+" value={fmtPct(census.bachelorsRate)} sub="adults 25+" />
                  <StatPill label="Unemployment" value={fmtPct(census.unemploymentRate)} sub="civilian labor force" />
                  <StatPill label="Avg HH Size" value={census.avgHouseholdSize?.toFixed(1) ?? '—'} sub="persons per household" />
                </div>
              </div>

              {/* ── Two-column body ─────────────────────────────── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:'1px solid #e5e7eb' }}>

                {/* Left col: Households + Age */}
                <div style={{ padding:'20px 28px', borderRight:'1px solid #e5e7eb' }}>
                  <SectionLabel>Household Profile</SectionLabel>
                  {census.householdTypes ? (
                    <MiniTable rows={[
                      ['Married w/ Children',  fmtPct(census.householdTypes.marriedWithChildren)],
                      ['Married, No Children', fmtPct(census.householdTypes.marriedNoChildren)],
                      ['Single Parent',        fmtPct(census.householdTypes.singleParent)],
                      ['Living Alone',         fmtPct(census.householdTypes.livingAlone)],
                      ['Other',                fmtPct(census.householdTypes.other)],
                    ]} />
                  ) : <Dash />}

                  <SectionLabel style={{ marginTop:'16px' }}>Age Distribution</SectionLabel>
                  {census.ageDistribution ? (
                    <MiniTable rows={[
                      ['0–17',   fmtPct(census.ageDistribution.age0_17)],
                      ['18–34',  fmtPct(census.ageDistribution.age18_34)],
                      ['35–54',  fmtPct(census.ageDistribution.age35_54)],
                      ['55–74',  fmtPct(census.ageDistribution.age55_74)],
                      ['75+',    fmtPct(census.ageDistribution.age75plus)],
                    ]} />
                  ) : <Dash />}

                  <SectionLabel style={{ marginTop:'16px' }}>Race / Ethnicity</SectionLabel>
                  <MiniTable rows={[
                    ['White (non-Hispanic)', fmtPct(census.race.white)],
                    ['Hispanic',             fmtPct(census.race.hispanic)],
                    ['Black',                fmtPct(census.race.black)],
                    ['Asian',                fmtPct(census.race.asian)],
                    ['Other / Multiracial',  fmtPct(census.race.other)],
                  ]} />
                </div>

                {/* Right col: Health + Employers + Religious */}
                <div style={{ padding:'20px 28px' }}>

                  {health && (
                    <>
                      <SectionLabel>Health Snapshot <span style={{ fontWeight:400, fontSize:'9px', color:'#9ca3af' }}>(CDC PLACES 2023, % adults)</span></SectionLabel>
                      <MiniTable rows={[
                        ['Diabetes',         fmtPct(health.diabetes)],
                        ['Obesity',          fmtPct(health.obesity)],
                        ['Uninsured',        fmtPct(health.uninsured)],
                        ['High Blood Pressure', fmtPct(health.highBloodPressure)],
                        ['Depression',       fmtPct(health.depression)],
                        ['Mental Distress',  fmtPct(health.mentalDistress)],
                        ['Phys. Inactivity', fmtPct(health.physInactivity)],
                        ['Smoking',          fmtPct(health.smoking)],
                      ]} />
                      {health.cfpbComplaints != null && (
                        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#6b7280', marginTop:'6px' }}>
                          CFPB complaints: {health.cfpbComplaints.toLocaleString()}
                          {health.cfpbPer1k != null && ` · ${health.cfpbPer1k}/1K residents`}
                        </div>
                      )}
                    </>
                  )}

                  {employers && employers.totalEstab != null && (
                    <>
                      <SectionLabel style={{ marginTop:'16px' }}>Employers <span style={{ fontWeight:400, fontSize:'9px', color:'#9ca3af' }}>(CBP 2022)</span></SectionLabel>
                      <MiniTable rows={[
                        ['Establishments', employers.totalEstab?.toLocaleString() ?? '—'],
                        ['Employees',      fmtK(employers.totalEmp)],
                        ['Avg Annual Wage', fmt$(employers.avgWage)],
                        ['Top Sector',     employers.topSector ?? '—'],
                      ]} />
                      {employers.sectors.slice(1, 4).length > 0 && (
                        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#9ca3af', marginTop:'4px' }}>
                          Also: {employers.sectors.slice(1, 4).map(s => s.label).join(' · ')}
                        </div>
                      )}
                    </>
                  )}

                  {religious && totalReligious > 0 && (
                    <>
                      <SectionLabel style={{ marginTop:'16px' }}>Religious Orgs <span style={{ fontWeight:400, fontSize:'9px', color:'#9ca3af' }}>(IRS BMF)</span></SectionLabel>
                      <MiniTable rows={[
                        ['Total registered', String(totalReligious)],
                        ...religious.counts.map(c => [c.ntee_category, String(c.count)] as [string, string]),
                      ]} />
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#9ca3af', marginTop:'4px' }}>
                        BMF undercounts congregations that never file — use as relative index.
                      </div>
                    </>
                  )}

                  <SectionLabel style={{ marginTop:'16px' }}>Labor Profile</SectionLabel>
                  <MiniTable rows={[
                    ['Dual-Earner HH',   fmtPct(census.dualEarnerPct)],
                    ['Commute 30+ min',  fmtPct(census.commute30PlusPct)],
                    ['Mgmt / Prof occ.', fmtPct(census.occMgmtProfPct)],
                  ]} />
                </div>
              </div>

              {/* ── Footer ──────────────────────────────────────── */}
              <div style={{ padding:'10px 28px', background:'#f9fafb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#9ca3af', lineHeight:1.6 }}>
                  Sources: U.S. Census ACS 5-Year 2023 · CDC PLACES 2023 · Census CBP 2022 · IRS EO BMF<br />
                  * ZIP data uses ZCTA boundaries, which approximate but do not exactly match USPS ZIP codes.
                </div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#9ca3af', textAlign:'right' }}>
                  Lakepointe Church<br />Internal Use Only
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function StatPill({ label, value, sub, accent = '#E8B84B' }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${accent}`, paddingLeft: '10px', paddingTop: '4px', paddingBottom: '4px' }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', letterSpacing:'0.12em', color:'#9ca3af', textTransform:'uppercase', marginBottom:'2px' }}>{label}</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'18px', fontWeight:600, color:'#111827', lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#9ca3af', marginTop:'2px' }}>{sub}</div>}
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', letterSpacing:'0.16em', textTransform:'uppercase', color:'#E8B84B', marginBottom:'8px', borderBottom:'1px solid #f3f4f6', paddingBottom:'4px', ...style }}>
      {children}
    </div>
  )
}

function MiniTable({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'4px' }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:'11px', color:'#374151', padding:'2px 0', width:'60%' }}>{label}</td>
            <td style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#111827', fontWeight:600, padding:'2px 0', textAlign:'right' }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Dash() {
  return <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#9ca3af' }}>—</div>
}
