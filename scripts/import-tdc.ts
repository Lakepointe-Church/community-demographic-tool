/**
 * One-time loader for Texas Demographic Center (TDC) county population projections.
 * Vintage 2024 — covers all 254 TX counties, years 2020-2060.
 *
 * Run: npx tsx scripts/import-tdc.ts
 *
 * HOW TO DOWNLOAD THE TDC DATA:
 *   1. Go to: https://demographics.texas.gov/Projections/
 *   2. Download the "Vintage 2024" bulk zip archive for county-level projections
 *   3. Extract the zip — look for a file named like "countypopproj2024.csv"
 *      or similar (may vary by vintage)
 *   4. Save it as: data/tdc-projections-2024.csv
 *
 * Expected CSV columns (TDC Vintage 2024 format):
 *   - fips OR county_fips: 5-digit FIPS (e.g., "48085" for Collin)
 *   - county OR county_name: county name (e.g., "Collin")
 *   - year: projection year (integer)
 *   - scenario: migration scenario (use "mid", "1.0", or equivalent mid-range label)
 *   - total_pop OR population: total projected population (all ages, all sex)
 *
 * If column names differ, set env vars to override:
 *   COL_FIPS=fips_code COL_YEAR=proj_year COL_POP=total_population COL_SCENARIO=scen_id
 *
 * Only loads DFW-area counties. Re-run when TDC releases a new vintage (~every 2 years).
 */

import { readFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { neon } from '@neondatabase/serverless'

try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)
const DRY_RUN = process.env.DRY_RUN === '1'

const FILE_PATH = 'data/tdc-projections-2024.csv'

// DFW county FIPS codes
const DFW_COUNTY_FIPS = new Set([
  '48085', '48113', '48121', '48139', '48147', '48181', '48213',
  '48217', '48221', '48223', '48231', '48251', '48257', '48337',
  '48349', '48367', '48379', '48397', '48439', '48467', '48497',
  '48499', '48097',
])

// Mid-scenario labels used across TDC vintages
const MID_SCENARIO_LABELS = new Set([
  'mid', 'Mid', '1.0', '1', 'medium', 'middle', 'base', 'moderate',
  'mid migration', '1.0 migration', 'medium migration',
])

const TARGET_YEARS = new Set([2020, 2025, 2030, 2035, 2040, 2050])

function findCol(headers: string[], candidates: string[]): string {
  for (const c of candidates) {
    const h = headers.find(h => h.toLowerCase().replace(/[_ ]/g, '') === c.toLowerCase().replace(/[_ ]/g, ''))
    if (h) return h
  }
  return ''
}

async function run() {
  console.log('=== TDC County Projections Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  if (!existsSync(FILE_PATH)) {
    console.error(`File not found: ${FILE_PATH}`)
    console.error('Download Vintage 2024 projections from https://demographics.texas.gov/Projections/')
    console.error('Save the county-level CSV as data/tdc-projections-2024.csv')
    process.exit(1)
  }

  const content = readFileSync(FILE_PATH, 'utf8')
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]

  if (rows.length === 0) { console.error('File is empty'); process.exit(1) }

  const headers = Object.keys(rows[0])
  const colFips     = process.env.COL_FIPS     || findCol(headers, ['fips', 'countyfips', 'county_fips', 'geoid'])
  const colCounty   = process.env.COL_COUNTY   || findCol(headers, ['county', 'countyname', 'county_name', 'areaname', 'area_name'])
  const colYear     = process.env.COL_YEAR     || findCol(headers, ['year', 'projyear', 'proj_year'])
  const colPop      = process.env.COL_POP      || findCol(headers, ['totalpop', 'total_pop', 'population', 'pop', 'total'])
  const colScenario = process.env.COL_SCENARIO || findCol(headers, ['scenario', 'scen', 'migrationscenario', 'migration_scenario', 'migration', 'mig'])
  // age column: when present, only process the all-ages aggregate row (value "-1")
  const colAge      = process.env.COL_AGE      || findCol(headers, ['age', 'age_in_yrs_num', 'age_num', 'agegrp'])

  console.log(`Detected columns: fips="${colFips}" county="${colCounty}" year="${colYear}" pop="${colPop}" scenario="${colScenario || '(none)'}" age="${colAge || '(none)'}"`)

  if (!colFips || !colYear || !colPop) {
    console.error(`Could not find required columns. Available: ${headers.join(', ')}`)
    console.error('Set COL_FIPS, COL_YEAR, COL_POP env vars to override column names')
    process.exit(1)
  }

  // Accumulate: fips → year → population
  const data = new Map<string, { county: string; byYear: Map<number, number> }>()

  for (const row of rows) {
    const rawFips  = (row[colFips] ?? '').trim()
    // TDC uses 3-digit county codes; prepend TX state FIPS "48" to get 5-digit
    const fips     = rawFips.length <= 3 ? `48${rawFips.padStart(3, '0')}` : rawFips.padStart(5, '0')
    const yearStr  = (row[colYear] ?? '').trim()
    const popStr   = (row[colPop] ?? '').trim().replace(/[^0-9]/g, '')
    const scenario = colScenario ? (row[colScenario] ?? '').trim().toLowerCase() : 'mid'

    if (!DFW_COUNTY_FIPS.has(fips)) continue

    // If age column exists, only keep the all-ages aggregate row (value "-1")
    if (colAge && (row[colAge] ?? '').trim() !== '-1') continue

    // If scenario column exists, only keep mid scenario
    if (colScenario && !MID_SCENARIO_LABELS.has(scenario)) continue

    const year = parseInt(yearStr, 10)
    if (isNaN(year) || !TARGET_YEARS.has(year)) continue

    const pop = parseInt(popStr, 10)
    if (isNaN(pop) || pop <= 0) continue

    const county = colCounty ? (row[colCounty] ?? '').trim() : fips
    if (!data.has(fips)) data.set(fips, { county, byYear: new Map() })
    data.get(fips)!.byYear.set(year, pop)
  }

  if (data.size === 0) {
    console.error('No DFW county rows matched. Check file format and column names.')
    process.exit(1)
  }

  if (DRY_RUN) {
    console.log(`\nParsed ${data.size} DFW counties:`)
    for (const [fips, { county, byYear }] of data) {
      const years = [...byYear.entries()].sort((a, b) => a[0] - b[0])
      console.log(`  ${county} (${fips}): ${years.map(([y, p]) => `${y}=${p.toLocaleString()}`).join(', ')}`)
    }
    return
  }

  let inserted = 0
  for (const [fips, { county, byYear }] of data) {
    await sql`
      INSERT INTO county_projections (fips, county, base_2020, proj_2025, proj_2030, proj_2035, proj_2040, proj_2050, updated_at)
      VALUES (
        ${fips}, ${county},
        ${byYear.get(2020) ?? null},
        ${byYear.get(2025) ?? null},
        ${byYear.get(2030) ?? null},
        ${byYear.get(2035) ?? null},
        ${byYear.get(2040) ?? null},
        ${byYear.get(2050) ?? null},
        NOW()
      )
      ON CONFLICT (fips) DO UPDATE SET
        county     = EXCLUDED.county,
        base_2020  = EXCLUDED.base_2020,
        proj_2025  = EXCLUDED.proj_2025,
        proj_2030  = EXCLUDED.proj_2030,
        proj_2035  = EXCLUDED.proj_2035,
        proj_2040  = EXCLUDED.proj_2040,
        proj_2050  = EXCLUDED.proj_2050,
        updated_at = NOW()
    `
    inserted++
  }

  console.log(`\nDone — ${inserted} counties upserted`)
}

run().catch(e => { console.error(e); process.exit(1) })
