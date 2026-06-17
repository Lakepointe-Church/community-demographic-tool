'use client'

import { useState } from 'react'
import { colors, fonts, cardGlowRgb } from '@/lib/theme'

// Flex-sized stat card (wraps in a flex-wrap row rather than a fixed grid):
// `rgb` is a raw comma-separated string driving the glow + value color, and
// `value` may be a number (locale-formatted) with an optional `unit` suffix.
// Used by /religious. (Family C — distinct from grid `StatCard`/`StatCardAccent`.)
export function StatCardFlex({ label, value, sub, rgb, unit = '' }: {
  label: string
  value: string | number
  sub?: string
  rgb: string
  unit?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 180px', minWidth: 160, padding: '20px 22px', borderRadius: 10,
        background: cardGlowRgb(rgb, hovered),
        border: hovered ? `1px solid rgba(${rgb},0.4)` : `1px solid ${colors.border}`,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.muted, fontFamily: fonts.mono, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontSize: 38, color: `rgb(${rgb})`, lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}{unit}
      </div>
      {sub && <div style={{ fontSize: 11, color: colors.footer, marginTop: 6, fontFamily: fonts.mono }}>{sub}</div>}
    </div>
  )
}
