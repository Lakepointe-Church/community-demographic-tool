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

// Ordinal/diverging data scales (CIP spec v2 — brand-relaxed). CIP is internal-only:
// these prioritize instant readability of data weight over brand palette. Brand
// orange #F04B28 is reserved for UI chrome + campus markers — zero data encodings.
export const ordinalRamps = {
  // Final growth palette chosen by stakeholder (Jolie, 7/15/26) after reviewing
  // the first red/green pass live. Note: #AFA86B (growing) is lighter than
  // #7C9749 (rapid growth), so peak brightness sits on tier 3, not tier 4 —
  // if rapid growth doesn't pop enough in context, candidate tweak:
  // growing → '#8F8A54'. Stakeholder decision.
  growth: {
    declining:   '#9C3521', // deep red
    stable:      '#C38D2F', // amber
    growing:     '#AFA86B', // olive
    rapidGrowth: '#7C9749', // green
  },
  ses: { // sequential cool→warm, low→high; strong chroma for instant separation
    lowerIncome: '#1F3A5F', // deep navy
    lowerMiddle: '#2E6E8E', // ocean blue
    middle:      '#3FA79A', // teal
    upperMiddle: '#E0B84B', // gold
    upper:       '#F2E86D', // bright pale gold — top of scale, brightest
  },
  fitScore: { // ordered low → high; green-tinted top, consistent with growthScale
    tier0_44:  '#3F3B36',
    tier45_59: '#8A7B68',
    tier60_74: '#5FA05A',
    tier75up:  '#7ED957',
  },
} as const

// RELIGIOUS — single-series Islamic org concentration chart. The Islamic vs.
// Christian comparison is gone (Jolie, 7/15/26), so no red/green semantics;
// one neutral-strong hue from the growth-map palette family.
export const religiousOrgScale = {
  islamic: '#C38D2F', // amber
} as const

// Text-legible counterpart of religiousOrgScale for small labels/counts on dark.
export const religiousOrgTextColors = {
  islamic: '#D3A044',
} as const

// Text-legible counterparts for dark surfaces. The ramp's dark fills sit near the
// #323232 background and fall below WCAG AA as text — use these for colored
// text/badges/labels keyed to a tier. Order (lightness) is preserved.
export const ordinalTextColors = {
  growth: { declining: '#E07A64', stable: '#D3A044', growing: '#AFA86B', rapidGrowth: '#8FAD57' },
  ses:    { lowerIncome: '#7A9BC4', lowerMiddle: '#5FA3C4', middle: '#4FC2B3', upperMiddle: '#E0B84B', upper: '#F2E86D' },
  fitScore: { tier0_44: '#A08E7A', tier45_59: '#B3966E', tier60_74: '#6FB56A', tier75up: '#7ED957' },
} as const

// Comma-separated RGB of the text-legible SES tier colors, for rgba() badge tints.
export const sesTierRgb: Record<keyof typeof ordinalRamps.ses, string> = {
  lowerIncome: '122,155,196',
  lowerMiddle: '95,163,196',
  middle:      '79,194,179',
  upperMiddle: '224,184,75',
  upper:       '242,232,109',
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
