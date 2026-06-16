/**
 * Annual loader for U.S. Census Bureau Building Permits Survey (BPS) — place level.
 * Fetches the December year-to-date file (full year) from the South Region directory.
 *
 * Run: npx tsx scripts/import-bps-places.ts
 *
 * Data location:
 *   https://www2.census.gov/econ/bps/Place/South%20Region/so{YY}12y.txt
 *
 * File format (CSV, 3 header lines to skip):
 *   Line 0: Category label row (Survey, State, 6-Digit, County, Census Place, FIPS Place, ...)
 *   Line 1: Column detail row (Date, Code, ID, Code, Code, Code, ..., Name, Bldgs, Units, Value, ...)
 *   Line 2: Blank
 *   Data rows, 0-indexed:
 *     col[0]  Survey date (YYYYMM)
 *     col[1]  State FIPS code ("48" for Texas)
 *     col[2]  6-digit ID
 *     col[3]  County FIPS code (3-digit)
 *     col[4]  Census Place code
 *     col[5]  FIPS Place code
 *     col[6]  FIPS MCD code
 *     col[7]  Population
 *     col[8]  CSA code
 *     col[9]  CBSA code
 *     col[10] Footnote code
 *     col[11] Central city flag
 *     col[12] ZIP code (may have ZIP+4 digits appended; take first 5)
 *     col[13] Region code
 *     col[14] Division code
 *     col[15] Number of months represented
 *     col[16] Place name
 *     col[17] 1-unit buildings
 *     col[18] 1-unit units  ← single-family permits
 *     col[19] 1-unit value
 *     col[20] 2-unit buildings
 *     col[21] 2-unit units
 *     col[22] 2-unit value
 *     col[23] 3-4-unit buildings
 *     col[24] 3-4-unit units
 *     col[25] 3-4-unit value
 *     col[26] 5+-unit buildings
 *     col[27] 5+-unit units  ← large MF permits
 *     col[28] 5+-unit value
 */

import { readFileSync, existsSync } from 'fs'
import { neon } from '@neondatabase/serverless'

try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)
const DRY_RUN = process.env.DRY_RUN === '1'

// DFW county FIPS (3-digit county portion only, state 48)
const DFW_COUNTY_FIPS: Record<string, string> = {
  '085': 'Collin',
  '097': 'Cooke',
  '113': 'Dallas',
  '121': 'Denton',
  '139': 'Ellis',
  '147': 'Fannin',
  '181': 'Grayson',
  '213': 'Henderson',
  '217': 'Hill',
  '221': 'Hood',
  '223': 'Hopkins',
  '231': 'Hunt',
  '251': 'Johnson',
  '257': 'Kaufman',
  '337': 'Montague',
  '349': 'Navarro',
  '367': 'Parker',
  '379': 'Rains',
  '397': 'Rockwall',
  '439': 'Tarrant',
  '467': 'Van Zandt',
  '497': 'Wise',
  '499': 'Wood',
}

const YEARS = [2025, 2024, 2023]

type PlaceRow = {
  stateFips: string
  placeFips: string
  placeName: string
  countyFips: string
  county: string
  sf: number
  mf: number
  total: number
}

function bpsPlaceUrl(year: number): string {
  const y2 = String(year).slice(2) // "24"
  return `https://www2.census.gov/econ/bps/Place/South%20Region/so${y2}12y.txt`
}

function parsePlaceFile(text: string): PlaceRow[] {
  const lines = text.split('\n')
  const results: PlaceRow[] = []

  // First 3 lines: header row 1, header row 2, blank — skip
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(',')
    if (cols.length < 28) continue

    const stateFips  = cols[1].trim()
    const countyFips = cols[3].trim()

    if (stateFips !== '48') continue
    const county = DFW_COUNTY_FIPS[countyFips]
    if (!county) continue

    const placeFips = cols[5].trim().padStart(5, '0').slice(0, 5)
    const placeName = cols[16].trim()
    if (!placeName) continue

    const sf   = parseInt(cols[18] ?? '0', 10) || 0  // 1-unit units
    const mf2  = parseInt(cols[21] ?? '0', 10) || 0  // 2-unit units
    const mf34 = parseInt(cols[24] ?? '0', 10) || 0  // 3-4-unit units
    const mf5  = parseInt(cols[27] ?? '0', 10) || 0  // 5+-unit units
    const mf   = mf2 + mf34 + mf5
    const total = sf + mf

    results.push({ stateFips, placeFips, placeName, countyFips, county, sf, mf, total })
  }

  return results
}

async function fetchPlaceYear(year: number): Promise<PlaceRow[]> {
  const localPath = `data/bps-places-${year}.txt`

  if (existsSync(localPath)) {
    console.log(`  Using local file: ${localPath}`)
    const text = readFileSync(localPath, 'utf8')
    return parsePlaceFile(text)
  }

  const url = bpsPlaceUrl(year)
  console.log(`  Fetching: ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`    → ${res.status} — save manually as ${localPath} and re-run`)
      return []
    }
    const text = await res.text()
    return parsePlaceFile(text)
  } catch (e) {
    console.warn(`    → fetch error: ${e}`)
    return []
  }
}

async function run() {
  console.log('=== BPS Place-Level Building Permits Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  let inserted = 0

  for (const year of YEARS) {
    console.log(`\n${year}:`)
    try {
      const rows = await fetchPlaceYear(year)
      if (rows.length === 0) {
        console.warn(`  No DFW rows parsed for ${year}`)
        continue
      }

      if (DRY_RUN) {
        console.log(`  ${rows.length} DFW place rows parsed`)
        rows.sort((a, b) => b.total - a.total).slice(0, 10).forEach(r =>
          console.log(`  ${r.placeName.padEnd(30)} county=${r.county} SF=${r.sf} MF=${r.mf} Total=${r.total}`)
        )
        continue
      }

      for (const r of rows) {
        await sql`
          INSERT INTO place_permits
            (state_fips, place_fips, place_name, county_fips, county, year, sf_permits, mf_permits, total_permits, updated_at)
          VALUES
            (${'48'}, ${r.placeFips}, ${r.placeName}, ${r.countyFips}, ${r.county}, ${year},
             ${r.sf}, ${r.mf}, ${r.total}, NOW())
          ON CONFLICT (state_fips, place_fips, year) DO UPDATE SET
            place_name    = EXCLUDED.place_name,
            county_fips   = EXCLUDED.county_fips,
            county        = EXCLUDED.county,
            sf_permits    = EXCLUDED.sf_permits,
            mf_permits    = EXCLUDED.mf_permits,
            total_permits = EXCLUDED.total_permits,
            updated_at    = NOW()
        `
        inserted++
      }
      console.log(`  ✓ ${rows.length} places upserted`)
    } catch (err) {
      console.error(`  ✗ ${err}`)
    }
  }

  if (!DRY_RUN) console.log(`\nDone — ${inserted} rows upserted`)
}

run().catch(e => { console.error(e); process.exit(1) })
