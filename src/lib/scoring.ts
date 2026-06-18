/**
 * Pure scoring math for the platform — the formulas that carry leadership
 * decisions (SES class, YFI/WFI, Site Scorer Fit Score, weighted aggregates).
 *
 * These functions take already-resolved numeric inputs and are deliberately
 * free of any DB / Next / React imports so they can be unit-tested in isolation
 * (see src/lib/scoring.test.ts). The call sites that fetch and null-coalesce the
 * raw data (lib/census.ts, api/site-scorer, api/overview, site-scorer page) import
 * from here so the tested math IS the production math — no forked copies.
 *
 * Documented at /methodology. SES uses ABSOLUTE caps (not percentiles) and YFI
 * uses the 0–17 age band — see CLAUDE.md "SES class scoring" / "YFI/WFI".
 */

// ── SES composite (income 50% · bachelor's 30% · home value 20%) ──────────────
// Absolute caps: income $200K, home value $800K, bachelor's rate ×2 (i.e. 50% → 100).
// Weighted contribution of each component toward the 0–100 score (income 0–50,
// bachelor's 0–30, home value 0–20). Their sum, rounded, is the SES score — so a
// UI can show the breakdown without forking the formula.
export interface SesComponents { income: number; bachelors: number; homeValue: number }
export function sesComponents(income: number, bachelorsRate: number, homeValue: number): SesComponents {
  return {
    income:    Math.min(100, (income / 200000) * 100)   * 0.5,
    bachelors: Math.min(100, bachelorsRate * 2)          * 0.3,
    homeValue: Math.min(100, (homeValue / 800000) * 100) * 0.2,
  }
}
export function sesScore(income: number, bachelorsRate: number, homeValue: number): number {
  const c = sesComponents(income, bachelorsRate, homeValue)
  return Math.round(c.income + c.bachelors + c.homeValue)
}

export function sesLabel(score: number): string {
  return score >= 78 ? 'Upper'
    : score >= 58 ? 'Upper Middle'
    : score >= 40 ? 'Middle'
    : score >= 25 ? 'Lower Middle'
    : 'Lower Income'
}

// ── Young Family Index (0–100) ────────────────────────────────────────────────
// 40% young-children share (/30%) · 25% family-HH rate (/40%) · 20% fertility
// (rate already ×100, /8%) · 15% HH size ((size−1.5)/2.0).
export interface YfiInputs {
  age0_17Pct: number          // % of population age 0–17
  familyHhPct: number         // married-with-children % + single-parent %
  fertilityPct: number        // fertility_rate × 100
  avgHouseholdSize: number
}
export function yfiScore(i: YfiInputs): number {
  return Math.round(
    Math.min(100, (i.age0_17Pct / 30) * 100)                            * 0.40 +
    Math.min(100, (i.familyHhPct / 40) * 100)                           * 0.25 +
    Math.min(100, (i.fertilityPct / 8) * 100)                           * 0.20 +
    Math.min(100, Math.max(0, ((i.avgHouseholdSize - 1.5) / 2.0) * 100)) * 0.15
  )
}

// ── Working Family Index (0–100) ──────────────────────────────────────────────
// 40% dual-earner (/40%) · 25% HH-with-children (/50%) · 20% commute-burden
// inverse (100 − commute30+%) · 15% bachelor's proxy (/50%).
export interface WfiInputs {
  dualEarnerPct: number
  hhWithChildrenPct: number
  commute30plusPct: number
  bachelorsRate: number
}
export function wfiScore(i: WfiInputs): number {
  return Math.round(
    Math.min(100, (i.dualEarnerPct / 40) * 100)     * 0.40 +
    Math.min(100, (i.hhWithChildrenPct / 50) * 100) * 0.25 +
    Math.max(0, 100 - i.commute30plusPct)            * 0.20 +
    Math.min(100, (i.bachelorsRate / 50) * 100)      * 0.15
  )
}

// ── Site Scorer component transforms ──────────────────────────────────────────
// Population growth → 0–100 (−10% → 0, +40% → 100).
export function growthScore(growthPct: number): number {
  return Math.min(100, Math.max(0, ((growthPct + 10) / 50) * 100))
}

// Church saturation OPPORTUNITY: inverts Christian-org density so low saturation
// scores high (30 churches/10K residents → 0 opportunity).
export function satOpportunityScore(churchesPer10k: number): number {
  return Math.max(0, 100 - Math.min(100, (churchesPer10k / 30) * 100))
}

// Distance to nearest existing campus → 0–100 (on a campus → 0; 30+ mi → 100).
export function distanceScore(miles: number): number {
  return Math.min(100, Math.max(0, (miles / 30) * 100))
}

// County ISD enrollment CAGR → 0–100 (CAGR × 12, clamped). years must be > 0.
export function enrollmentCagrScore(firstEnr: number, lastEnr: number, years: number): number {
  if (firstEnr <= 0 || lastEnr <= 0 || years <= 0) return 0
  const cagr = (Math.pow(lastEnr / firstEnr, 1 / years) - 1) * 100
  return Math.min(100, Math.max(0, Math.round(cagr * 12)))
}

// ── Fit Score weighting ───────────────────────────────────────────────────────
export interface Weights {
  yfi: number
  wfi: number
  ses: number
  growth: number
  saturation: number
  enrollment: number
  distance: number
}

// Normalize raw slider weights to percentages summing to 100.
export function effectivePct(w: Weights): Weights {
  const total = w.yfi + w.wfi + w.ses + w.growth + w.saturation + w.enrollment + w.distance || 1
  return {
    yfi:        (w.yfi / total) * 100,
    wfi:        (w.wfi / total) * 100,
    ses:        (w.ses / total) * 100,
    growth:     (w.growth / total) * 100,
    saturation: (w.saturation / total) * 100,
    enrollment: (w.enrollment / total) * 100,
    distance:   (w.distance / total) * 100,
  }
}

// Inputs the Fit Score reads off a scored ZIP. Growth/distance may be null
// (boundary-changed ZIPs / ZIPs with no centroid) — their weight is redistributed
// across the remaining signals rather than scored as zero.
export interface FitInputs {
  yfi: number
  wfi: number
  sesScore: number
  churchesPer10k: number
  populationGrowth: number | null
  enrollmentGrowthScore: number
  distanceToCampusMi: number | null
}

// `eff` is already-normalized percentages (from effectivePct). When growth or
// distance is null its weight drops out and the remaining signals rescale to 100.
export function computeFitScore(z: FitInputs, eff: Weights): number {
  const growthW = z.populationGrowth != null ? eff.growth : 0
  const distW = z.distanceToCampusMi != null ? eff.distance : 0
  const otherSum = eff.yfi + eff.wfi + eff.ses + eff.saturation + eff.enrollment
  const scale = (otherSum + growthW + distW) > 0 ? 100 / (otherSum + growthW + distW) : 1
  return Math.round((
    z.yfi * eff.yfi +
    z.wfi * eff.wfi +
    z.sesScore * eff.ses +
    satOpportunityScore(z.churchesPer10k) * eff.saturation +
    (z.populationGrowth != null ? growthScore(z.populationGrowth) * growthW : 0) +
    z.enrollmentGrowthScore * eff.enrollment +
    (z.distanceToCampusMi != null ? distanceScore(z.distanceToCampusMi) * distW : 0)
  ) * scale / 100)
}

// ── Weighted aggregate (Overview page) ────────────────────────────────────────
// Σ(value × weight) / Σ(weight); returns 0 when total weight is 0.
export function weightedMean(pairs: { value: number; weight: number }[]): number {
  let num = 0
  let den = 0
  for (const { value, weight } of pairs) { num += value * weight; den += weight }
  return den > 0 ? num / den : 0
}
