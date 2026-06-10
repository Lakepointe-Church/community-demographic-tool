import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        fips, county, region, population, total_adherents, unclaimed,
        evangelical, mainline_protestant, black_protestant,
        catholic, orthodox, jewish, buddhist, hindu, muslim,
        other_christian, other, congregations
      FROM religious_adherence
      ORDER BY
        CASE region WHEN 'core_msa' THEN 0 ELSE 1 END,
        unclaimed::float / NULLIF(population, 0) DESC
    `

    // DFW core MSA weighted summary (for stat cards)
    const core = rows.filter(r => r.region === 'core_msa')
    const totalPop       = core.reduce((s, r) => s + (r.population       || 0), 0)
    const totalUnclaimed = core.reduce((s, r) => s + (r.unclaimed        || 0), 0)
    const totalMuslim    = core.reduce((s, r) => s + (r.muslim           || 0), 0)
    const totalCatholic  = core.reduce((s, r) => s + (r.catholic         || 0), 0)
    const totalEvangelical = core.reduce((s, r) => s + (r.evangelical    || 0), 0)

    return NextResponse.json({
      counties: rows,
      summary: {
        total_population:   totalPop,
        total_unclaimed:    totalUnclaimed,
        unclaimed_pct:      totalPop > 0 ? (totalUnclaimed / totalPop) * 100 : 0,
        muslim_pct:         totalPop > 0 ? (totalMuslim    / totalPop) * 100 : 0,
        catholic_pct:       totalPop > 0 ? (totalCatholic  / totalPop) * 100 : 0,
        evangelical_pct:    totalPop > 0 ? (totalEvangelical / totalPop) * 100 : 0,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'religious_adherence table not yet populated — run scripts/import-religion-census.ts' },
      { status: 503 },
    )
  }
}
