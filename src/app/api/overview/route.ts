import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { sql } from '@/lib/db'
import { DFW_ZIPS, CORE_MSA_ZIP_SET } from '@/lib/zips'
import { weightedMean } from '@/lib/scoring'

// Overview aggregates over all ~370 ZIPs (SELECT * + JS reduce) are identical
// between requests until the next data refresh. Cache the computed payload per
// coverage in Next's data cache; the refresh route busts it via revalidateTag.
// revalidate is a long backstop (data changes ~annually); the tag is the real
// freshness signal. OVERVIEW_TAG is re-exported for the refresh route.
export const OVERVIEW_TAG = 'overview'

export async function GET(req: NextRequest) {
  try {
    const coverage = req.nextUrl.searchParams.get('coverage') === 'all' ? 'all' : 'core'
    const payload = await getOverviewCached(coverage)
    if (!payload) {
      return NextResponse.json({ error: 'No data. Run POST /api/refresh first.' }, { status: 404 })
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Overview error:', error)
    return NextResponse.json({ error: 'Failed to fetch overview data', details: String(error) }, { status: 500 })
  }
}

const getOverviewCached = unstable_cache(
  (coverage: 'core' | 'all') => computeOverview(coverage),
  ['overview'],
  { revalidate: 86400, tags: [OVERVIEW_TAG] },
)

async function computeOverview(coverage: 'core' | 'all') {
  const allRows = await sql`SELECT * FROM zip_demographics ORDER BY zip`
  if (!allRows.length) return null

  const rows = coverage === 'core'
    ? allRows.filter(d => CORE_MSA_ZIP_SET.has(d.zip))
    : allRows

  const pf = (v: unknown) => v != null ? parseFloat(String(v)) : 0

  const totalPop = rows.reduce((s, d) => s + (d.population ?? 0), 0)
  const totalHH  = rows.reduce((s, d) => s + (d.total_households ?? 0), 0)

  // population-weighted mean income (denominator = Σ population over all rows = totalPop)
  const wtdAvgHHI = Math.round(
    weightedMean(rows.map(d => ({ value: d.median_household_income ?? 0, weight: d.population ?? 0 })))
  )

  const growthRows = rows.filter(d => d.population_growth != null)
  const avgGrowth  = growthRows.length
    ? parseFloat(
        weightedMean(growthRows.map(d => ({ value: pf(d.population_growth), weight: d.population ?? 0 }))).toFixed(1)
      )
    : null

  const hhChildRows = rows.filter(d => d.hh_with_children_pct != null)
  const avgHHWithChildren = hhChildRows.length
    ? parseFloat((hhChildRows.reduce((s, d) => s + pf(d.hh_with_children_pct) * (d.total_households ?? 0), 0) / totalHH).toFixed(1))
    : null

  const hhSizeRows = rows.filter(d => d.avg_household_size != null)
  const avgHHSize  = hhSizeRows.length
    ? parseFloat((hhSizeRows.reduce((s, d) => s + pf(d.avg_household_size), 0) / hhSizeRows.length).toFixed(2))
    : null

  // Age distribution — population-weighted average (denominator = Σ population over ageRows)
  const ageRows = rows.filter(d => d.age_0_17 != null)
  const agePop  = ageRows.reduce((s, d) => s + (d.population ?? 0), 0)
  const ageWtd = (col: string) =>
    parseFloat(weightedMean(ageRows.map(d => ({ value: pf(d[col]), weight: d.population ?? 0 }))).toFixed(1))
  const ageDistribution = agePop > 0 ? {
    age0_17:   ageWtd('age_0_17'),
    age18_34:  ageWtd('age_18_34'),
    age35_54:  ageWtd('age_35_54'),
    age55_74:  ageWtd('age_55_74'),
    age75plus: ageWtd('age_75_plus'),
  } : null

  // Income distribution — household-weighted average (denominator = Σ households over all rows = totalHH)
  const incWtd = (col: string) =>
    parseFloat(weightedMean(rows.map(d => ({ value: pf(d[col]), weight: d.total_households ?? 0 }))).toFixed(1))
  const incomeDistribution = [
    { label: '<$25K',     pct: incWtd('income_lt25k') },
    { label: '$25-50K',   pct: incWtd('income_25_50k') },
    { label: '$50-75K',   pct: incWtd('income_50_75k') },
    { label: '$75-100K',  pct: incWtd('income_75_100k') },
    { label: '$100-150K', pct: incWtd('income_100_150k') },
    { label: '$150K+',    pct: incWtd('income_150k_plus') },
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

  return {
    totals: { population: totalPop, zipCount: rows.length, avgGrowth, wtdAvgHHI, avgHHWithChildren, avgHHSize },
    ageDistribution,
    incomeDistribution,
    zips,
    mapZips,
    updatedAt,
  }
}
