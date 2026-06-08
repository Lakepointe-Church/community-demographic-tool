/**
 * Find all ZCTAs within 75 miles of Dallas center using Census Gazetteer.
 * Outputs ZIPs not currently in src/lib/zips.ts, grouped by county/area.
 *
 * Run: npx tsx scripts/find-missing-zips.ts
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { DFW_ZIPS } from '../src/lib/zips'

const DALLAS = { lat: 32.7767, lng: -96.7970 }
const MAX_MILES = 75
const GAZ_URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip'
const TMP_ZIP  = '/tmp/zcta_gaz_2023.zip'
const TMP_TXT  = '/tmp/zcta_gaz_2023.txt'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function main() {
  // Download if not cached
  if (!existsSync(TMP_TXT)) {
    if (!existsSync(TMP_ZIP)) {
      console.log('Downloading Census ZCTA Gazetteer (~5 MB)...')
      execSync(`curl -L -o ${TMP_ZIP} "${GAZ_URL}"`, { stdio: 'inherit' })
    }
    console.log('Unzipping...')
    execSync(`unzip -p ${TMP_ZIP} > ${TMP_TXT}`)
  } else {
    console.log('Using cached Gazetteer.')
  }

  const existing = new Set(DFW_ZIPS.map(z => z.zip))
  console.log(`Current list: ${existing.size} ZIPs`)

  const lines = readFileSync(TMP_TXT, 'utf8').split('\n')
  const header = lines[0].split('\t').map(h => h.trim())
  const idxGeo = header.findIndex(h => h === 'GEOID')
  const idxLat = header.findIndex(h => h === 'INTPTLAT')
  const idxLng = header.findIndex(h => h === 'INTPTLONG')

  if (idxGeo === -1 || idxLat === -1 || idxLng === -1) {
    console.error('Could not find expected columns. Header:', header.join(', '))
    process.exit(1)
  }

  const inRadius: { zip: string; lat: number; lng: number; miles: number }[] = []

  for (const line of lines.slice(1)) {
    const cols = line.split('\t')
    if (cols.length < 4) continue
    const zip = cols[idxGeo]?.trim()
    const lat = parseFloat(cols[idxLat])
    const lng = parseFloat(cols[idxLng])
    if (!zip || isNaN(lat) || isNaN(lng)) continue
    const miles = haversine(DALLAS.lat, DALLAS.lng, lat, lng)
    if (miles <= MAX_MILES) {
      inRadius.push({ zip, lat, lng, miles })
    }
  }

  inRadius.sort((a, b) => a.miles - b.miles)

  const missing = inRadius.filter(z => !existing.has(z.zip))
  const covered = inRadius.filter(z => existing.has(z.zip))

  console.log(`\nWithin ${MAX_MILES} miles of Dallas: ${inRadius.length} ZCTAs total`)
  console.log(`Already in list: ${covered.length}`)
  console.log(`\n=== MISSING ZIPs (${missing.length}) ===`)
  console.log('zip\tmiles\tlat\tlng')
  for (const z of missing) {
    console.log(`${z.zip}\t${z.miles.toFixed(1)}\t${z.lat.toFixed(4)}\t${z.lng.toFixed(4)}`)
  }

  // Also show current ZIPs that are OUTSIDE 75 miles (sanity check)
  const outsiders = DFW_ZIPS.filter(d => !inRadius.find(z => z.zip === d.zip))
  if (outsiders.length > 0) {
    console.log(`\n=== Current ZIPs outside ${MAX_MILES} miles (or no ZCTA centroid) ===`)
    for (const z of outsiders) console.log(`  ${z.zip} — ${z.label}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
