/**
 * Annual loader — IRS SOI County-to-County Migration Data (Phase 4.6).
 * Context/narrative tier: who's moving into the DFW counties, from where, at what income.
 *
 * Run: npx tsx scripts/import-soi-migration.ts        (DRY_RUN=1 to preview without DB writes)
 *
 * Data (latest = filing years 2022→2023, released 2025):
 *   Inflow:  https://www.irs.gov/pub/irs-soi/countyinflow2223.csv
 *   Outflow: https://www.irs.gov/pub/irs-soi/countyoutflow2223.csv
 *   Local fallback: data/countyinflow2223.csv / data/countyoutflow2223.csv
 *
 * File layout (one row per county pair):
 *   inflow:  y2_statefips,y2_countyfips,y1_statefips,y1_countyfips,y1_state,y1_countyname,n1,n2,agi
 *   outflow: y1_statefips,y1_countyfips,y2_statefips,y2_countyfips,y2_state,y2_countyname,n1,n2,agi
 *   i.e. cols 0-1 = the FOCUS county (destination for inflow, origin for outflow),
 *        cols 2-3 = the COUNTERPART county, col 4 = counterpart state abbrev,
 *        col 5 = counterpart name, n1 = returns (households), n2 = individuals, agi = $1000s.
 * Pseudo-rows: counterpart statefips 96/97/98 are IRS summary aggregates
 *   (96/000 = grand total US+foreign — kept as kind 'total'; 97/98 breakdowns skipped).
 *   A counterpart equal to the focus FIPS is the Non-migrant row (skipped).
 * Only DFW focus counties are kept (TX state 48 + DFW_COUNTY_FIPS).
 */

import { createReadStream, existsSync, readFileSync } from 'fs'
import { createInterface } from 'readline'
import { Readable } from 'stream'
import { neon } from '@neondatabase/serverless'

try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)
const DRY_RUN = process.env.DRY_RUN === '1'

// destination year of the 2022→2023 file pair
const YEAR = 2023
const TOP_N = 25 // real counterpart counties kept per (direction, focus county)

// DFW county FIPS codes (3-digit county portion only) — matches scripts/import-permits.ts
const DFW_COUNTY_FIPS: Record<string, string> = {
  '085': 'Collin',   '097': 'Cooke',    '113': 'Dallas',   '121': 'Denton',
  '139': 'Ellis',    '147': 'Fannin',   '181': 'Grayson',  '213': 'Henderson',
  '217': 'Hill',     '221': 'Hood',     '223': 'Hopkins',  '231': 'Hunt',
  '251': 'Johnson',  '257': 'Kaufman',  '337': 'Montague', '349': 'Navarro',
  '367': 'Parker',   '379': 'Rains',    '397': 'Rockwall', '439': 'Tarrant',
  '467': 'Van Zandt','497': 'Wise',     '499': 'Wood',
}

type Row = {
  direction: 'in' | 'out'
  fips: string; county: string
  kind: 'total' | 'county'
  otherFips: string; otherName: string; otherState: string | null
  returns: number; individuals: number; agi: number
}

async function lines(file: string, url: string): Promise<AsyncIterable<string>> {
  if (existsSync(file)) {
    console.log(`  Using local file: ${file}`)
    return createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  }
  console.log(`  Fetching: ${url}`)
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`${res.status} fetching ${url}`)
  return createInterface({ input: Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), crlfDelay: Infinity })
}

async function parse(direction: 'in' | 'out', file: string, url: string): Promise<Row[]> {
  const out: Row[] = []
  let n = 0
  for await (const line of await lines(file, url)) {
    if (n++ === 0) {
      // header self-check: focus fips in cols 0-1, counterpart in 2-5, then n1,n2,agi
      const h = line.split(',').map(s => s.trim().toLowerCase())
      const want = direction === 'in'
        ? ['y2_statefips', 'y2_countyfips', 'y1_statefips', 'y1_countyfips']
        : ['y1_statefips', 'y1_countyfips', 'y2_statefips', 'y2_countyfips']
      const ok = want.every((w, i) => h[i] === w) && h[6] === 'n1' && h[7] === 'n2' && h[8] === 'agi'
      if (!ok) throw new Error(`Unexpected ${direction}flow header: ${h.join(',')}`)
      continue
    }
    if (!line) continue
    const f = line.split(',')
    if (f.length < 9) continue

    const focusState = f[0].trim().padStart(2, '0')
    const focusCounty = f[1].trim().padStart(3, '0')
    if (focusState !== '48') continue
    const county = DFW_COUNTY_FIPS[focusCounty]
    if (!county) continue

    const otherState = f[2].trim().padStart(2, '0')
    const otherCounty = f[3].trim().padStart(3, '0')
    const otherFips = otherState + otherCounty
    const fips = focusState + focusCounty

    const returns = Math.max(0, Math.round(+f[6] || 0))
    const individuals = Math.max(0, Math.round(+f[7] || 0))
    const agi = Math.max(0, Math.round(+f[8] || 0))
    const name = (f[5] ?? '').trim()
    const stAbbr = (f[4] ?? '').trim()

    // grand-total pseudo-row (all in/out migrants, US + foreign)
    if (otherState === '96' && otherCounty === '000') {
      out.push({ direction, fips, county, kind: 'total', otherFips, otherName: name, otherState: null, returns, individuals, agi })
      continue
    }
    // skip aggregate/pseudo-rows: real US state FIPS are 01-56; 57-59 are IRS
    // "Other flows" suppression aggregates, 96-98 are summary totals. Skip the non-migrant self-row too.
    if (+otherState >= 57) continue
    if (otherFips === fips) continue

    out.push({ direction, fips, county, kind: 'county', otherFips, otherName: name, otherState: stAbbr || null, returns, individuals, agi })
  }
  return out
}

async function run() {
  console.log('=== IRS SOI County Migration Import (2022→2023) ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  const inflow = await parse('in', 'data/countyinflow2223.csv', 'https://www.irs.gov/pub/irs-soi/countyinflow2223.csv')
  const outflow = await parse('out', 'data/countyoutflow2223.csv', 'https://www.irs.gov/pub/irs-soi/countyoutflow2223.csv')

  // Keep the total row + top-N real counterparts (by returns) per (direction, focus county)
  const kept: Row[] = []
  for (const all of [inflow, outflow]) {
    const byFips = new Map<string, Row[]>()
    for (const r of all) {
      if (!byFips.has(r.fips)) byFips.set(r.fips, [])
      byFips.get(r.fips)!.push(r)
    }
    for (const rows of byFips.values()) {
      kept.push(...rows.filter(r => r.kind === 'total'))
      kept.push(...rows.filter(r => r.kind === 'county').sort((a, b) => b.returns - a.returns).slice(0, TOP_N))
    }
  }

  console.log(`  inflow rows kept: ${kept.filter(r => r.direction === 'in').length} · outflow: ${kept.filter(r => r.direction === 'out').length}`)

  if (DRY_RUN) {
    for (const dir of ['in', 'out'] as const) {
      const total = kept.find(r => r.direction === dir && r.county === 'Rockwall' && r.kind === 'total')
      const tops = kept.filter(r => r.direction === dir && r.county === 'Rockwall' && r.kind === 'county').slice(0, 5)
      const avgAgi = total && total.returns ? Math.round(total.agi * 1000 / total.returns) : 0
      console.log(`\n  Rockwall ${dir === 'in' ? 'IN-migration' : 'OUT-migration'}: ${total?.returns.toLocaleString() ?? 0} households · avg AGI $${avgAgi.toLocaleString()}`)
      tops.forEach(r => console.log(`    ${r.otherName} (${r.otherState}): ${r.returns.toLocaleString()} HH · avg AGI $${r.returns ? Math.round(r.agi * 1000 / r.returns).toLocaleString() : 0}`))
    }
    console.log(`\n${kept.length} rows (not written)`)
    return
  }

  await sql`DELETE FROM county_migration WHERE year = ${YEAR}`
  const CH = 500
  for (let i = 0; i < kept.length; i += CH) {
    const b = kept.slice(i, i + CH)
    await sql`
      INSERT INTO county_migration (direction, fips, county, year, kind, other_fips, other_name, other_state, returns, individuals, agi)
      SELECT * FROM UNNEST(
        ${b.map(r => r.direction)}::text[], ${b.map(r => r.fips)}::text[], ${b.map(r => r.county)}::text[],
        ${b.map(() => YEAR)}::int[], ${b.map(r => r.kind)}::text[],
        ${b.map(r => r.otherFips)}::text[], ${b.map(r => r.otherName)}::text[], ${b.map(r => r.otherState)}::text[],
        ${b.map(r => r.returns)}::int[], ${b.map(r => r.individuals)}::int[], ${b.map(r => r.agi)}::bigint[]
      )
    `
  }
  console.log(`  ✓ ${kept.length} rows upserted`)
  console.log('\nDone.')
}

run().catch(e => { console.error(e); process.exit(1) })
