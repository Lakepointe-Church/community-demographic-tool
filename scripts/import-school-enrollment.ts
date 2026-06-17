/**
 * Annual loader — ZIP-level public-school enrollment (Spec v2 Phase 4.3).
 *
 * Sharpens the Site Scorer's enrollment signal: replaces the blunt county ISD
 * CAGR (which blends a booming suburban district with a shrinking urban one)
 * with per-ZIP enrollment growth. Each school carries its own ZIP, so we
 * aggregate campus enrollment up to the ZIP and let the scorer compute a
 * ZIP-level CAGR (falling back to county CAGR where a ZIP has no school data).
 *
 * SOURCE: NCES Common Core of Data (CCD) school directory, served by the Urban
 * Institute Education Data API (no key). Federal source — chosen over TEA's
 * TAPR campus files because it ships ZIP + lat/lon + enrollment in one place,
 * so no manual portal download or geocoding is needed. ~1–2yr vintage lag and a
 * "membership" definition that differs slightly from TEA's — documented at
 * /methodology. (Run from a normal network — the API Cloudflare-blocks some
 * datacenter egress IPs.)
 *
 *   https://educationdata.urban.org/api/v1/schools/ccd/directory/{year}/?fips=48
 *
 * Run: npx tsx scripts/import-school-enrollment.ts   (DRY_RUN=1 to preview)
 *
 * Self-verifying: prints the first record's keys + a sample and STOPS if the
 * expected fields (enrollment / zip_location) are missing, so the field mapping
 * can be finalized against the live response in one edit if the API shifts.
 */

import { neon } from '@neondatabase/serverless'
import { DFW_ZIPS } from '../src/lib/zips'

try {
  require('fs').readFileSync('.env.local', 'utf8').split('\n').forEach((line: string) => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)
const DRY_RUN = process.env.DRY_RUN === '1'

const FIPS_TX = 48
const YEARS = [2021, 2022, 2023] // CAGR uses earliest→latest year actually returned
const BASE = 'https://educationdata.urban.org/api/v1/schools/ccd/directory'
const DFW_ZIP_SET = new Set(DFW_ZIPS.map(z => z.zip))

interface CcdSchool {
  school_name?: string
  zip_location?: string | number
  zip_mailing?: string | number
  enrollment?: number
  year?: number
  [k: string]: unknown
}

function zip5(v: string | number | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim().slice(0, 5)
  return /^\d{5}$/.test(s) ? s : null
}

// Fetch every page for one year, following the API's `next` cursor.
async function fetchYear(year: number, verifyFirst: boolean): Promise<CcdSchool[]> {
  const out: CcdSchool[] = []
  let url: string | null = `${BASE}/${year}/?fips=${FIPS_TX}`
  let pages = 0
  let verified = !verifyFirst
  while (url && pages < 500) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.warn(`  ⚠ ${year}: HTTP ${res.status} — skipping year`)
      return out
    }
    const data = await res.json() as { count: number; next: string | null; results: CcdSchool[] }
    if (!verified && data.results.length) {
      const r = data.results[0]
      console.log(`  [verify] ${year} keys: ${Object.keys(r).slice(0, 20).join(', ')}…`)
      console.log(`  [verify] sample: name=${r.school_name} zip_location=${r.zip_location} enrollment=${r.enrollment} year=${r.year}`)
      if (!('enrollment' in r) || !('zip_location' in r)) {
        throw new Error(`Expected fields missing (enrollment/zip_location). Got: ${Object.keys(r).join(', ')}`)
      }
      verified = true
    }
    out.push(...data.results)
    url = data.next
    pages++
  }
  return out
}

async function run() {
  console.log('=== NCES CCD ZIP Enrollment Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  // zip -> year -> { enrollment, campuses }
  const agg = new Map<string, Map<number, { enrollment: number; campuses: number }>>()
  const yearsWithData: number[] = []

  for (const year of YEARS) {
    const schools = await fetchYear(year, true)
    if (!schools.length) continue
    let kept = 0
    for (const s of schools) {
      const zip = zip5(s.zip_location) ?? zip5(s.zip_mailing)
      if (!zip || !DFW_ZIP_SET.has(zip)) continue
      const enr = typeof s.enrollment === 'number' ? s.enrollment : -1
      if (enr <= 0) continue // NCES uses negative sentinels for missing
      if (!agg.has(zip)) agg.set(zip, new Map())
      const ym = agg.get(zip)!
      const cur = ym.get(year) ?? { enrollment: 0, campuses: 0 }
      cur.enrollment += enr
      cur.campuses += 1
      ym.set(year, cur)
      kept++
    }
    yearsWithData.push(year)
    console.log(`  ${year}: ${schools.length} TX schools → ${kept} in DFW ZIPs`)
  }

  const rows: { zip: string; year: number; enrollment: number; campuses: number }[] = []
  for (const [zip, ym] of agg) for (const [year, v] of ym) rows.push({ zip, year, enrollment: v.enrollment, campuses: v.campuses })
  console.log(`\n  ${agg.size} DFW ZIPs · ${rows.length} ZIP-year rows · years ${yearsWithData.join(', ') || 'none'}`)

  if (DRY_RUN) {
    [...agg.entries()].slice(0, 8).forEach(([zip, ym]) => {
      const parts = [...ym.entries()].sort((a, b) => a[0] - b[0]).map(([y, v]) => `${y}:${v.enrollment.toLocaleString()}(${v.campuses})`)
      console.log(`  ${zip}: ${parts.join('  ')}`)
    })
    console.log(`\n${rows.length} rows (not written)`)
    return
  }
  if (!rows.length) { console.error('No rows — aborting (check API reachability/fields).'); process.exit(1) }

  await sql`TRUNCATE zip_school_enrollment`
  const CH = 500
  for (let i = 0; i < rows.length; i += CH) {
    const b = rows.slice(i, i + CH)
    await sql`
      INSERT INTO zip_school_enrollment (zip, year, enrollment, campus_count)
      SELECT * FROM UNNEST(
        ${b.map(r => r.zip)}::text[], ${b.map(r => r.year)}::int[],
        ${b.map(r => r.enrollment)}::int[], ${b.map(r => r.campuses)}::int[]
      )
    `
  }
  console.log(`  ✓ ${rows.length} rows upserted`)
  console.log('\nDone.')
}

run().catch(e => { console.error(e); process.exit(1) })
