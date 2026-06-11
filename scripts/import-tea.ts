/**
 * Annual loader for Texas Education Agency (TEA) TAPR district enrollment data.
 * Processes manually downloaded Student Information CSVs (one per school year).
 *
 * Run: npx tsx scripts/import-tea.ts
 *
 * HOW TO DOWNLOAD:
 *   1. Go to: https://tea.texas.gov/reports-and-data/performance-reporting/texas-academic-performance-reports
 *   2. Select year → Download All: Districts → Category: Student Information → Next
 *   3. Save as data/tea-enrollment-{YYYY}.csv  (YYYY = spring year: 2025 = "2024-25")
 *
 * FILE FORMAT:
 *   Row 0: human-readable column labels (skipped)
 *   Row 1: variable names (DISTRICT, DISTNAME, DPETALLC, ...)
 *   Row 2+: data rows
 *
 *   Key variables:
 *     DISTRICT   — 6-digit code; first 3 digits = TEA county code
 *     DISTNAME   — district name
 *     DPETALLC   — total student membership (enrollment count)
 */

import { readFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { neon } from '@neondatabase/serverless'

try {
  readFileSync('.env.local', 'utf8').split('\n').forEach((line: string) => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)
const DRY_RUN = process.env.DRY_RUN === '1'

// TEA 3-digit county code (first 3 chars of DISTRICT) → standard county name
const TEA_COUNTY_MAP: Record<string, string> = {
  '043': 'Collin',
  '049': 'Cooke',
  '057': 'Dallas',
  '061': 'Denton',
  '070': 'Ellis',
  '074': 'Fannin',
  '091': 'Grayson',
  '107': 'Henderson',
  '109': 'Hill',
  '111': 'Hood',
  '112': 'Hopkins',
  '116': 'Hunt',
  '126': 'Johnson',
  '129': 'Kaufman',
  '169': 'Montague',
  '175': 'Navarro',
  '184': 'Parker',
  '190': 'Rains',
  '199': 'Rockwall',
  '220': 'Tarrant',
  '234': 'Van Zandt',
  '249': 'Wise',
  '250': 'Wood',
}

// Spring years to load (2025 = 2024-25 school year, 2024 = 2023-24)
const YEARS = [2025, 2024]

async function processYear(year: number): Promise<number> {
  const filePath = `data/tea-enrollment-${year}.csv`

  if (!existsSync(filePath)) {
    console.warn(`  ⚠ ${filePath} not found — skipping`)
    return 0
  }

  const content = readFileSync(filePath, 'utf8')
  // Parse all rows as arrays (no automatic header detection)
  const allRows = parse(content, { columns: false, skip_empty_lines: true, trim: true }) as string[][]

  if (allRows.length < 3) {
    console.warn(`  ⚠ ${filePath} too short — expected 2 header rows + data`)
    return 0
  }

  // Row 0 = human labels (skip), Row 1 = variable names
  const varNames: string[] = allRows[1]
  const idxDistrict = varNames.indexOf('DISTRICT')
  const idxDistname = varNames.indexOf('DISTNAME')
  const idxEnrollment = varNames.indexOf('DPETALLC')

  if (idxDistrict < 0 || idxDistname < 0 || idxEnrollment < 0) {
    console.error(`  ✗ ${filePath}: missing required columns. Found: ${varNames.slice(0, 10).join(', ')}`)
    return 0
  }

  const dataRows = allRows.slice(2)
  let inserted = 0

  for (const row of dataRows) {
    const districtId = row[idxDistrict]?.trim()
    if (!districtId || districtId.length < 3) continue

    const countyCode = districtId.slice(0, 3)
    const county = TEA_COUNTY_MAP[countyCode]
    if (!county) continue

    const name = row[idxDistname]?.trim() ?? ''
    const enrollment = parseInt((row[idxEnrollment] ?? '0').replace(/[^0-9]/g, ''), 10)
    if (enrollment <= 0) continue

    if (DRY_RUN) {
      console.log(`  [${year}] ${name} (${districtId}) · ${county} · ${enrollment.toLocaleString()}`)
      inserted++
      continue
    }

    await sql`
      INSERT INTO isd_enrollment (district_id, district_name, county, year, enrollment, updated_at)
      VALUES (${districtId}, ${name}, ${county}, ${year}, ${enrollment}, NOW())
      ON CONFLICT (district_id, year) DO UPDATE SET
        district_name = EXCLUDED.district_name,
        county        = EXCLUDED.county,
        enrollment    = EXCLUDED.enrollment,
        updated_at    = NOW()
    `
    inserted++
  }

  return inserted
}

async function run() {
  console.log('=== TEA Enrollment Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  let total = 0
  for (const year of YEARS) {
    console.log(`\n${year}:`)
    const n = await processYear(year)
    if (n > 0) {
      console.log(`  ✓ ${n} districts processed`)
      total += n
    }
  }

  if (!DRY_RUN) console.log(`\nDone — ${total} rows upserted`)
  else console.log(`\nDry run — ${total} rows would be inserted`)
}

run().catch(e => { console.error(e); process.exit(1) })
