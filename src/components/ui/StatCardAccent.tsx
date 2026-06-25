'use client'

import { useState } from 'react'
import { colors, fonts, toRgb } from '@/lib/theme'
import { InfoTooltip } from '@/components/InfoTooltip'

const ACCENTS = {
  gold:   colors.gold,
  blue:   colors.blue,
  coral:  colors.coral,
  teal:   colors.teal,
  purple: colors.purple,
} as const

export type Accent = keyof typeof ACCENTS

// Accent-bar stat card: named `accent` drives a 2px top bar + glow; value renders
// white by default. Set `accentValue` to color the number in the accent hue — use
// sparingly for the single lead/focal KPI per view (orange-on-neutral rule).
// Optional `tooltip` shows an info icon top-right.
// Used by Overview / Compare / Demographics. (Family B = `StatCard` w/ colored value.)
export function StatCardAccent({ label, value, sub, accent = 'gold', accentValue = false, loading = false, tooltip }: {
  label: string
  value: string
  sub?: string
  accent?: Accent
  accentValue?: boolean
  loading?: boolean
  tooltip?: string
}) {
  const [hovered, setHovered] = useState(false)
  const color = ACCENTS[accent]
  const rgb = toRgb(color)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.22) 0%, transparent 60%), linear-gradient(145deg, rgba(${rgb},0.08) 0%, rgba(255,255,255,0.01) 100%)`
          : `radial-gradient(ellipse at 50% 0%, rgba(${rgb},0.1) 0%, transparent 55%), linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`,
        border: `1px solid ${hovered ? `rgba(${rgb},0.4)` : colors.border}`,
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        cursor: 'default',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color }} />
      {tooltip && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 50 }}>
          <InfoTooltip text={tooltip} placement="below-right" />
        </div>
      )}
      <div style={{ fontFamily: fonts.mono, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.label, marginBottom: '12px' }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: '40px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <>
          <div style={{ fontFamily: fonts.display, fontSize: '44px', lineHeight: 1, letterSpacing: '0.03em', color: accentValue ? color : colors.textStrong }}>{value}</div>
          {sub && <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.muted, marginTop: '8px', letterSpacing: '0.04em' }}>{sub}</div>}
        </>
      )}
    </div>
  )
}
