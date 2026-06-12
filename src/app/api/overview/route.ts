import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS, CORE_MSA_ZIP_SET } from '@/lib/zips'

export async function GET(req: NextRequest) {
  try {
    const coverage = req.nextUrl.searchParams.get('coverage') ?? 'core'
    const allRows = await sql`SELECT * FROM zip_demographics ORDER BY zip`

    if (!allRows.length) {
      return NextResponse.json(
        { error: 'No data. Run POST /api/refresh first.' },
        { status: 404 }
      )
    }

    const rows = coverage === 'core'
      ? allRows.filter(d => CORE_MSA_ZIP_SET.has(d.zip))
      : allRows

    const pf = (v: unknown) => v != null ? parseFloat(String(v)) : 0

    const totalPop = rows.reduce((s, d) => s + (d.population ?? 0), 0)
    const totalHH  = rows.reduce((s, d) => s + (d.total_households ?? 0), 0)

    const wtdAvgHHI = Math.round(
      rows.reduce((s, d) => s + (d.median_household_income ?? 0) * (d.population ?? 0), 0) / totalPop
    )

    const growthRows = rows.filter(d => d.population_growth != null)
    const avgGrowth  = growthRows.length
      ? parseFloat((
          growthRows.reduce((s, d) => s + pf(d.population_growth) * (d.population ?? 0), 0) /
          growthRows.reduce((s, d) => s + (d.population ?? 0), 0)
        ).toFixed(1))
      : null

    const hhChildRows = rows.filter(d => d.hh_with_children_pct != null)
    const avgHHWithChildren = hhChildRows.length
      ? parseFloat((hhChildRows.reduce((s, d) => s + pf(d.hh_with_children_pct) * (d.total_households ?? 0), 0) / totalHH).toFixed(1))
      : null

    const hhSizeRows = rows.filter(d => d.avg_household_size != null)
    const avgHHSize  = hhSizeRows.length
      ? parseFloat((hhSizeRows.reduce((s, d) => s + pf(d.avg_household_size), 0) / hhSizeRows.length).toFixed(2))
      : null

    // Age distribution — population-weighted average
    const ageRows = rows.filter(d => d.age_0_17 != null)
    const agePop  = ageRows.reduce((s, d) => s + d.population, 0)
    const ageDistribution = agePop > 0 ? {
      age0_17:   parseFloat((ageRows.reduce((s, d) => s + pf(d.age_0_17)    * d.population, 0) / agePop).toFixed(1)),
      age18_34:  parseFloat((ageRows.reduce((s, d) => s + pf(d.age_18_34)   * d.population, 0) / agePop).toFixed(1)),
      age35_54:  parseFloat((ageRows.reduce((s, d) => s + pf(d.age_35_54)   * d.population, 0) / agePop).toFixed(1)),
      age55_74:  parseFloat((ageRows.reduce((s, d) => s + pf(d.age_55_74)   * d.population, 0) / agePop).toFixed(1)),
      age75plus: parseFloat((ageRows.reduce((s, d) => s + pf(d.age_75_plus) * d.population, 0) / agePop).toFixed(1)),
    } : null

    // Income distribution — household-weighted average
    const incomeDistribution = [
      { label: '<$25K',     pct: parseFloat((rows.reduce((s, d) => s + pf(d.income_lt25k)     * (d.total_households ?? 0), 0) / totalHH).toFixed(1)) },
      { label: '$25-50K',   pct: parseFloat((rows.reduce((s, d) => s + pf(d.income_25_50k)    * (d.total_households ?? 0), 0) / totalHH).toFixed(1)) },
      { label: '$50-75K',   pct: parseFloat((rows.reduce((s, d) => s + pf(d.income_50_75k)    * (d.total_households ?? 0), 0) / totalHH).toFixed(1)) },
      { label: '$75-100K',  pct: parseFloat((rows.reduce((s, d) => s + pf(d.income_75_100k)   * (d.total_households ?? 0), 0) / totalHH).toFixed(1)) },
      { label: '$100-150K', pct: parseFloat((rows.reduce((s, d) => s + pf(d.income_100_150k)  * (d.total_households ?? 0), 0) / totalHH).toFixed(1)) },
      { label: '$150K+',    pct: parseFloat((rows.reduce((s, d) => s + pf(d.income_150k_plus) * (d.total_households ?? 0), 0) / totalHH).toFixed(1)) },
    ]

    // Per-ZIP data
    const labelMap = Object.fromEntries(DFW_ZIPS.map(z => [z.zip, z.label]))
    const toZipRow = (d: typeof allRows[number]) => ({
      zip:                   d.zip,
      label:                 labelMap[d.zip] ?? d.name?.replace('ZCTA5 ', '') ?? d.zip,
      population:            d.population,
      populationGrowth:      d.population_growth != null ? pf(d.population_growth) : null,
      medianHouseholdIncome: d.median_household_income,
      hhWithChildrenPct:     d.hh_with_children_pct != null ? pf(d.hh_with_children_pct) : null,
      avgHouseholdSize:      d.avg_household_size   != null ? pf(d.avg_household_size)   : null,
      sesLabel:              d.ses_label,
      sesScore:              d.ses_score,
    })
    // coverage-filtered: used for the table and CSV export
    const zips = rows.map(toZipRow).sort((a, b) => (b.populationGrowth ?? -99) - (a.populationGrowth ?? -99))
    // always all ZIPs: used for the choropleth map so outer ZIPs stay colored regardless of coverage toggle
    const mapZips = allRows.map(toZipRow)

    const updatedAt = rows.reduce((latest: string | null, d) =>
      !latest || String(d.updated_at) > latest ? String(d.updated_at) : latest, null)

    return NextResponse.json({
      totals: { population: totalPop, zipCount: rows.length, avgGrowth, wtdAvgHHI, avgHHWithChildren, avgHHSize },
      ageDistribution,
      incomeDistribution,
      zips,
      mapZips,
      updatedAt,
    })
  } catch (error) {
    console.error('Overview error:', error)
    return NextResponse.json({ error: 'Failed to fetch overview data', details: String(error) }, { status: 500 })
  }
}
