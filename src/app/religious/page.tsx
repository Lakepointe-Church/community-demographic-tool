'use client'

import { useEffect, useState, useRef } from 'react'
import { ZIP_GROUPS, CAMPUS_ZIPS } from '@/lib/zips'
import { CORE_MSA_COUNTIES } from '@/lib/zip-county'
import { StatCardFlex as StatCard } from '@/components/ui/StatCardFlex'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdherenceRow {
  fips: string; county: string; region: string
  population: number; total_adherents: number; unclaimed: number
  evangelical: number; mainline_protestant: number; black_protestant: number
  catholic: number; orthodox: number; jewish: number
  buddhist: number; hindu: number; muslim: number
  other_christian: number; other: number; congregations: number
}

interface AdherenceSummary {
  total_population: number; total_unclaimed: number
  unclaimed_pct: number; muslim_pct: number; catholic_pct: number; evangelical_pct: number
}

interface AdherenceData {
  counties: AdherenceRow[]
  summary: AdherenceSummary
}

interface CountyRow {
  county: string
  islamic: number
  christian: number
}

interface ProxyRow {
  zip: string
  label: string
  population: number
  proxyBorn: number
  proxyLanguage: number
  per1k: number
}

interface ProxyData {
  rows: ProxyRow[]
  coverage: string
}

interface Overview {
  stats: {
    total: number; islamic: number; christian: number; jewish: number
    hindu: number; buddhist: number; other: number
    new_since_2015: number; islamic_new: number
  }
  topIslamicZips: { zip: string; count: number }[]
  byCategory: { ntee_category: string; count: number }[]
  saturation: { avg_churches_per_10k: number; max_churches_per_10k: number; zips_with_churches: number } | null
  countyComparison: CountyRow[]
}

interface ZipData {
  zip: string
  orgs: {
    ein: string; name: string; street: string; city: string
    ntee_cd: string; ntee_category: string; ntee_label: string
    ruling_year: number | null; status: string
  }[]
  counts: { ntee_category: string; count: number }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FAITH_COLORS: Record<string, string> = {
  Christian:  '#4EAEFF',
  Islamic:    '#2DD4BF',
  Jewish:     '#A78BFA',
  Hindu:      '#FF6B6B',
  Buddhist:   '#E8B84B',
  Unitarian:  '#94A3B8',
  Other:      '#8A98AE',
}

const BMF_SOURCE_LABEL = 'IRS EO BMF · Registered orgs only'

// ── Shared small components ────────────────────────────────────────────────────

function SourceTag({ label = BMF_SOURCE_LABEL }: { label?: string }) {
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
      color: '#7A8699', background: 'rgba(255,255,255,0.04)',
      border: '1px solid #1e2b3c', borderRadius: 3,
      padding: '2px 6px', letterSpacing: '0.06em', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function CampusDot({ status }: { status: 'existing' | 'soon' }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background:  status === 'existing' ? '#E8B84B' : 'transparent',
      border:      status === 'soon'     ? '1.5px solid #E8B84B' : 'none',
      boxShadow:   status === 'existing' ? '0 0 5px rgba(232,184,75,0.5)' : 'none',
    }} />
  )
}

// ── ZIP dropdown ──────────────────────────────────────────────────────────────

function ZipDropdown({ value, onChange }: { value: string; onChange: (z: string) => void }) {
  const [open, setOpen]       = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedLabel = ZIP_GROUPS.flatMap(g => g.zips).find(z => z.zip === value)?.label ?? value

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 220 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '8px 12px', background: '#13161f',
          border: '1px solid #232940', borderRadius: 6, color: '#C8D4E4',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {CAMPUS_ZIPS[value] && <CampusDot status={CAMPUS_ZIPS[value]} />}
          {value} · {selectedLabel}
        </span>
        <span style={{ color: '#8A98AE', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="zip-scroll" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#13161f', border: '1px solid #232940', borderRadius: 6,
          marginTop: 4, maxHeight: 320, overflowY: 'auto',
        }}>
          {ZIP_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                padding: '6px 12px 4px', fontSize: 10, color: '#7A8699',
                fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em',
                textTransform: 'uppercase', position: 'sticky', top: 0,
                background: '#13161f', borderBottom: '1px solid #1e2b3c',
              }}>{group.label}</div>
              {group.zips.map(z => {
                const campus    = CAMPUS_ZIPS[z.zip]
                const isSelected = z.zip === value
                const isHovered  = z.zip === hovered
                return (
                  <div
                    key={z.zip}
                    onMouseEnter={() => setHovered(z.zip)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => { onChange(z.zip); setOpen(false) }}
                    style={{
                      padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                      fontFamily: "'IBM Plex Mono', monospace",
                      display: 'flex', alignItems: 'center', gap: 8,
                      color:      isSelected ? '#E8B84B' : isHovered ? '#C8D4E4' : '#8A98AE',
                      background: isSelected ? 'rgba(232,184,75,0.08)' : isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                    }}
                  >
                    {campus && <CampusDot status={campus} />}
                    <span style={{ color: '#7A8699' }}>{z.zip}</span>
                    <span>{z.label}</span>
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

// ── Faith distribution bar chart ───────────────────────────────────────────────

function FaithBar({ counts, total }: { counts: { ntee_category: string; count: number }[]; total: number }) {
  const padTop = 22
  const W = 500, barH = 22, gap = 10
  const BAR_MAX = 250
  const LABEL_X = 375
  const maxCount = Math.max(...counts.map(c => c.count), 1)
  const H = padTop + counts.length * (barH + gap)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        {counts.map((c, i) => {
          const color = FAITH_COLORS[c.ntee_category] ?? '#8A98AE'
          return (
            <linearGradient key={i} id={`fg-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={`${color}60`} />
            </linearGradient>
          )
        })}
      </defs>
      {counts.map((c, i) => {
        const y     = padTop + i * (barH + gap)
        const barW  = total > 0 ? Math.max(2, (c.count / maxCount) * BAR_MAX) : 0
        const color = FAITH_COLORS[c.ntee_category] ?? '#8A98AE'
        const pct   = total > 0 ? ((c.count / total) * 100).toFixed(1) : '0.0'
        return (
          <g key={i}>
            <text x={0} y={y + barH - 6} fontSize={12}
              fontFamily="'IBM Plex Mono', monospace" fill="#A8B4C5">{c.ntee_category}</text>
            <rect x={110} y={y} width={Math.max(barW, 1)} height={barH}
              rx={3} fill={`url(#fg-${i})`} />
            <text x={LABEL_X} y={y + barH - 6} fontSize={11}
              fontFamily="'IBM Plex Mono', monospace" fill={color}>
              {c.count} <tspan fill="#7A8699">({pct}%)</tspan>
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── County adherence panel (2020 Religion Census) ─────────────────────────────

const TRADITION_LABELS: { key: keyof AdherenceRow; label: string; color: string }[] = [
  { key: 'unclaimed',           label: 'Unclaimed',         color: '#E8B84B' },
  { key: 'evangelical',         label: 'Evangelical Prot.', color: '#4EAEFF' },
  { key: 'mainline_protestant', label: 'Mainline Prot.',    color: '#2DD4BF' },
  { key: 'black_protestant',    label: 'Black Prot.',       color: '#A78BFA' },
  { key: 'catholic',            label: 'Catholic',          color: '#FF6B6B' },
  { key: 'orthodox',            label: 'Orthodox',          color: '#94A3B8' },
  { key: 'muslim',              label: 'Muslim',            color: '#F59E0B' },
  { key: 'jewish',              label: 'Jewish',            color: '#6EE7B7' },
  { key: 'buddhist',            label: 'Buddhist',          color: '#C4B5FD' },
  { key: 'hindu',               label: 'Hindu',             color: '#FCA5A5' },
  { key: 'other_christian',     label: 'Other Christian',   color: '#64748B' },
  { key: 'other',               label: 'Other',             color: '#374151' },
]

type SortKey = 'county' | 'unclaimed_pct' | 'muslim_pct' | 'catholic_pct' | 'evangelical_pct' | 'population'

function AdherencePanel({ data }: { data: AdherenceData }) {
  const [sortKey, setSortKey]   = useState<SortKey>('unclaimed_pct')
  const [sortDir, setSortDir]   = useState<'desc' | 'asc'>('desc')
  const [showExt, setShowExt]   = useState(false)

  const { counties, summary } = data

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const sorted = [...counties]
    .filter(r => showExt || r.region === 'core_msa')
    .sort((a, b) => {
      const val = (r: AdherenceRow): number => {
        if (sortKey === 'county')         return 0
        if (sortKey === 'population')     return r.population
        if (sortKey === 'unclaimed_pct')  return r.population > 0 ? r.unclaimed / r.population : 0
        if (sortKey === 'muslim_pct')     return r.population > 0 ? r.muslim    / r.population : 0
        if (sortKey === 'catholic_pct')   return r.population > 0 ? r.catholic  / r.population : 0
        if (sortKey === 'evangelical_pct') return r.population > 0 ? r.evangelical / r.population : 0
        return 0
      }
      if (sortKey === 'county') return sortDir === 'asc' ? a.county.localeCompare(b.county) : b.county.localeCompare(a.county)
      return sortDir === 'desc' ? val(b) - val(a) : val(a) - val(b)
    })

  const pct = (n: number, pop: number) => pop > 0 ? ((n / pop) * 100).toFixed(1) + '%' : '—'
  const SortArrow = ({ k }: { k: SortKey }) => (
    <span style={{ color: sortKey === k ? '#E8B84B' : '#7A8699', marginLeft: 3, fontSize: 9 }}>
      {sortKey === k ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
    </span>
  )
  const thStyle = (k: SortKey): React.CSSProperties => ({
    textAlign: 'right', padding: '4px 8px 10px',
    color: sortKey === k ? '#E8B84B' : '#7A8699',
    fontWeight: 400, fontSize: 10, letterSpacing: '0.08em',
    textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c',
    cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: "'IBM Plex Mono', monospace",
  })

  return (
    <div style={{ background: '#13161f', border: '1px solid rgba(232,184,75,0.2)', borderRadius: 10, padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>
            County · Religious Adherence by Tradition
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.06em',
              color: '#E8B84B', background: 'rgba(232,184,75,0.1)',
              border: '1px solid rgba(232,184,75,0.3)', borderRadius: 3, padding: '2px 7px',
            }}>
              ESTIMATE · 2020 U.S. Religion Census (ASARB)
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#7A8699' }}>
              County level · Adherent estimates · Not ZIP-level data
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowExt(v => !v)}
          style={{ background: 'transparent', border: '1px solid #232940', borderRadius: 5, color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}
        >
          {showExt ? 'Core MSA only ▲' : 'Show extended ▼'}
        </button>
      </div>

      {/* Unclaimed caveat — lead with this per spec */}
      <div style={{ margin: '14px 0 18px', padding: '10px 14px', background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 6 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#E8B84B', marginBottom: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Unclaimed — most decision-relevant number for campus planning
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8A98AE', lineHeight: 1.6 }}>
          Unclaimed = population minus all reported religious adherents. It represents people not affiliated with any
          counted congregation — the largest potential audience for a new campus. Core MSA average:{' '}
          <span style={{ color: '#E8B84B', fontWeight: 600 }}>{summary.unclaimed_pct.toFixed(1)}%</span> of population
          ({summary.total_unclaimed.toLocaleString()} people).
        </div>
      </div>

      {/* DFW Core MSA summary stat row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Unclaimed · Core MSA',   value: summary.unclaimed_pct.toFixed(1) + '%',  color: '#E8B84B' },
          { label: 'Evangelical · Core MSA', value: summary.evangelical_pct.toFixed(1) + '%', color: '#4EAEFF' },
          { label: 'Catholic · Core MSA',    value: summary.catholic_pct.toFixed(1) + '%',    color: '#FF6B6B' },
          { label: 'Muslim · Core MSA',      value: summary.muslim_pct.toFixed(2) + '%',      color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #232940', borderRadius: 6, minWidth: 140 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#7A8699', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* County table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('county')} style={{ ...thStyle('county'), textAlign: 'left' }}>
                County <SortArrow k="county" />
              </th>
              <th onClick={() => handleSort('population')} style={thStyle('population')}>
                Pop. <SortArrow k="population" />
              </th>
              <th onClick={() => handleSort('unclaimed_pct')} style={thStyle('unclaimed_pct')}>
                Unclaimed % <SortArrow k="unclaimed_pct" />
              </th>
              <th onClick={() => handleSort('evangelical_pct')} style={thStyle('evangelical_pct')}>
                Evang. Prot. <SortArrow k="evangelical_pct" />
              </th>
              <th onClick={() => handleSort('catholic_pct')} style={thStyle('catholic_pct')}>
                Catholic <SortArrow k="catholic_pct" />
              </th>
              <th onClick={() => handleSort('muslim_pct')} style={thStyle('muslim_pct')}>
                Muslim <SortArrow k="muslim_pct" />
              </th>
              <th style={{ ...thStyle('population'), cursor: 'default' }}>Mainline</th>
              <th style={{ ...thStyle('population'), cursor: 'default' }}>Black Prot.</th>
              <th style={{ ...thStyle('population'), cursor: 'default' }}>Hindu</th>
              <th style={{ ...thStyle('population'), cursor: 'default' }}>Jewish</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const isMSA = r.region === 'core_msa'
              return (
                <tr key={r.fips} style={{ borderBottom: '1px solid #1a1f2e' }}>
                  <td style={{ padding: '8px 8px', color: isMSA ? '#C8D4E4' : '#7A8699' }}>
                    {r.county}
                    {!isMSA && <span style={{ color: '#7A8699', fontSize: 9, marginLeft: 4 }}>ext</span>}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#8A98AE' }}>{r.population.toLocaleString()}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#E8B84B', fontWeight: 600 }}>{pct(r.unclaimed, r.population)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#4EAEFF' }}>{pct(r.evangelical, r.population)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#FF6B6B' }}>{pct(r.catholic, r.population)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#F59E0B' }}>{pct(r.muslim, r.population)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#2DD4BF' }}>{pct(r.mainline_protestant, r.population)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#A78BFA' }}>{pct(r.black_protestant, r.population)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#FCA5A5' }}>{pct(r.hindu, r.population)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#6EE7B7' }}>{pct(r.jewish, r.population)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Attribution */}
      <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid #1e2b3c', borderRadius: 5 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#7A8699', lineHeight: 1.6 }}>
          <strong style={{ color: '#8A98AE' }}>Source:</strong> 2020 U.S. Religion Census (ASARB) · County level · Adherent estimates ·
          Released 2022, updated June 2023. Distributed via theARDA.com (RCMSCY20).
          Tradition classification follows Steensland et al. RELTRAD schema.{' '}
          <strong style={{ color: '#8A98AE' }}>Limitations:</strong> County-level data only — do not interpret as ZIP-level.
          Muslim figures are modeled estimates, not a count of mosque members. Denominations that participate in the
          Religion Census vary; non-participating groups are undercounted. "Unclaimed" = population minus all
          reported adherents and does not imply irreligion — it captures both the nonreligious and
          congregations not counted in the study.
        </div>
      </div>
    </div>
  )
}

// ── ACS Proxy Layer panel ──────────────────────────────────────────────────────

type ProxySortKey = 'proxyBorn' | 'proxyLanguage' | 'per1k' | 'zip'

function ProxyPanel({ data }: { data: ProxyData }) {
  const [sortKey, setSortKey] = useState<ProxySortKey>('proxyBorn')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [showAll, setShowAll] = useState(false)

  function handleSort(k: ProxySortKey) {
    if (k === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const sorted = [...data.rows].sort((a, b) => {
    const va = a[sortKey] as number | string
    const vb = b[sortKey] as number | string
    if (sortKey === 'zip') return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number)
  })

  const visible = showAll ? sorted : sorted.slice(0, 25)

  const totalBorn = data.rows.reduce((s, r) => s + r.proxyBorn, 0)
  const totalLang = data.rows.reduce((s, r) => s + r.proxyLanguage, 0)

  const SortArrow = ({ k }: { k: ProxySortKey }) => (
    <span style={{ color: sortKey === k ? '#E8B84B' : '#7A8699', marginLeft: 3, fontSize: 9 }}>
      {sortKey === k ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
    </span>
  )
  const thStyle = (k: ProxySortKey, align: 'left' | 'right' = 'right'): React.CSSProperties => ({
    textAlign: align, padding: '4px 8px 10px',
    color: sortKey === k ? '#E8B84B' : '#7A8699',
    fontWeight: 400, fontSize: 10, letterSpacing: '0.08em',
    textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c',
    cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: "'IBM Plex Mono', monospace",
  })

  if (data.rows.length === 0) {
    return (
      <div style={{ background: '#13161f', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 10, padding: '24px 28px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#7A8699' }}>
          ACS proxy data not yet populated. Run <code style={{ color: '#E8B84B' }}>POST /api/refresh</code> to compute proxy_born and proxy_language columns.
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#13161f', border: '1px solid rgba(232,184,75,0.2)', borderRadius: 10, padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>
          ZIP · Muslim Community Presence Proxy
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.06em',
            color: '#E8B84B', background: 'rgba(232,184,75,0.1)',
            border: '1px solid rgba(232,184,75,0.3)', borderRadius: 3, padding: '2px 7px',
          }}>
            PROXY · ACS 5-Year 2023 (B05006 birthplace + C16001 Arabic speakers)
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#7A8699' }}>
            ZIP-level directional signal · Not a population estimate
          </span>
        </div>
      </div>

      {/* Required full caveat */}
      <div style={{ margin: '16px 0', padding: '14px 16px', background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.18)', borderRadius: 6 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#E8B84B', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Methodology caveat — read before interpreting
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8A98AE', lineHeight: 1.65 }}>
          <strong style={{ color: '#A8B4C5' }}>Overcounts:</strong> The foreign-born column sums residents born in predominantly
          Muslim-majority countries. It includes non-Muslim minorities —{' '}
          <span style={{ color: '#FF6B6B' }}>Iraq</span> (Chaldean Catholic &amp; Assyrian Christian),{' '}
          <span style={{ color: '#FF6B6B' }}>Egypt</span> (Coptic Orthodox), and{' '}
          <span style={{ color: '#FF6B6B' }}>Syria</span> (Syrian Christian) — who may represent 5–20% of
          those countries&apos; diaspora populations.
          {' '}<strong style={{ color: '#A8B4C5' }}>Undercounts:</strong> U.S.-born Muslims of any background are entirely absent
          from the birthplace signal. The language column partially compensates but is also imperfect.
          Use these figures as a directional geographic signal only — not as a census of the Muslim population.
        </div>
      </div>

      {/* DFW totals */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        {[
          { label: `Foreign-born · ${data.coverage === 'all' ? 'All ZIPs' : 'Core MSA'}`, value: totalBorn.toLocaleString(), color: '#E8B84B' },
          { label: `Arabic speakers · ${data.coverage === 'all' ? 'All ZIPs' : 'Core MSA'}`, value: totalLang.toLocaleString(), color: '#2DD4BF' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #232940', borderRadius: 6, minWidth: 180 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#7A8699', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Ranked table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle('zip', 'left'), cursor: 'default', width: 28 }}>#</th>
              <th onClick={() => handleSort('zip')} style={thStyle('zip', 'left')}>
                ZIP <SortArrow k="zip" />
              </th>
              <th style={{ ...thStyle('zip', 'left'), cursor: 'default' }}>Area</th>
              <th onClick={() => handleSort('proxyBorn')} style={thStyle('proxyBorn')}>
                Born† <SortArrow k="proxyBorn" />
              </th>
              <th onClick={() => handleSort('proxyLanguage')} style={thStyle('proxyLanguage')}>
                Arabic‡ <SortArrow k="proxyLanguage" />
              </th>
              <th onClick={() => handleSort('per1k')} style={thStyle('per1k')}>
                Per 1K <SortArrow k="per1k" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.zip} className="org-row" style={{ borderBottom: '1px solid #1a1f2e' }}>
                <td style={{ padding: '7px 8px', color: '#7A8699', fontSize: 10 }}>{sorted.indexOf(row) + 1}</td>
                <td style={{ padding: '7px 8px', color: '#E8B84B' }}>{row.zip}</td>
                <td style={{ padding: '7px 8px', color: '#A8B4C5', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#E8B84B', fontWeight: 600 }}>{row.proxyBorn.toLocaleString()}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#2DD4BF' }}>{row.proxyLanguage.toLocaleString()}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#A78BFA' }}>{row.per1k.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > 25 && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{ marginTop: 12, background: 'transparent', border: '1px solid #232940', borderRadius: 6, color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}
        >
          {showAll ? '▲ Show top 25' : `Show all ${sorted.length} ZIPs ▼`}
        </button>
      )}

      {/* Attribution footnotes */}
      <div style={{ marginTop: 18, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid #1e2b3c', borderRadius: 5 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#7A8699', lineHeight: 1.7 }}>
          <strong style={{ color: '#8A98AE' }}>† Born:</strong> Sum of ACS B05006 foreign-born from Afghanistan, Bangladesh, Pakistan, Uzbekistan,
          Iraq*, Jordan, Kuwait, Saudi Arabia, Syria*, Turkey, UAE, Yemen, Other Western Asia (Bahrain/Qatar/Oman/W. Bank), Somalia,
          Algeria, Egypt*, Morocco, Sudan, Other N. Africa (Libya/Tunisia), Senegal.
          * Iraq, Egypt, Syria flagged — include significant non-Muslim minority populations.
          <br />
          <strong style={{ color: '#8A98AE' }}>‡ Arabic:</strong> ACS C16001_033E — households speaking Arabic at home (all English proficiency levels, age 5+).
          Urdu, Bengali, and Somali are not separately available at ZIP/ZCTA level in C16001; they are captured
          indirectly through the birthplace proxy for Pakistan, Bangladesh, and Somalia.
          <br />
          <strong style={{ color: '#8A98AE' }}>Source:</strong> U.S. Census Bureau ACS 5-Year Estimates 2023 (Tables B05006, B16001) ·
          Vintage 2023, published December 2024.
        </div>
      </div>
    </div>
  )
}

// ── County comparison panel (BMF) ─────────────────────────────────────────────

function CountyComparison({ data }: { data: CountyRow[] }) {
  const maxIslamic   = Math.max(...data.map(d => d.islamic), 1)
  const maxChristian = Math.max(...data.map(d => d.christian), 1)

  return (
    <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace" }}>
          County · Islamic vs. Christian Registered Orgs
        </div>
        <SourceTag />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#2DD4BF' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#2DD4BF', display: 'inline-block' }} />
          Islamic
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4EAEFF' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4EAEFF', display: 'inline-block' }} />
          Christian
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map(row => {
          const islamicPct   = (row.islamic   / maxIslamic)   * 100
          const christianPct = (row.christian / maxChristian) * 100
          const isMSA = CORE_MSA_COUNTIES.has(row.county)

          return (
            <div key={row.county}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{ width: 90, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: isMSA ? '#A8B4C5' : '#7A8699', textAlign: 'right' }}>
                  {row.county}
                  {!isMSA && <span style={{ color: '#7A8699', fontSize: 9, marginLeft: 3 }}>ext</span>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Islamic bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${islamicPct}%`, background: 'linear-gradient(90deg,#2DD4BF,#2DD4BF50)' }} />
                    </div>
                    <span style={{ width: 28, flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#2DD4BF', fontWeight: 600 }}>{row.islamic}</span>
                  </div>
                  {/* Christian bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${christianPct}%`, background: 'linear-gradient(90deg,#4EAEFF,#4EAEFF50)' }} />
                    </div>
                    <span style={{ width: 28, flexShrink: 0, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4EAEFF', fontWeight: 600 }}>{row.christian}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mosque under-coverage callout */}
      <div style={{
        marginTop: 20, padding: '12px 14px',
        background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.15)',
        borderRadius: 6,
      }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#E8B84B', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Coverage caveat — Islamic orgs
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8A98AE', lineHeight: 1.6 }}>
          Mosque under-count is more severe than for churches. Many mosques operate under the IRS church exemption
          and never file 990s or appear in the BMF. The counts above represent only formally registered 501(c)
          organizations. Use as a relative indicator across counties, not an absolute census of congregations.
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReligiousPage() {
  const [overview, setOverview]           = useState<Overview | null>(null)
  const [adherence, setAdherence]         = useState<AdherenceData | null>(null)
  const [proxy, setProxy]                 = useState<ProxyData | null>(null)
  const [proxyCoverage, setProxyCoverage] = useState<'core' | 'all'>('core')
  const [zip, setZip]                     = useState('75080')
  const [zipData, setZipData]             = useState<ZipData | null>(null)
  const [loadingZip, setLoadingZip]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [showAll, setShowAll]             = useState(false)

  useEffect(() => {
    fetch('/api/religious')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setOverview(d)
      })
      .catch(() => setError('Failed to load overview data'))

    fetch('/api/religious/adherence')
      .then(r => r.json())
      .then(d => { if (!d.error) setAdherence(d) })
      .catch(() => {/* silently skip if table not populated */})
  }, [])

  useEffect(() => {
    fetch(`/api/religious/proxy?coverage=${proxyCoverage}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setProxy(d) })
      .catch(() => {/* silently skip if columns not populated */})
  }, [proxyCoverage])

  useEffect(() => {
    setLoadingZip(true)
    setZipData(null)
    setShowAll(false)
    fetch(`/api/religious?zip=${zip}`)
      .then(r => r.json())
      .then(d => { setZipData(d); setLoadingZip(false) })
      .catch(() => setLoadingZip(false))
  }, [zip])

  const islamicOrgs  = zipData?.orgs.filter(o => o.ntee_category === 'Islamic') ?? []
  const otherOrgs    = zipData?.orgs.filter(o => o.ntee_category !== 'Islamic') ?? []
  const visibleOther = showAll ? otherOrgs : otherOrgs.slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f14', color: '#C8D4E4' }}>
      <style>{`
        body { margin: 0; }
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');
        .zip-scroll::-webkit-scrollbar { width: 6px; }
        .zip-scroll::-webkit-scrollbar-track { background: #13161f; }
        .zip-scroll::-webkit-scrollbar-thumb { background: #232940; border-radius: 3px; }
        .org-row:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#E8B84B', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6, textTransform: 'uppercase' }}>
            IRS 501(c) · Business Master File · DFW Metro
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: 0, color: '#C8D4E4', letterSpacing: '0.02em' }}>
            Religious Landscape
          </h1>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '16px 20px', marginBottom: 24, color: '#FF6B6B', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Stat Cards */}
        {overview && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 40 }}>
            <StatCard label="Total Orgs · DFW"    value={overview.stats.total}     rgb="232,184,75" />
            <StatCard label="Islamic Centers"      value={overview.stats.islamic}   rgb="45,212,191"
              sub={`+${overview.stats.islamic_new} since 2015`} />
            <StatCard label="Christian Churches"   value={overview.stats.christian} rgb="78,174,255" />
            <StatCard label="New Since 2015"       value={overview.stats.new_since_2015} rgb="167,139,250"
              sub="across all faiths" />
            {overview.saturation && (
              <StatCard
                label="Avg Churches / 10K · DFW"
                value={parseFloat(String(overview.saturation.avg_churches_per_10k)).toFixed(1)}
                rgb="232,184,75"
                sub={`${overview.saturation.zips_with_churches} ZIPs w/ registered churches`}
              />
            )}
          </div>
        )}

        {/* Faith distribution + Top Islamic ZIPs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32, alignItems: 'start' }}>

          {overview && (
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace" }}>
                  DFW · Faith Distribution
                </div>
                <SourceTag />
              </div>
              <FaithBar counts={overview.byCategory} total={overview.stats.total} />
            </div>
          )}

          {overview && (
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace" }}>
                  Top ZIP Codes · Islamic Organizations
                </div>
                <SourceTag />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                <thead>
                  <tr>
                    {['ZIP', 'Area', 'Orgs'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Orgs' ? 'right' : 'left', padding: '4px 8px 10px', color: '#7A8699', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
              </table>
              <div className="zip-scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <tbody>
                    {overview.topIslamicZips.map((row) => {
                      const area = ZIP_GROUPS.flatMap(g => g.zips).find(z => z.zip === row.zip)?.label ?? '—'
                      return (
                        <tr key={row.zip} className="org-row" style={{ cursor: 'pointer', borderBottom: '1px solid #1a1f2e' }}
                          onClick={() => setZip(row.zip)}>
                          <td style={{ padding: '8px 8px', color: '#E8B84B' }}>{row.zip}</td>
                          <td style={{ padding: '8px 8px', color: '#A8B4C5' }}>{area}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: '#2DD4BF' }}>{row.count}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: '#7A8699', marginTop: 12, fontFamily: "'IBM Plex Mono', monospace" }}>Click a ZIP to explore</div>
            </div>
          )}
        </div>

        {/* County comparison — Islamic vs Christian alongside each other */}
        {overview && overview.countyComparison.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <CountyComparison data={overview.countyComparison} />
          </div>
        )}

        {/* 2020 Religion Census — county adherence */}
        {adherence && (
          <div style={{ marginBottom: 40 }}>
            <AdherencePanel data={adherence} />
          </div>
        )}

        {/* ACS Proxy Layer */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE' }}>
              ACS Birthplace + Language · Proximity Proxy
            </span>
            <select
              value={proxyCoverage}
              onChange={e => setProxyCoverage(e.target.value as 'core' | 'all')}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, background: '#13161f', color: '#C8D4E4', border: '1px solid #232940', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const }}
            >
              <option value="core">Core MSA · 11 counties</option>
              <option value="all">All ZIPs · Full coverage</option>
            </select>
          </div>
          {proxy && <ProxyPanel data={proxy} />}
          {!proxy && (
            <div style={{ background: '#13161f', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 10, padding: '24px 28px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#7A8699' }}>
              Proxy data not yet available. Run <code style={{ color: '#E8B84B' }}>POST /api/refresh</code> to populate.
            </div>
          )}
        </div>

        {/* ZIP Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace" }}>
            View ZIP Code
          </div>
          <ZipDropdown value={zip} onChange={setZip} />
        </div>

        {loadingZip && (
          <div style={{ color: '#7A8699', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, padding: '40px 0' }}>Loading…</div>
        )}

        {zipData && !loadingZip && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Faith breakdown for ZIP */}
            <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {zip} · Faith Breakdown
                </div>
                <SourceTag />
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#E8B84B', marginBottom: 18 }}>
                {zipData.orgs.length} Religious Orgs
              </div>
              {zipData.counts.length > 0
                ? <FaithBar counts={zipData.counts} total={zipData.orgs.length} />
                : <div style={{ color: '#7A8699', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>No registered religious organizations in this ZIP.</div>
              }
            </div>

            {/* Islamic org detail */}
            <div style={{
              background: islamicOrgs.length > 0
                ? 'radial-gradient(ellipse at 50% 0%, rgba(45,212,191,0.08) 0%, transparent 60%), #13161f'
                : '#13161f',
              border: islamicOrgs.length > 0 ? '1px solid rgba(45,212,191,0.25)' : '1px solid #232940',
              borderRadius: 10, padding: '24px 28px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2DD4BF', fontFamily: "'IBM Plex Mono', monospace" }}>
                  Islamic Organizations · {zip}
                </div>
                <SourceTag />
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#2DD4BF', marginBottom: 12 }}>
                {islamicOrgs.length} {islamicOrgs.length === 1 ? 'Org' : 'Orgs'}
              </div>

              {/* Inline caveat for mosque under-coverage */}
              <div style={{
                marginBottom: 16, padding: '8px 10px',
                background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.12)',
                borderRadius: 5,
              }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#8A98AE', lineHeight: 1.5 }}>
                  Many mosques operate under the IRS church exemption and never appear in the BMF.
                  This count reflects formally registered 501(c) orgs only — actual congregations may be higher.
                </div>
              </div>

              {islamicOrgs.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Name', 'Type', 'Est.'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px 8px', color: '#7A8699', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {islamicOrgs.map(o => (
                      <tr key={o.ein} className="org-row" style={{ borderBottom: '1px solid #1a1f2e' }}>
                        <td style={{ padding: '8px 8px', color: '#C8D4E4', maxWidth: 200, wordBreak: 'break-word' }}>{o.name}</td>
                        <td style={{ padding: '8px 8px', color: '#2DD4BF', whiteSpace: 'nowrap' }}>{o.ntee_label}</td>
                        <td style={{ padding: '8px 8px', color: o.ruling_year && o.ruling_year >= 2015 ? '#E8B84B' : '#7A8699', whiteSpace: 'nowrap' }}>
                          {o.ruling_year ?? '—'}
                          {o.ruling_year && o.ruling_year >= 2015 && <span style={{ color: '#E8B84B', marginLeft: 4, fontSize: 10 }}>NEW</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#7A8699', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                  No Islamic organizations registered in this ZIP code.
                </div>
              )}
            </div>

            {/* All orgs table */}
            {zipData.orgs.length > 0 && (
              <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace" }}>
                    All Organizations · {zip}
                  </div>
                  <SourceTag />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Name', 'Faith', 'Type', 'City', 'Est.'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px 10px', color: '#7A8699', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2b3c' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...islamicOrgs, ...visibleOther].map(o => {
                      const color = FAITH_COLORS[o.ntee_category] ?? '#8A98AE'
                      return (
                        <tr key={o.ein} className="org-row" style={{ borderBottom: '1px solid #1a1f2e' }}>
                          <td style={{ padding: '8px 8px', color: '#C8D4E4', maxWidth: 260, wordBreak: 'break-word' }}>{o.name}</td>
                          <td style={{ padding: '8px 8px' }}>
                            <span style={{ color, fontSize: 10, border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 6px' }}>{o.ntee_category}</span>
                          </td>
                          <td style={{ padding: '8px 8px', color: '#8A98AE' }}>{o.ntee_label}</td>
                          <td style={{ padding: '8px 8px', color: '#8A98AE' }}>{o.city}</td>
                          <td style={{ padding: '8px 8px', color: o.ruling_year && o.ruling_year >= 2015 ? '#E8B84B' : '#7A8699' }}>
                            {o.ruling_year ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {otherOrgs.length > 10 && (
                  <button
                    onClick={() => setShowAll(v => !v)}
                    style={{ marginTop: 14, background: 'transparent', border: '1px solid #232940', borderRadius: 6, color: '#8A98AE', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}
                  >
                    {showAll ? '▲ Show fewer' : `Show all ${zipData.orgs.length} orgs ▼`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 48, padding: '16px 0', borderTop: '1px solid #1e2b3c', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#7A8699' }}>Source: IRS EO Business Master File · Updated monthly</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#7A8699' }}>Only 501(c) registered orgs — mosques and churches below 990-filing threshold may not appear</span>
        </div>
      </div>
    </div>
  )
}
