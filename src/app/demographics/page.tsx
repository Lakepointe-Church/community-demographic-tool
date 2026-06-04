'use client'

import { useState, useEffect } from 'react'
import { DFW_ZIPS } from '@/lib/zips'

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
  race: { white: number; hispanic: number; black: number; asian: number; other: number }
  education: { noHSDiploma: number; hsDiploma: number; someCollege: number; bachelorsPlus: number }
  ageDistribution: { age0_17: number; age18_34: number; age35_54: number; age55_74: number; age75plus: number } | null
  householdTypes: { marriedWithChildren: number; marriedNoChildren: number; singleParent: number; livingAlone: number; other: number } | null
  incomeBrackets: { label: string; pct: number }[]
  updatedAt: string
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

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = 'gold', loading = false }: {
  label: string; value: string; sub?: string
  accent?: 'gold' | 'blue' | 'coral' | 'teal' | 'purple'
  loading?: boolean
}) {
  const colors = { gold: '#E8B84B', blue: '#4EAEFF', coral: '#FF6B6B', teal: '#2DD4BF', purple: '#A78BFA' }
  const color = colors[accent]
  return (
    <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color }} />
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#9BA5B7', marginBottom: '10px' }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: '40px', background: '#1e2433', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', lineHeight: 1, letterSpacing: '0.03em', color: color === '#E8B84B' ? '#F0F2F7' : '#F0F2F7' }}>
            {value}
          </div>
          {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6B7689', marginTop: '8px', letterSpacing: '0.04em' }}>{sub}</div>}
        </>
      )}
    </div>
  )
}

// ── Section Header ───────────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ borderLeft: '3px solid #E8B84B', paddingLeft: '16px', marginBottom: '20px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '5px' }}>{eyebrow}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '26px', letterSpacing: '0.04em', lineHeight: 1, color: '#F0F2F7' }}>{title}</div>
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
    return <div style={{ width: 200, height: 200, borderRadius: '50%', background: '#1e2433', animation: 'pulse 1.5s ease-in-out infinite' }} />
  }

  let cumPct = 0
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2433" strokeWidth={sw} />
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
      <circle cx={cx} cy={cy} r={54} fill="#13161f" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#6B7689"
        fontFamily="'IBM Plex Mono', monospace" fontSize="9" letterSpacing="1.5">
        RACE
      </text>
    </svg>
  )
}

// ── Education Bar Chart ──────────────────────────────────────────
const EDU_SEGS = [
  { key: 'bachelorsPlus' as const, label: "Bachelor's+",  color: '#4EAEFF' },
  { key: 'someCollege'   as const, label: 'Some College', color: '#2DD4BF' },
  { key: 'hsDiploma'     as const, label: 'HS Diploma',   color: '#E8B84B' },
  { key: 'noHSDiploma'   as const, label: 'No HS Diploma', color: '#FF6B6B' },
]

function EducationChart({ education, loading }: { education: CensusData['education'] | null; loading: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {EDU_SEGS.map(({ key, label, color }) => {
        const value = education?.[key] ?? 0
        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9BA5B7', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{label}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#F0F2F7', fontWeight: 600 }}>
                {loading ? '—' : `${value.toFixed(1)}%`}
              </span>
            </div>
            <div style={{ height: '6px', background: '#1e2433', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: loading ? '0%' : `${Math.min(value, 100)}%`,
                background: color, borderRadius: '3px', transition: 'width 0.7s ease',
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
  const barW = 58, gap = 14, chartH = 140, padL = 28
  const totalW = AGE_SEGS.length * (barW + gap) - gap

  return (
    <svg width={totalW + padL + 8} height={chartH + 36} style={{ overflow: 'visible' }}>
      {[0, Math.round(maxPct / 2), Math.round(maxPct)].map(v => {
        const y = chartH - (v / maxPct) * chartH
        return (
          <g key={v}>
            <text x={padL - 5} y={y + 4} textAnchor="end" fill="#6B7689" fontFamily="IBM Plex Mono" fontSize="9">{v}%</text>
            <line x1={padL} y1={y} x2={padL + totalW} y2={y} stroke="#1e2433" strokeWidth={1} strokeDasharray="3 3" />
          </g>
        )
      })}
      {AGE_SEGS.map((seg, idx) => {
        const val  = loading ? 0 : (values[idx] ?? 0)
        const barH = (val / maxPct) * chartH
        const x    = padL + idx * (barW + gap)
        return (
          <g key={seg.key}>
            <rect x={x} y={chartH - barH} width={barW} height={barH}
              fill={seg.color} opacity={0.75}
              style={{ transition: 'all 0.6s ease' }}
            />
            <rect x={x} y={chartH - barH} width={barW} height={2} fill={seg.color} />
            {!loading && val > 0 && (
              <text x={x + barW / 2} y={chartH - barH - 5} textAnchor="middle"
                fill="#F0F2F7" fontFamily="IBM Plex Mono" fontSize="9">{val.toFixed(1)}%
              </text>
            )}
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
              fill="#9BA5B7" fontFamily="IBM Plex Mono" fontSize="9">{seg.label}
            </text>
          </g>
        )
      })}
      <line x1={padL} y1={chartH} x2={padL + totalW} y2={chartH} stroke="#2a3044" strokeWidth={1} />
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
    return <div style={{ width: 200, height: 200, borderRadius: '50%', background: '#1e2433', animation: 'pulse 1.5s ease-in-out infinite' }} />
  }

  let cumPct = 0
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2433" strokeWidth={sw} />
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
      <circle cx={cx} cy={cy} r={54} fill="#13161f" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#6B7689"
        fontFamily="'IBM Plex Mono', monospace" fontSize="9" letterSpacing="1.5">
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

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/census?zip=${selectedZip}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedZip])

  const selectedLabel = DFW_ZIPS.find(z => z.zip === selectedZip)?.label ?? selectedZip

  return (
    <>
      <style>{`
        .zip-select {
          background: #13161f; border: 1px solid #1e2433; color: #F0F2F7;
          padding: 8px 32px 8px 14px; font-family: 'IBM Plex Mono', monospace;
          font-size: 12px; letter-spacing: 0.04em; cursor: pointer; outline: none;
          appearance: none; -webkit-appearance: none; min-width: 220px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23E8B84B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
        }
        .zip-select:hover, .zip-select:focus { border-color: #E8B84B; }
        .zip-select option { background: #13161f; color: #F0F2F7; }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '36px 32px', maxWidth: '1440px', margin: '0 auto' }}>

          {/* Header */}
          <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.22em', color: '#E8B84B', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                Dashboard · Demographics
              </div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 4vw, 52px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
                Demographic<br />Profile
              </h1>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6B7689', letterSpacing: '0.1em', marginTop: '10px', textTransform: 'uppercase' as const }}>
                ZIP-Level Demographic Breakdown
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7689', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
                Select ZIP Code
              </div>
              <select className="zip-select" value={selectedZip} onChange={e => setSelectedZip(e.target.value)}>
                {DFW_ZIPS.map(({ zip, label }) => (
                  <option key={zip} value={zip}>{zip} — {label}</option>
                ))}
              </select>
              {data && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7689', letterSpacing: '0.08em', marginTop: '6px' }}>
                  Updated {new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
            />
            <StatCard
              label="Median HH Income"
              value={data ? `$${fmtK(data.medianHouseholdIncome)}` : '—'}
              sub="ACS 5-Year Estimate" accent="blue" loading={loading}
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
            />
            <StatCard
              label="HH w/ Children (18-)"
              value={data ? `${data.hhWithChildrenPct}%` : '—'}
              sub="of all households" accent="teal" loading={loading}
            />
          </div>

          {/* Second stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '36px' }}>
            <StatCard
              label="Avg Household Size"
              value={data ? `${data.avgHouseholdSize}` : '—'}
              sub="persons per household" accent="purple" loading={loading}
            />
            <StatCard
              label="Median Home Value"
              value={data ? `$${fmtK(data.medianHomeValue)}` : '—'}
              sub="ACS 5-Year Estimate" accent="gold" loading={loading}
            />
            <StatCard
              label="Unemployment Rate"
              value={data?.unemploymentRate ? `${data.unemploymentRate}%` : '—'}
              sub="Labor force basis · ACS"
              accent={parseFloat(data?.unemploymentRate ?? '0') > 5 ? 'coral' : 'teal'}
              loading={loading}
            />
            <StatCard
              label="Bachelor's Degree+"
              value={data?.bachelorsRate ? `${data.bachelorsRate}%` : '—'}
              sub="Adults 25+ · ACS" accent="blue" loading={loading}
            />
          </div>

          {/* Charts */}
          <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '36px' }}>

            {/* Race / Ethnicity */}
            <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px' }}>
              <SectionHeader eyebrow="U.S. Census Bureau · ACS 2023" title="Race / Ethnicity" />
              <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                <DonutChart race={data?.race ?? null} loading={loading} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {RACE_SEGS.map(seg => (
                    <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9BA5B7', flex: 1 }}>{seg.label}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', fontWeight: 600 }}>
                        {loading ? '—' : `${(data?.race?.[seg.key] ?? 0).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Educational Attainment */}
            <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px' }}>
              <SectionHeader eyebrow="Adults 25+ · ACS 5-Year" title="Educational Attainment" />
              <EducationChart education={data?.education ?? null} loading={loading} />
            </div>
          </div>

          {/* Age Distribution + Household Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px' }}>
              <SectionHeader eyebrow="U.S. Census Bureau · ACS 2023" title="Age Distribution" />
              <div style={{ overflowX: 'auto' }}>
                <AgeChart ageDistribution={data?.ageDistribution ?? null} loading={loading} />
              </div>
            </div>

            <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px' }}>
              <SectionHeader eyebrow="U.S. Census Bureau · ACS 2023" title="Household Type" />
              <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                <HouseholdTypeChart householdTypes={data?.householdTypes ?? null} loading={loading} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {HH_SEGS.map(seg => (
                    <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9BA5B7', flex: 1 }}>{seg.label}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#F0F2F7', fontWeight: 600 }}>
                        {loading || !data?.householdTypes ? '—' : `${(data.householdTypes[seg.key] ?? 0).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detail row */}
          <div style={{ background: '#13161f', border: '1px solid #1e2433', padding: '24px', marginBottom: '36px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#9BA5B7', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #1a1f2e' }}>
              ZIP {selectedZip} · Full Profile · U.S. Census Bureau ACS 2023
            </div>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ height: '18px', background: '#1e2433', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
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
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px 11px 0', borderBottom: '1px solid #1a1f2e' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9BA5B7' }}>{label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#F0F2F7', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #1a1f2e', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#3a4154', letterSpacing: '0.08em' }}>
              Source: U.S. Census Bureau ACS 5-Year Estimates (2023) · api.census.gov
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#3a4154', letterSpacing: '0.08em' }}>
              Lakepointe Church · Community Intelligence Platform · Internal Use Only
            </span>
          </div>

        </div>
      </div>
    </>
  )
}
