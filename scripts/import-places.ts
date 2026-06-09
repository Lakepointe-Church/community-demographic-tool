/**
 * One-time (annual) loader for CDC PLACES health data.
 * Run: npx tsx scripts/import-places.ts
 *
 * CDC PLACES updates once/year. Re-run after each annual release.
 * Source: https://data.cdc.gov/resource/qnzd-25i4.json
 */

import { neon } from '@neondatabase/serverless'
import { ZIP_GROUPS } from '../src/lib/zips'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const sql = neon(process.env.DATABASE_URL!)

const MEASURES = ['DIABETES','OBESITY','CSMOKING','ACCESS2','BPHIGH','DEPRESSION','MHLTH','LPA','GHLTH']

const MEASURE_COL: Record<string, string> = {
  DIABETES:   'diabetes',
  OBESITY:    'obesity',
  CSMOKING:   'smoking',
  ACCESS2:    'uninsured',
  BPHIGH:     'high_blood_pressure',
  DEPRESSION: 'depression',
  MHLTH:      'mental_distress',
  LPA:        'phys_inactivity',
  GHLTH:      'gen_poor_health',
}

const ALL_ZIPS = ZIP_GROUPS.flatMap(g => g.zips.map(z => z.zip))

async function fetchPlacesBatch(zips: string[]): Promise<Record<string, Record<string, number | null>>> {
  const inList = zips.map(z => `'${z}'`).join(',')
  const measureList = MEASURES.map(m => `'${m}'`).join(',')
  const url = `https://data.cdc.gov/resource/qnzd-25i4.json?$limit=2000&$select=locationname,measureid,data_value&$where=locationname in(${inList}) AND measureid in(${measureList})`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`PLACES API error: ${res.status}`)
  const rows: { locationname: string; measureid: string; data_value: string }[] = await res.json()

  const out: Record<string, Record<string, number | null>> = {}
  for (const zip of zips) out[zip] = {}

  for (const row of rows) {
    if (!out[row.locationname]) continue
    const col = MEASURE_COL[row.measureid]
    if (col) out[row.locationname][col] = row.data_value != null ? parseFloat(row.data_value) : null
  }
  return out
}

async function main() {
  console.log(`Importing CDC PLACES data for ${ALL_ZIPS.length} DFW ZIPs…`)
  let inserted = 0, skipped = 0

  // Fetch in batches of 50 ZIPs
  const BATCH = 50
  for (let i = 0; i < ALL_ZIPS.length; i += BATCH) {
    const batch = ALL_ZIPS.slice(i, i + BATCH)
    process.stdout.write(`  Batch ${Math.ceil(i / BATCH) + 1}/${Math.ceil(ALL_ZIPS.length / BATCH)}… `)

    let data: Record<string, Record<string, number | null>>
    try {
      data = await fetchPlacesBatch(batch)
    } catch (e) {
      console.error('fetch error:', e)
      skipped += batch.length
      continue
    }

    for (const zip of batch) {
      const d = data[zip]
      if (!d || Object.keys(d).length === 0) { skipped++; continue }

      await sql`
        INSERT INTO community_health (
          zip, diabetes, obesity, smoking, uninsured,
          high_blood_pressure, depression, mental_distress,
          phys_inactivity, gen_poor_health, updated_at
        ) VALUES (
          ${zip},
          ${d.diabetes ?? null}, ${d.obesity ?? null}, ${d.smoking ?? null},
          ${d.uninsured ?? null}, ${d.high_blood_pressure ?? null},
          ${d.depression ?? null}, ${d.mental_distress ?? null},
          ${d.phys_inactivity ?? null}, ${d.gen_poor_health ?? null},
          NOW()
        )
        ON CONFLICT (zip) DO UPDATE SET
          diabetes            = EXCLUDED.diabetes,
          obesity             = EXCLUDED.obesity,
          smoking             = EXCLUDED.smoking,
          uninsured           = EXCLUDED.uninsured,
          high_blood_pressure = EXCLUDED.high_blood_pressure,
          depression          = EXCLUDED.depression,
          mental_distress     = EXCLUDED.mental_distress,
          phys_inactivity     = EXCLUDED.phys_inactivity,
          gen_poor_health     = EXCLUDED.gen_poor_health,
          updated_at          = NOW()
      `
      inserted++
    }
    console.log(`done (${inserted} upserted so far)`)
  }

  console.log(`\nComplete: ${inserted} ZIPs upserted, ${skipped} skipped (no PLACES coverage)`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
