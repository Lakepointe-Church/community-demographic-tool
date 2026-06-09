/**
 * Import College Scorecard data from CSV into Neon.
 *
 * 1. Download the CSV: https://collegescorecard.ed.gov/data/
 *    → Click "Download Data" → "Most-Recent-Cohorts-Institution.csv"
 *
 * 2. Run:
 *    npx tsx scripts/import-scorecard.ts /path/to/Most-Recent-Cohorts-Institution.csv
 */

import { createReadStream, readFileSync } from 'fs'

// Load .env.local into process.env
try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }
import { createInterface } from 'readline'
import { neon } from '@neondatabase/serverless'
import { DFW_ZIPS } from '../src/lib/zips'

const DALLAS   = { lat: 32.7767, lng: -96.7970 }
const MAX_MILES = 75   // store all schools within 75 miles of Dallas center
const ZIP_MILES = 15   // per-ZIP display radius

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseN(v: string | undefined): number | null {
  if (!v || v === 'NULL' || v === 'PrivacySuppressed') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

async function getZipCentroid(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const json = await res.json() as { places?: { latitude: string; longitude: string }[] }
    const place = json.places?.[0]
    return place ? { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) } : null
  } catch {
    return null
  }
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-scorecard.ts <path-to-csv>')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL not found — make sure .env.local exists with DATABASE_URL set')
    process.exit(1)
  }

  const sql = neon(dbUrl)

  // Create / migrate tables
  await sql`
    CREATE TABLE IF NOT EXISTS colleges_cache (
      unit_id              INTEGER PRIMARY KEY,
      name                 TEXT,
      city                 TEXT,
      state                TEXT,
      zip                  TEXT,
      latitude             NUMERIC(9,6),
      longitude            NUMERIC(9,6),
      enrollment           INTEGER,
      completion_rate_4yr  NUMERIC(6,4),
      avg_net_price        INTEGER,
      median_earnings_10yr INTEGER,
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE colleges_cache ADD COLUMN IF NOT EXISTS zip       TEXT`
  await sql`ALTER TABLE colleges_cache ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6)`
  await sql`ALTER TABLE colleges_cache ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6)`
  await sql`ALTER TABLE colleges_cache ADD COLUMN IF NOT EXISTS iclevel   SMALLINT`
  await sql`
    CREATE TABLE IF NOT EXISTS zip_colleges (
      dfw_zip TEXT,
      unit_id INTEGER,
      PRIMARY KEY (dfw_zip, unit_id)
    )
  `
  console.log('Tables ready.')

  // ── Parse CSV ────────────────────────────────────────────────────
  console.log(`Reading ${csvPath}...`)
  const rl = createInterface({ input: createReadStream(csvPath) })

  interface School {
    unitId: number; name: string; city: string; state: string; zip: string
    lat: number; lng: number; iclevel: number | null
    enrollment: number | null; completionRate4yr: number | null
    avgNetPrice: number | null; medianEarnings10yr: number | null
  }

  const schools: School[] = []
  let headers: string[] | null = null
  let rowsRead = 0

  for await (const line of rl) {
    if (!headers) { headers = parseCSVLine(line); continue }
    rowsRead++
    const cols = parseCSVLine(line)
    const row: Record<string, string> = Object.fromEntries(
      (headers as string[]).map((h, i) => [h, cols[i] ?? ''])
    )

    const lat = parseN(row['LATITUDE'])
    const lng = parseN(row['LONGITUDE'])
    if (lat === null || lng === null) continue

    if (haversine(DALLAS.lat, DALLAS.lng, lat, lng) > MAX_MILES) continue

    const unitId = parseInt(row['UNITID'])
    if (!unitId) continue

    const rawNetPrice = parseN(row['NPT4_PUB']) ?? parseN(row['NPT4_PRIV'])
    const rawEnroll   = parseN(row['UGDS'])
    const rawEarnings = parseN(row['MD_EARN_WNE_P10'])
    const rawIclevel  = parseN(row['ICLEVEL'])

    schools.push({
      unitId,
      name:                row['INSTNM']  ?? '',
      city:                row['CITY']    ?? '',
      state:               row['STABBR']  ?? '',
      zip:                 (row['ZIP'] ?? '').slice(0, 5),
      lat, lng,
      iclevel:             rawIclevel != null ? Math.round(rawIclevel) : null,
      enrollment:          rawEnroll   != null ? Math.round(rawEnroll)   : null,
      completionRate4yr:   parseN(row['C150_4']),
      avgNetPrice:         rawNetPrice != null ? Math.round(rawNetPrice) : null,
      medianEarnings10yr:  rawEarnings != null ? Math.round(rawEarnings) : null,
    })
  }

  console.log(`Scanned ${rowsRead} rows — ${schools.length} schools within ${MAX_MILES} miles of Dallas.`)

  // ── Upsert schools ───────────────────────────────────────────────
  console.log('Upserting schools into colleges_cache...')
  for (const s of schools) {
    await sql`
      INSERT INTO colleges_cache
        (unit_id, name, city, state, zip, latitude, longitude, iclevel,
         enrollment, completion_rate_4yr, avg_net_price, median_earnings_10yr, updated_at)
      VALUES
        (${s.unitId}, ${s.name}, ${s.city}, ${s.state}, ${s.zip}, ${s.lat}, ${s.lng}, ${s.iclevel},
         ${s.enrollment}, ${s.completionRate4yr}, ${s.avgNetPrice}, ${s.medianEarnings10yr}, NOW())
      ON CONFLICT (unit_id) DO UPDATE SET
        name = EXCLUDED.name, city = EXCLUDED.city, state = EXCLUDED.state, zip = EXCLUDED.zip,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, iclevel = EXCLUDED.iclevel,
        enrollment = EXCLUDED.enrollment, completion_rate_4yr = EXCLUDED.completion_rate_4yr,
        avg_net_price = EXCLUDED.avg_net_price, median_earnings_10yr = EXCLUDED.median_earnings_10yr,
        updated_at = NOW()
    `
  }
  console.log(`Upserted ${schools.length} schools.`)

  // ── Build zip_colleges mapping ───────────────────────────────────
  console.log(`Building zip_colleges for ${DFW_ZIPS.length} DFW ZIPs (fetching centroids)...`)
  let mappings = 0
  let centroidsFound = 0

  for (const { zip } of DFW_ZIPS) {
    const centroid = await getZipCentroid(zip)
    if (!centroid) { process.stdout.write(`⚠ ${zip} `); continue }
    centroidsFound++

    for (const s of schools) {
      if (haversine(centroid.lat, centroid.lng, s.lat, s.lng) <= ZIP_MILES) {
        await sql`
          INSERT INTO zip_colleges (dfw_zip, unit_id) VALUES (${zip}, ${s.unitId})
          ON CONFLICT DO NOTHING
        `
        mappings++
      }
    }
  }

  console.log(`\nDone.`)
  console.log(`  ZIP centroids resolved: ${centroidsFound} / ${DFW_ZIPS.length}`)
  console.log(`  ZIP→school mappings:    ${mappings}`)
  console.log(`  Schools cached:         ${schools.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
