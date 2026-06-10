/**
 * One-time loader for 2020 U.S. Religion Census county-level adherence data.
 * Run: npx tsx scripts/import-religion-census.ts
 *
 * Source: 2020 U.S. Religion Census (ASARB), distributed via theARDA.com
 * Data vintage: 2020 decennial study. Re-run only if ASARB releases an update (next ~2030).
 *
 * Attribution required on all displays:
 *   "2020 U.S. Religion Census (ASARB) · County level · Adherent estimates"
 *
 * The static data file (data/religion-census-dfw.json) was extracted from the
 * ASARB 2020 Group Detail Excel file using scripts/process-religion-census.js.
 * Re-run that script to regenerate the JSON if needed.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)

async function run() {
  const dataPath = join(process.cwd(), 'data', 'religion-census-dfw.json')
  const rows = JSON.parse(readFileSync(dataPath, 'utf8'))

  console.log(`Ingesting ${rows.length} county rows…`)

  await sql`
    CREATE TABLE IF NOT EXISTS religious_adherence (
      fips                 TEXT PRIMARY KEY,
      county               TEXT NOT NULL,
      region               TEXT NOT NULL,
      population           INTEGER,
      total_adherents      INTEGER,
      unclaimed            INTEGER,
      evangelical          INTEGER,
      mainline_protestant  INTEGER,
      black_protestant     INTEGER,
      catholic             INTEGER,
      orthodox             INTEGER,
      jewish               INTEGER,
      buddhist             INTEGER,
      hindu                INTEGER,
      muslim               INTEGER,
      other_christian      INTEGER,
      other                INTEGER,
      congregations        INTEGER,
      source               TEXT DEFAULT '2020 U.S. Religion Census (ASARB)',
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `

  let inserted = 0
  for (const r of rows) {
    await sql`
      INSERT INTO religious_adherence (
        fips, county, region, population, total_adherents, unclaimed,
        evangelical, mainline_protestant, black_protestant,
        catholic, orthodox, jewish, buddhist, hindu, muslim,
        other_christian, other, congregations, source, updated_at
      ) VALUES (
        ${r.fips}, ${r.county}, ${r.region}, ${r.population},
        ${r.total_adherents}, ${r.unclaimed},
        ${r.evangelical}, ${r.mainline_protestant}, ${r.black_protestant},
        ${r.catholic}, ${r.orthodox}, ${r.jewish},
        ${r.buddhist}, ${r.hindu}, ${r.muslim},
        ${r.other_christian}, ${r.other}, ${r.congregations},
        '2020 U.S. Religion Census (ASARB)',
        NOW()
      )
      ON CONFLICT (fips) DO UPDATE SET
        county              = EXCLUDED.county,
        region              = EXCLUDED.region,
        population          = EXCLUDED.population,
        total_adherents     = EXCLUDED.total_adherents,
        unclaimed           = EXCLUDED.unclaimed,
        evangelical         = EXCLUDED.evangelical,
        mainline_protestant = EXCLUDED.mainline_protestant,
        black_protestant    = EXCLUDED.black_protestant,
        catholic            = EXCLUDED.catholic,
        orthodox            = EXCLUDED.orthodox,
        jewish              = EXCLUDED.jewish,
        buddhist            = EXCLUDED.buddhist,
        hindu               = EXCLUDED.hindu,
        muslim              = EXCLUDED.muslim,
        other_christian     = EXCLUDED.other_christian,
        other               = EXCLUDED.other,
        congregations       = EXCLUDED.congregations,
        source              = EXCLUDED.source,
        updated_at          = NOW()
    `
    inserted++
    process.stdout.write(`\r  ${inserted}/${rows.length}`)
  }

  console.log(`\nDone. ${inserted} counties upserted.`)
}

run().catch(err => { console.error(err); process.exit(1) })
