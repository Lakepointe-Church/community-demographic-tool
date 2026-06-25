import { colors, fonts } from '@/lib/theme'

// Page-section divider: gold left border + mono eyebrow + Bebas title.
// Used by Overview / Compare / Demographics. (Distinct from `SectionHeader`,
// which is the smaller mono panel-label + sub line.)
export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${colors.gold}`, paddingLeft: '16px', marginBottom: '24px' }}>
      <div style={{ fontFamily: fonts.mono, fontSize: '11px', letterSpacing: '0.15em', color: colors.gold, textTransform: 'uppercase', marginBottom: '6px' }}>{eyebrow}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: '28px', letterSpacing: '0.04em', lineHeight: 1, color: colors.textStrong }}>{title}</div>
    </div>
  )
}
