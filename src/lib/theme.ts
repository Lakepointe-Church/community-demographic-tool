// Design tokens — single source of truth for the brand/design system.
// Pure constants (no React/DOM imports) so they're usable anywhere.
// Mirrors the "Brand / design system" section of CLAUDE.md.

export const colors = {
  // Surfaces
  bg:         '#0d0f14',
  surface:    '#13161f',
  border:     '#232940',
  borderSub:  '#1e2b3c',

  // Accent palette
  gold:       '#E8B84B', // primary
  blue:       '#4EAEFF',
  teal:       '#2DD4BF',
  coral:      '#FF6B6B',
  purple:     '#A78BFA',

  // Text
  textStrong: '#F0F2F7',
  text:       '#C8D4E4',
  label:      '#A8B4C5',
  muted:      '#8A98AE',
  footer:     '#5a6478',
  faint:      '#3d4a5c',
} as const

export const fonts = {
  display: "'Bebas Neue',sans-serif",       // display / big numbers
  mono:    "'IBM Plex Mono',monospace",      // labels / data
  sans:    "'IBM Plex Sans',sans-serif",     // body
} as const

// Comma-separated RGB strings for rgba() composition (radial-glow cards).
export const rgbMap: Record<string, string> = {
  [colors.gold]:   '232,184,75',
  [colors.blue]:   '78,174,255',
  [colors.teal]:   '45,212,191',
  [colors.purple]: '167,139,250',
  [colors.coral]:  '255,107,107',
}

// Returns the comma-separated RGB for a hex from the palette (defaults to gold).
export function toRgb(hex: string): string {
  return rgbMap[hex] ?? rgbMap[colors.gold]
}

// Flat surface gradient used by Surface panels + stat-card base layer.
export const CARD_BG =
  'linear-gradient(145deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%)'

// Stat-card radial-glow background (idle vs hovered) for an accent color.
export function cardGlow(hex: string, hovered: boolean): string {
  const rgb = toRgb(hex)
  return hovered
    ? `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.22) 0%,transparent 60%),linear-gradient(145deg,rgba(${rgb},0.08) 0%,rgba(255,255,255,0.01) 100%)`
    : `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.1) 0%,transparent 55%),${CARD_BG}`
}
