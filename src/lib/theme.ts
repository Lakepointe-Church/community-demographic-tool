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
  muted:      '#8A98AE', // ~6.5:1 on bg — passes WCAG AA
  footer:     '#7A8699', // bumped from #5a6478 (~3.2:1, failed AA) → ~5.2:1 for 55+ readability
  faint:      '#6E7C92', // bumped from #3d4a5c (~2:1, failed AA) → ~4.5:1 (AA floor)
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

// Stat-card radial-glow background (idle vs hovered) from a comma-separated
// RGB string (e.g. '232,184,75').
export function cardGlowRgb(rgb: string, hovered: boolean): string {
  return hovered
    ? `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.22) 0%,transparent 60%),linear-gradient(145deg,rgba(${rgb},0.08) 0%,rgba(255,255,255,0.01) 100%)`
    : `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.1) 0%,transparent 55%),${CARD_BG}`
}

// Same glow keyed off a palette hex.
export function cardGlow(hex: string, hovered: boolean): string {
  return cardGlowRgb(toRgb(hex), hovered)
}
