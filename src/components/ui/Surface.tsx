import type { CSSProperties, ReactNode } from 'react'
import { colors, CARD_BG } from '@/lib/theme'

// Panel container: flat card-gradient background + border. `padding` and any
// extra `style` keys override the defaults (e.g. marginBottom, display:grid).
export function Surface({ children, padding = '24px', style, className }: {
  children: ReactNode
  padding?: CSSProperties['padding']
  style?: CSSProperties
  className?: string
}) {
  return (
    <div
      className={className}
      style={{ background: CARD_BG, border: `1px solid ${colors.border}`, padding, ...style }}
    >
      {children}
    </div>
  )
}
