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

// Ordinal ramps: index 0 = lowest/negative (darkest), last = highest/target (brightest).
// #F04B28 (Lakepointe Orange) appears ONLY as the top tier of any ordinal scale.
export const ordinalRamps = {
  growth: {
    declining:   '#33302C', // dark charcoal-taupe — recedes into basemap
    stable:      '#5C6470', // muted slate-gray — neutral, low salience
    growing:     '#D4883A', // warm amber — clearly "heating up"
    rapidGrowth: '#F04B28', // Lakepointe Orange — the target, brightest/warmest
  },
  ses: { // ordered low → high income
    lowerIncome: '#33302C',
    lowerMiddle: '#5C554B',
    middle:      '#8A7B63',
    upperMiddle: '#C4A97E',
    upper:       '#DED7CC', // brand Taupe — lightest; reads highest on dark bg
  },
  fitScore: { // ordered low → high
    tier0_44:  '#3F3B36',
    tier45_59: '#8A7B68',
    tier60_74: '#D4883A',
    tier75up:  '#F04B28',
  },
} as const

// Text-legible counterparts for dark surfaces. The ramp's low-end fills sit near
// the #323232 background and fall below WCAG AA as text — use these for colored
// text/badges/labels keyed to a tier. Order (lightness/warmth) is preserved.
export const ordinalTextColors = {
  growth: { declining: '#C45A46', stable: '#A89A88', growing: '#D4883A', rapidGrowth: '#F04B28' },
  ses:    { lowerIncome: '#A08E7A', lowerMiddle: '#A89A88', middle: '#B3A48C', upperMiddle: '#C4A97E', upper: '#DED7CC' },
  fitScore: { tier0_44: '#A08E7A', tier45_59: '#B3966E', tier60_74: '#D4883A', tier75up: '#F04B28' },
} as const

// Comma-separated RGB of the text-legible SES tier colors, for rgba() badge tints.
export const sesTierRgb: Record<keyof typeof ordinalRamps.ses, string> = {
  lowerIncome: '160,142,122',
  lowerMiddle: '168,154,136',
  middle:      '179,164,140',
  upperMiddle: '196,169,126',
  upper:       '222,215,204',
}

// Single source for the growth tier thresholds (map fill, legend, table text).
export type GrowthTier = keyof typeof ordinalRamps.growth
export const GROWTH_THRESHOLDS = { rapidGrowth: 20, growing: 8, stable: 0 } as const
export function growthTier(g: number | null): GrowthTier | null {
  if (g == null) return null
  if (g >= GROWTH_THRESHOLDS.rapidGrowth) return 'rapidGrowth'
  if (g >= GROWTH_THRESHOLDS.growing)     return 'growing'
  if (g >= GROWTH_THRESHOLDS.stable)      return 'stable'
  return 'declining'
}

// Fit Score tier resolution (Site Scorer + Overview insights).
export type FitTier = keyof typeof ordinalRamps.fitScore
export function fitTier(score: number): FitTier {
  if (score >= 75) return 'tier75up'
  if (score >= 60) return 'tier60_74'
  if (score >= 45) return 'tier45_59'
  return 'tier0_44'
}

// SES label (as stored in the DB / API payloads) → ramp key.
export const SES_TIER_KEY: Record<string, keyof typeof ordinalRamps.ses> = {
  'Upper':        'upper',
  'Upper Middle': 'upperMiddle',
  'Middle':       'middle',
  'Lower Middle': 'lowerMiddle',
  'Lower Income': 'lowerIncome',
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
