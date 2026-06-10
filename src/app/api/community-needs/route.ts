import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ZIP_GROUPS, CORE_MSA_ZIP_SET } from '@/lib/zips'

const ZIP_LABEL: Record<string, string> = {}
for (const group of ZIP_GROUPS) {
  for (const z of group.zips) ZIP_LABEL[z.zip] = z.label
}

const HEALTH_COLS = ['diabetes','obesity','smoking','uninsured','high_blood_pressure','depression','mental_distress','phys_inactivity','gen_poor_health'] as const

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter(n => n != null) as number[]
  return valid.length ? parseFloat((valid.reduce((s, n) => s + n, 0) / valid.length).toFixed(1)) : null
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')

  if (zip) {
    const rows = await sql`
      SELECT ch.*, d.population, d.median_household_income, d.ses_label
      FROM community_health ch
      LEFT JOIN zip_demographics d ON d.zip = ch.zip
      WHERE ch.zip = ${zip}
      LIMIT 1
    `
    if (!rows.length) return NextResponse.json({ error: 'No data' }, { status: 404 })
    const r = rows[0]
    const pop = r.population ?? 0
    return NextResponse.json({
      zip: r.zip,
      name: ZIP_LABEL[r.zip] ?? r.zip,
      diabetes:          r.diabetes != null ? parseFloat(r.diabetes) : null,
      obesity:           r.obesity != null ? parseFloat(r.obesity) : null,
      smoking:           r.smoking != null ? parseFloat(r.smoking) : null,
      uninsured:         r.uninsured != null ? parseFloat(r.uninsured) : null,
      highBloodPressure: r.high_blood_pressure != null ? parseFloat(r.high_blood_pressure) : null,
      depression:        r.depression != null ? parseFloat(r.depression) : null,
      mentalDistress:    r.mental_distress != null ? parseFloat(r.mental_distress) : null,
      physInactivity:    r.phys_inactivity != null ? parseFloat(r.phys_inactivity) : null,
      genPoorHealth:     r.gen_poor_health != null ? parseFloat(r.gen_poor_health) : null,
      cfpbComplaints:    r.cfpb_complaints,
      cfpbPer1k:         pop > 0 && r.cfpb_complaints ? parseFloat(((r.cfpb_complaints / pop) * 1000).toFixed(1)) : null,
      population:        r.population,
      sesLabel:          r.ses_label,
    })
  }

  const coverage = req.nextUrl.searchParams.get('coverage') ?? 'core'

  // DFW overview
  const allRows = await sql`
    SELECT ch.*, d.population
    FROM community_health ch
    LEFT JOIN zip_demographics d ON d.zip = ch.zip
    WHERE ch.diabetes IS NOT NULL
  `
  const rows = coverage === 'core'
    ? allRows.filter(r => CORE_MSA_ZIP_SET.has(r.zip))
    : allRows

  const overview: Record<string, (number | null)[]> = Object.fromEntries(HEALTH_COLS.map(c => [c, []]))
  let totalComplaints = 0, totalPop = 0, coveredZips = 0

  for (const r of rows) {
    for (const col of HEALTH_COLS) {
      const v = r[col]
      if (v != null) overview[col].push(parseFloat(v))
    }
    totalComplaints += r.cfpb_complaints ?? 0
    totalPop += r.population ?? 0
    coveredZips++
  }

  return NextResponse.json({
    zipCount: coveredZips,
    avgDiabetes:       avg(overview.diabetes),
    avgObesity:        avg(overview.obesity),
    avgSmoking:        avg(overview.smoking),
    avgUninsured:      avg(overview.uninsured),
    avgHighBP:         avg(overview.high_blood_pressure),
    avgDepression:     avg(overview.depression),
    avgMentalDistress: avg(overview.mental_distress),
    avgPhysInactivity: avg(overview.phys_inactivity),
    avgGenPoorHealth:  avg(overview.gen_poor_health),
    totalComplaints,
    complaintsPer1k:   totalPop > 0 ? parseFloat(((totalComplaints / totalPop) * 1000).toFixed(1)) : null,
    // All ZIPs for map/table view
    zips: rows.map(r => ({
      zip: r.zip,
      name: ZIP_LABEL[r.zip] ?? r.zip,
      diabetes:          r.diabetes != null ? parseFloat(r.diabetes) : null,
      obesity:           r.obesity != null ? parseFloat(r.obesity) : null,
      uninsured:         r.uninsured != null ? parseFloat(r.uninsured) : null,
      depression:        r.depression != null ? parseFloat(r.depression) : null,
      mentalDistress:    r.mental_distress != null ? parseFloat(r.mental_distress) : null,
      cfpbComplaints:    r.cfpb_complaints,
      population:        r.population,
    })),
  })
}
