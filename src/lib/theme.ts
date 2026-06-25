// Design tokens — Lakepointe Church brand-dark theme.
// Pure constants (no React/DOM imports) so they're usable anywhere.

export const colors = {
  // Surfaces — brand-dark (#323232 base per Lakepointe brand guide)
  bg:         '#323232',
  surface:    '#3C3C3C',
  border:     '#4A4A4A',
  borderSub:  '#424242',

  // Accent palette — Lakepointe Orange as primary, warm-earth family
  gold:       '#F04B28', // Lakepointe Orange (primary accent — replaces legacy gold)
  blue:       '#7AA3AA', // Brand Slate Blue (support/secondary)
  teal:       '#D4883A', // Warm Amber (chart series 3)
  coral:      '#C45A46', // Terracotta (alert / negative / chart series 4)
  purple:     '#7A9E8A', // Earthy Sage (chart series 5)

  // Text — warm neutrals on dark gray
  textStrong: '#FFFFFF',
  text:       '#E8DDD0', // warm taupe-white
  label:      '#C8BCA8', // warm label
  muted:      '#A89A88', // ~4.9:1 on #323232 — passes WCAG AA
  footer:     '#B4A490', // ~5.5:1 on #323232 — passes WCAG AA
  faint:      '#A08E7A', // ~4.6:1 on #323232 — AA floor
} as const

export const fonts = {
  display: "'Gotham','Futura','Avenir','Century Gothic','Helvetica Neue',Helvetica,sans-serif",
  mono:    "'Gotham','Futura','Avenir','Century Gothic','Helvetica Neue',Helvetica,sans-serif",
  sans:    "'Gotham','Futura','Avenir','Century Gothic','Helvetica Neue',Helvetica,sans-serif",
} as const

// Comma-separated RGB strings for rgba() composition (radial-glow cards).
export const rgbMap: Record<string, string> = {
  [colors.gold]:   '240,75,40',
  [colors.blue]:   '122,163,170',
  [colors.teal]:   '212,136,58',
  [colors.purple]: '122,158,138',
  [colors.coral]:  '196,90,70',
}

// Returns the comma-separated RGB for a hex from the palette (defaults to orange).
export function toRgb(hex: string): string {
  return rgbMap[hex] ?? rgbMap[colors.gold]
}

// Flat surface gradient used by Surface panels + stat-card base layer.
export const CARD_BG =
  'linear-gradient(145deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.015) 100%)'

// Stat-card radial-glow background (idle vs hovered) from a comma-separated
// RGB string (e.g. '240,75,40').
export function cardGlowRgb(rgb: string, hovered: boolean): string {
  return hovered
    ? `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.22) 0%,transparent 60%),linear-gradient(145deg,rgba(${rgb},0.08) 0%,rgba(255,255,255,0.01) 100%)`
    : `radial-gradient(ellipse at 50% 0%,rgba(${rgb},0.1) 0%,transparent 55%),${CARD_BG}`
}

// Same glow keyed off a palette hex.
export function cardGlow(hex: string, hovered: boolean): string {
  return cardGlowRgb(toRgb(hex), hovered)
}
