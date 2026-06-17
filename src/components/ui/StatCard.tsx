'use client'

import { useState } from 'react'
import { colors, fonts, cardGlow, toRgb } from '@/lib/theme'

// Radial-glow stat card. Accent `color` drives the glow + value color.
// `loading` shows a pulse skeleton (relies on the global `@keyframes pulse`).
// `compact` uses tighter padding + smaller numbers (dense 4-up metric rows).
export function StatCard({ label, value, sub, color, loading, compact }: {
  label: string
  value: string
  sub?: string
  color: string
  loading?: boolean
  compact?: boolean
}) {
  const [hov, setHov] = useState(false)
  const d = compact
    ? { padding: '18px 22px', labelMb: '8px', value: '36px', skel: '32px', sub: '10px', subMt: '6px' }
    : { padding: '20px 24px', labelMb: '10px', value: '40px', skel: '36px', sub: '11px', subMt: '8px' }
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: cardGlow(color, hov),
        border: `1px solid ${hov ? `rgba(${toRgb(color)},0.4)` : colors.border}`,
        borderRadius: '4px', padding: d.padding, transition: 'all 0.2s',
      }}
    >
      <div style={{ fontFamily: fonts.mono, fontSize: '10px', letterSpacing: '0.14em', color: colors.muted, textTransform: 'uppercase', marginBottom: d.labelMb }}>{label}</div>
      {loading
        ? <div style={{ height: d.skel, width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        : <div style={{ fontFamily: fonts.display, fontSize: d.value, letterSpacing: '0.04em', color, lineHeight: 1 }}>{value}</div>
      }
      {sub && <div style={{ fontFamily: fonts.mono, fontSize: d.sub, color: colors.footer, marginTop: d.subMt, letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  )
}
