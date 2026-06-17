import { describe, it, expect } from 'vitest'
import {
  sesScore, sesLabel,
  yfiScore, wfiScore,
  growthScore, satOpportunityScore, distanceScore, enrollmentCagrScore,
  effectivePct, computeFitScore, weightedMean,
  type Weights,
} from './scoring'

// All expected values below are computed by hand from the formulas documented
// at /methodology — these are regression fixtures, not assertions copied from output.

describe('sesScore (income 50% · bachelor 30% · home 20%, absolute caps)', () => {
  it('caps each component at 100 → max score 100', () => {
    // income $200K, bachelor 50%, home $800K all hit the cap
    expect(sesScore(200_000, 50, 800_000)).toBe(100)
    // over the caps still 100
    expect(sesScore(300_000, 80, 1_000_000)).toBe(100)
  })
  it('half of every cap → 50', () => {
    // 100K/200K=50 ×.5=25 ; 25%×2=50 ×.3=15 ; 400K/800K=50 ×.2=10 → 50
    expect(sesScore(100_000, 25, 400_000)).toBe(50)
  })
  it('low inputs round correctly', () => {
    // 25×.5=12.5 ; 20×.3=6 ; 25×.2=5 → 23.5 → round 24
    expect(sesScore(50_000, 10, 200_000)).toBe(24)
  })
  it('zeros → 0', () => {
    expect(sesScore(0, 0, 0)).toBe(0)
  })
})

describe('sesLabel thresholds', () => {
  it('maps scores to the five classes at the documented boundaries', () => {
    expect(sesLabel(100)).toBe('Upper')
    expect(sesLabel(78)).toBe('Upper')
    expect(sesLabel(77)).toBe('Upper Middle')
    expect(sesLabel(58)).toBe('Upper Middle')
    expect(sesLabel(57)).toBe('Middle')
    expect(sesLabel(40)).toBe('Middle')
    expect(sesLabel(39)).toBe('Lower Middle')
    expect(sesLabel(25)).toBe('Lower Middle')
    expect(sesLabel(24)).toBe('Lower Income')
    expect(sesLabel(0)).toBe('Lower Income')
  })
})

describe('yfiScore (0–17 band)', () => {
  it('all components at cap → 100', () => {
    expect(yfiScore({ age0_17Pct: 30, familyHhPct: 40, fertilityPct: 8, avgHouseholdSize: 3.5 })).toBe(100)
  })
  it('half of every cap → 50', () => {
    // 15/30=50 ×.40=20 ; 20/40=50 ×.25=12.5 ; 4/8=50 ×.20=10 ; (2.5-1.5)/2=50 ×.15=7.5 → 50
    expect(yfiScore({ age0_17Pct: 15, familyHhPct: 20, fertilityPct: 4, avgHouseholdSize: 2.5 })).toBe(50)
  })
  it('household size below 1.5 floors that component at 0 (no negative)', () => {
    expect(yfiScore({ age0_17Pct: 0, familyHhPct: 0, fertilityPct: 0, avgHouseholdSize: 1.0 })).toBe(0)
  })
})

describe('wfiScore', () => {
  it('all components at cap → 100 (zero commute = full inverse credit)', () => {
    expect(wfiScore({ dualEarnerPct: 40, hhWithChildrenPct: 50, commute30plusPct: 0, bachelorsRate: 50 })).toBe(100)
  })
  it('half of every cap → 50', () => {
    // 20/40=50 ×.40=20 ; 25/50=50 ×.25=12.5 ; (100-50)=50 ×.20=10 ; 25/50=50 ×.15=7.5 → 50
    expect(wfiScore({ dualEarnerPct: 20, hhWithChildrenPct: 25, commute30plusPct: 50, bachelorsRate: 25 })).toBe(50)
  })
  it('commute over 100% floors the inverse component at 0', () => {
    expect(wfiScore({ dualEarnerPct: 0, hhWithChildrenPct: 0, commute30plusPct: 120, bachelorsRate: 0 })).toBe(0)
  })
})

describe('Site Scorer component transforms', () => {
  it('growthScore: −10% → 0, +40% → 100, midpoint, clamps both ends', () => {
    expect(growthScore(-10)).toBe(0)
    expect(growthScore(40)).toBe(100)
    expect(growthScore(15)).toBe(50)
    expect(growthScore(0)).toBe(20)
    expect(growthScore(-25)).toBe(0)
    expect(growthScore(100)).toBe(100)
  })
  it('satOpportunityScore: inverts density, 30/10K → 0, 0 → 100', () => {
    expect(satOpportunityScore(0)).toBe(100)
    expect(satOpportunityScore(30)).toBe(0)
    expect(satOpportunityScore(15)).toBe(50)
    expect(satOpportunityScore(60)).toBe(0)
  })
  it('distanceScore: on-campus → 0, 30mi → 100, clamps', () => {
    expect(distanceScore(0)).toBe(0)
    expect(distanceScore(30)).toBe(100)
    expect(distanceScore(15)).toBe(50)
    expect(distanceScore(45)).toBe(100)
  })
  it('enrollmentCagrScore: flat → 0, strong growth clamps to 100, small growth rounds', () => {
    expect(enrollmentCagrScore(100, 100, 4)).toBe(0)
    expect(enrollmentCagrScore(100, 200, 4)).toBe(100)       // ~18.9% CAGR ×12 → clamp
    expect(enrollmentCagrScore(1000, 1020, 4)).toBe(6)       // ~0.496% CAGR ×12 ≈ 5.96 → 6
    expect(enrollmentCagrScore(0, 500, 4)).toBe(0)           // invalid first
    expect(enrollmentCagrScore(100, 200, 0)).toBe(0)         // invalid years
  })
})

describe('effectivePct (normalize raw weights to sum 100)', () => {
  it('weights already summing to 100 are returned as the same percentages', () => {
    const w: Weights = { yfi: 23, wfi: 23, ses: 18, growth: 14, saturation: 12, enrollment: 10, distance: 0 }
    const e = effectivePct(w)
    // float-safe per field (e.g. 14×100/100 = 14.000000000000002)
    for (const k of Object.keys(w) as (keyof Weights)[]) expect(e[k]).toBeCloseTo(w[k], 10)
  })
  it('rescales when total ≠ 100', () => {
    const w: Weights = { yfi: 10, wfi: 10, ses: 10, growth: 10, saturation: 10, enrollment: 10, distance: 10 }
    const e = effectivePct(w) // total 70 → each 14.2857
    expect(e.yfi).toBeCloseTo(100 / 7, 5)
    const sum = Object.values(e).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(100, 5)
  })
  it('all-zero weights do not divide by zero', () => {
    const z: Weights = { yfi: 0, wfi: 0, ses: 0, growth: 0, saturation: 0, enrollment: 0, distance: 0 }
    expect(effectivePct(z).yfi).toBe(0)
  })
})

describe('computeFitScore', () => {
  const eff: Weights = { yfi: 23, wfi: 23, ses: 18, growth: 14, saturation: 12, enrollment: 10, distance: 0 }
  const base = { yfi: 80, wfi: 70, sesScore: 60, churchesPer10k: 15, enrollmentGrowthScore: 40 }

  it('combines components against normalized weights', () => {
    // 80×23+70×23+60×18+satOpp(15)=50×12+growth(15)=50×14+40×10 = 6230 ; scale 1 → 62.3 → 62
    expect(computeFitScore({ ...base, populationGrowth: 15, distanceToCampusMi: null }, eff)).toBe(62)
  })
  it('redistributes a null growth weight instead of scoring it as zero', () => {
    // growth drops out: numerator 5530, denom 86 → 5530/86 = 64.30 → 64 (higher, not penalized)
    expect(computeFitScore({ ...base, populationGrowth: null, distanceToCampusMi: null }, eff)).toBe(64)
  })
})

describe('weightedMean', () => {
  it('computes Σ(value×weight)/Σ(weight)', () => {
    expect(weightedMean([{ value: 100, weight: 1 }, { value: 200, weight: 3 }])).toBe(175)
  })
  it('returns 0 when total weight is 0', () => {
    expect(weightedMean([{ value: 5, weight: 0 }])).toBe(0)
    expect(weightedMean([])).toBe(0)
  })
})
