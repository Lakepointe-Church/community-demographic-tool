import type { CSSProperties } from 'react'
import { colors, fonts } from '@/lib/theme'

// Small uppercase mono eyebrow + optional sub line. Used atop panels/sections.
// `marginBottom` is applied to the whole block (defaults differ by caller).
export function SectionHeader({ title, sub, marginBottom = '16px', style }: {
  title: string
  sub?: string
  marginBottom?: CSSProperties['marginBottom']
  style?: CSSProperties
}) {
  return (
    <div style={{ marginBottom, ...style }}>
      <div style={{ fontFamily: fonts.mono, fontSize: '10px', letterSpacing: '0.14em', color: colors.muted, textTransform: 'uppercase', marginBottom: sub ? '4px' : 0 }}>{title}</div>
      {sub && <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.footer, letterSpacing: '0.08em' }}>{sub}</div>}
    </div>
  )
}
