/**
 * Import IRS Business Master File religious organizations into Neon.
 *
 * Downloads the Texas EO BMF CSV from the IRS, filters to:
 *   - NTEE codes starting with 'X' (all religious orgs)
 *   - ZIPs present in our DFW_ZIPS list
 *
 * Run: npx tsx scripts/import-bmf.ts
 *
 * Re-run monthly to pick up new organizations.
 */

import { createInterface } from 'readline'
import { createReadStream, readFileSync } from 'fs'
import { Readable } from 'stream'
import { neon } from '@neondatabase/serverless'
import { DFW_ZIPS } from '../src/lib/zips'

// Load .env.local
try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const TX_BMF_URL = 'https://www.irs.gov/pub/irs-soi/eo_tx.csv'
const OK_BMF_URL = 'https://www.irs.gov/pub/irs-soi/eo_ok.csv'

// --- NTEE category grouping ---
function nteeCategory(ntee: string): string {
  if (!ntee) return 'Other'
  const major = ntee.slice(0, 2)
  if (major === 'X2') return 'Christian'
  if (major === 'X3') return 'Jewish'
  if (major === 'X4') return 'Islamic'
  if (major === 'X5') return 'Buddhist'
  if (major === 'X6') return 'Unitarian'
  if (major === 'X7') return 'Hindu'
  return 'Other'
}

function nteeLabel(ntee: string): string {
  const map: Record<string, string> = {
    X20: 'Christian',           X21: 'Catholic',
    X22: 'Protestant',          X23: 'Orthodox Christian',
    X24: 'Latter-day Saints',   X25: 'Christian Science',
    X26: "Jehovah's Witnesses", X29: 'Christian',
    X30: 'Jewish',              X31: 'Jewish',              X32: 'Jewish',
    X40: 'Islamic',             X41: 'Islamic Center/Mosque', X42: 'Islamic School',
    X50: 'Buddhist',
    X60: 'Unitarian Universalist',
    X70: 'Hindu',
    X80: 'Religious Media',     X81: 'Missionary',
    X82: 'Scripture Distribution', X83: 'International Mission',
    X84: 'Religious Broadcasting',
    X90: 'Interfaith',          X99: 'Religion N.E.C.',
    X01: 'Alliance/Advocacy',   X02: 'Management Support',
    X03: 'Professional Assoc',  X05: 'Research',
    X11: 'Single Organization', X12: 'Multi-Organization',
  }
  return map[ntee] ?? ntee
}

interface Org {
  ein: string
  name: string
  street: string
  city: string
  state: string
  zip: string      // 5-digit only
  nteeCd: string
  nteeCategory: string
  nteeLabel: string
  rulingYear: number | null
  status: string
  subsection: string
}

async function fetchAndParse(url: string, dfwZips: Set<string>): Promise<Org[]> {
  console.log(`Fetching ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  const text = await res.text()
  console.log(`  ${(text.length / 1024 / 1024).toFixed(1)} MB received`)

  const lines = text.split('\n')
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  const col = (name: string) => header.indexOf(name)
  const EIN = col('EIN'), NAME = col('NAME'), STREET = col('STREET'),
    CITY = col('CITY'), STATE = col('STATE'), ZIP = col('ZIP'),
    RULING = col('RULING'), STATUS = col('STATUS'), NTEE = col('NTEE_CD'),
    SUBSECTION = col('SUBSECTION')

  const orgs: Org[] = []
  let skipped = 0

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const c = line.split(',')
    const ntee = (c[NTEE] ?? '').trim()
    if (!ntee.startsWith('X')) { skipped++; continue }

    const rawZip = (c[ZIP] ?? '').trim()
    const zip5 = rawZip.slice(0, 5)
    if (!dfwZips.has(zip5)) { skipped++; continue }

    const ruling = (c[RULING] ?? '').trim()
    const rulingYear = ruling.length >= 4 && ruling !== '000000'
      ? parseInt(ruling.slice(0, 4))
      : null

    orgs.push({
      ein:          (c[EIN]    ?? '').trim(),
      name:         (c[NAME]   ?? '').trim(),
      street:       (c[STREET] ?? '').trim(),
      city:         (c[CITY]   ?? '').trim(),
      state:        (c[STATE]  ?? '').trim(),
      zip:          zip5,
      nteeCd:       ntee,
      nteeCategory: nteeCategory(ntee),
      nteeLabel:    nteeLabel(ntee),
      rulingYear,
      status:       (c[STATUS]     ?? '').trim(),
      subsection:   (c[SUBSECTION] ?? '').trim(),
    })
  }

  console.log(`  ${orgs.length} religious orgs in DFW (${skipped} skipped)`)
  return orgs
}

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) { console.error('DATABASE_URL not found'); process.exit(1) }
  const sql = neon(dbUrl)

  const dfwZips = new Set(DFW_ZIPS.map(z => z.zip))

  // Create tables
  await sql`
    CREATE TABLE IF NOT EXISTS religious_orgs (
      ein           TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      street        TEXT,
      city          TEXT,
      state         TEXT,
      zip           TEXT,
      ntee_cd       TEXT,
      ntee_category TEXT,
      ntee_label    TEXT,
      ruling_year   INTEGER,
      status        TEXT,
      subsection    TEXT,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_religious_orgs_zip  ON religious_orgs(zip)`
  await sql`CREATE INDEX IF NOT EXISTS idx_religious_orgs_ntee ON religious_orgs(ntee_cd)`
  console.log('Tables ready.')

  // Fetch TX (and OK for border ZIPs near Grayson County)
  const txOrgs = await fetchAndParse(TX_BMF_URL, dfwZips)
  let okOrgs: Org[] = []
  try { okOrgs = await fetchAndParse(OK_BMF_URL, dfwZips) } catch { /* OK is optional */ }
  const orgs = [...txOrgs, ...okOrgs]

  console.log(`Upserting ${orgs.length} orgs...`)
  let upserted = 0
  for (const o of orgs) {
    await sql`
      INSERT INTO religious_orgs
        (ein, name, street, city, state, zip, ntee_cd, ntee_category,
         ntee_label, ruling_year, status, subsection, updated_at)
      VALUES
        (${o.ein}, ${o.name}, ${o.street}, ${o.city}, ${o.state}, ${o.zip},
         ${o.nteeCd}, ${o.nteeCategory}, ${o.nteeLabel}, ${o.rulingYear},
         ${o.status}, ${o.subsection}, NOW())
      ON CONFLICT (ein) DO UPDATE SET
        name          = EXCLUDED.name,
        street        = EXCLUDED.street,
        city          = EXCLUDED.city,
        state         = EXCLUDED.state,
        zip           = EXCLUDED.zip,
        ntee_cd       = EXCLUDED.ntee_cd,
        ntee_category = EXCLUDED.ntee_category,
        ntee_label    = EXCLUDED.ntee_label,
        ruling_year   = EXCLUDED.ruling_year,
        status        = EXCLUDED.status,
        subsection    = EXCLUDED.subsection,
        updated_at    = NOW()
    `
    upserted++
  }

  console.log(`\nDone. Upserted ${upserted} religious organizations into Neon.`)

  // Quick summary by category
  const summary = await sql`
    SELECT ntee_category, COUNT(*) as count
    FROM religious_orgs
    GROUP BY ntee_category
    ORDER BY count DESC
  `
  console.log('\nBy category:')
  for (const row of summary) console.log(`  ${row.ntee_category}: ${row.count}`)
}

main().catch(err => { console.error(err); process.exit(1) })
