/**
 * Annual loader for U.S. Census Bureau Building Permits Survey (BPS) — county level.
 * Fetches the December annual file (year-to-date = full year) from census.gov.
 *
 * Run: npx tsx scripts/import-permits.ts
 *
 * Data location: https://www2.census.gov/econ/bps/County/co{YY}{MM}y.txt
 * Year-to-date files: "y" suffix = cumulative YTD; December = full year.
 *
 * File format (CSV, 3 header lines to skip):
 *   Header 1: category labels
 *   Header 2: column labels
 *   Header 3: blank
 *   Data rows, zero-indexed:
 *     col[0]  Survey date (YYYYMM)
 *     col[1]  State FIPS (2-char, "48" for Texas)
 *     col[2]  County FIPS (3-char)
 *     col[3]  Region code
 *     col[4]  Division code
 *     col[5]  County name (padded)
 *     col[6]  1-unit buildings
 *     col[7]  1-unit units  ← single-family permits
 *     col[8]  1-unit value
 *     col[9]  2-unit buildings
 *     col[10] 2-unit units
 *     col[11] 2-unit value
 *     col[12] 3-4-unit buildings
 *     col[13] 3-4-unit units
 *     col[14] 3-4-unit value
 *     col[15] 5+-unit buildings
 *     col[16] 5+-unit units ← large MF permits
 *     col[17] 5+-unit value
 *     (remaining columns are "rep" estimates — not used)
 *
 * If a URL returns 404, save data/bps-county-{year}.txt (same format) and re-run.
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

// DFW county FIPS codes (3-digit county portion only)
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

function bpsUrl(year: number): string {
  const y2 = String(year).slice(2) // "24"
  return `https://www2.census.gov/econ/bps/County/co${y2}12y.txt`
}

function parseBpsFile(text: string, year: number): { fips: string; county: string; sf: number; mf: number; total: number }[] {
  const lines = text.split('\n')
  const results: { fips: string; county: string; sf: number; mf: number; total: number }[] = []

  // First 3 lines: header row 1, header row 2, blank — skip them
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(',')
    if (cols.length < 17) continue

    const stateFp  = cols[1].trim()
    const countyFp = cols[2].trim()

    if (stateFp !== '48') continue
    const countyName = DFW_COUNTY_FIPS[countyFp]
    if (!countyName) continue

    const sf   = parseInt(cols[7]  ?? '0', 10) || 0  // 1-unit units
    const mf2  = parseInt(cols[10] ?? '0', 10) || 0  // 2-unit units
    const mf34 = parseInt(cols[13] ?? '0', 10) || 0  // 3-4-unit units
    const mf5  = parseInt(cols[16] ?? '0', 10) || 0  // 5+-unit units
    const mf   = mf2 + mf34 + mf5
    const total = sf + mf

    if (DRY_RUN) console.log(`  ${countyName} (48${countyFp}): SF=${sf} MF=${mf} Total=${total}`)

    results.push({ fips: `48${countyFp}`, county: countyName, sf, mf, total })
  }

  return results
}

async function fetchBpsYear(year: number): Promise<{ fips: string; county: string; sf: number; mf: number; total: number }[]> {
  const localPath = `data/bps-county-${year}.txt`

  // Try local file first
  if (existsSync(localPath)) {
    console.log(`  Using local file: ${localPath}`)
    const text = readFileSync(localPath, 'utf8')
    return parseBpsFile(text, year)
  }

  // Fetch from Census Bureau
  const url = bpsUrl(year)
  console.log(`  Fetching: ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`    → ${res.status} — save manually as ${localPath} and re-run`)
      return []
    }
    const text = await res.text()
    return parseBpsFile(text, year)
  } catch (e) {
    console.warn(`    → fetch error: ${e}`)
    return []
  }
}

async function run() {
  console.log('=== BPS Building Permits Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  let inserted = 0

  for (const year of YEARS) {
    console.log(`\n${year}:`)
    try {
      const rows = await fetchBpsYear(year)
      if (rows.length === 0) {
        console.warn(`  No DFW rows parsed for ${year}`)
        continue
      }
      if (DRY_RUN) { console.log(`  ${rows.length} rows parsed`); continue }

      for (const r of rows) {
        await sql`
          INSERT INTO county_permits (fips, county, year, sf_permits, mf_permits, total_permits, updated_at)
          VALUES (${r.fips}, ${r.county}, ${year}, ${r.sf}, ${r.mf}, ${r.total}, NOW())
          ON CONFLICT (fips, year) DO UPDATE SET
            sf_permits    = EXCLUDED.sf_permits,
            mf_permits    = EXCLUDED.mf_permits,
            total_permits = EXCLUDED.total_permits,
            updated_at    = NOW()
        `
        inserted++
      }
      console.log(`  ✓ ${rows.length} counties upserted`)
    } catch (err) {
      console.error(`  ✗ ${err}`)
    }
  }

  if (!DRY_RUN) console.log(`\nDone — ${inserted} rows upserted`)
}

run().catch(e => { console.error(e); process.exit(1) })
