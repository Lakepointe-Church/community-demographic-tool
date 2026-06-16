/**
 * Annual loader — IRS SOI Individual Income Tax Statistics, ZIP Code Data.
 * Loads a "giving capacity" signal per ZIP: charitable contributions, the
 * itemizer rate (the honest TCJA caveat), and AGI.
 *
 * Run: npx tsx scripts/import-soi.ts        (DRY_RUN=1 to preview without DB writes)
 *
 * Data (latest = Tax Year 2022, released 2025):
 *   https://www.irs.gov/pub/irs-soi/22zpallagi.csv
 *   Local fallback: data/soi-zpallagi-2022.csv
 *
 * File: one row per (ZIP, agi_stub 1–6 AGI bracket); NO total row, so sum the
 * 6 brackets per ZIP. Amounts are in $1000s; counts are rounded to nearest 10.
 * Columns used: zipcode, agi_stub, N1 (returns), A00100 (AGI),
 *   N04470 (returns itemizing), N19700 (returns w/ charitable), A19700 (charitable $).
 */

import { createReadStream, existsSync, readFileSync } from 'fs'
import { createInterface } from 'readline'
import { Readable } from 'stream'
import { neon } from '@neondatabase/serverless'
import { DFW_ZIPS } from '../src/lib/zips'

try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)
const DRY_RUN = process.env.DRY_RUN === '1'

const YEAR = 2022
const URL = `https://www.irs.gov/pub/irs-soi/22zpallagi.csv`
const LOCAL = `data/soi-zpallagi-2022.csv`
const DFW_ZIP_SET = new Set(DFW_ZIPS.map(z => z.zip))

type Agg = { returns: number; agi: number; itemizers: number; charReturns: number; charAmt: number }

async function lines(): Promise<AsyncIterable<string>> {
  if (existsSync(LOCAL)) {
    console.log(`  Using local file: ${LOCAL}`)
    return createInterface({ input: createReadStream(LOCAL), crlfDelay: Infinity })
  }
  console.log(`  Fetching: ${URL}`)
  const res = await fetch(URL)
  if (!res.ok || !res.body) throw new Error(`${res.status} fetching ${URL}`)
  return createInterface({ input: Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), crlfDelay: Infinity })
}

async function run() {
  console.log('=== IRS SOI ZIP Income Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  const agg = new Map<string, Agg>()
  let cols: Record<string, number> | null = null
  let n = 0

  for await (const line of await lines()) {
    if (n++ === 0) {
      const h = line.split(',').map(s => s.trim().toLowerCase())
      cols = {
        zip: h.indexOf('zipcode'), n1: h.indexOf('n1'), agi: h.indexOf('a00100'),
        item: h.indexOf('n04470'), charN: h.indexOf('n19700'), charA: h.indexOf('a19700'),
      }
      if (Object.values(cols).some(i => i < 0)) throw new Error(`Missing expected column; headers: ${h.join(',')}`)
      continue
    }
    if (!line) continue
    const f = line.split(',')
    const zip = (f[cols!.zip] ?? '').trim()
    if (!DFW_ZIP_SET.has(zip)) continue
    const a = agg.get(zip) ?? { returns: 0, agi: 0, itemizers: 0, charReturns: 0, charAmt: 0 }
    a.returns     += Math.round(+f[cols!.n1]    || 0)
    a.agi         += Math.round(+f[cols!.agi]   || 0)
    a.itemizers   += Math.round(+f[cols!.item]  || 0)
    a.charReturns += Math.round(+f[cols!.charN] || 0)
    a.charAmt     += Math.round(+f[cols!.charA] || 0)
    agg.set(zip, a)
  }

  const rows = [...agg.entries()].map(([zip, a]) => ({ zip, ...a }))
  console.log(`  ${n - 1} rows scanned · ${rows.length} DFW ZIPs aggregated`)

  if (DRY_RUN) {
    rows.sort((x, y) => (y.charAmt / Math.max(1, y.charReturns)) - (x.charAmt / Math.max(1, x.charReturns)))
      .slice(0, 8).forEach(r => {
        const itemRate = r.returns ? (r.itemizers / r.returns * 100).toFixed(1) : '0'
        const perGiving = r.charReturns ? Math.round(r.charAmt * 1000 / r.charReturns) : 0
        const pctAgi = r.agi ? (r.charAmt / r.agi * 100).toFixed(2) : '0'
        console.log(`  ${r.zip}: returns=${r.returns} itemizer=${itemRate}% avgGift/givingReturn=$${perGiving.toLocaleString()} charity=${pctAgi}% of AGI`)
      })
    console.log(`\n${rows.length} rows (not written)`)
    return
  }

  await sql`DELETE FROM zip_income_soi WHERE year = ${YEAR}`
  const CH = 1000
  for (let i = 0; i < rows.length; i += CH) {
    const b = rows.slice(i, i + CH)
    await sql`
      INSERT INTO zip_income_soi (zip, year, total_returns, agi_total, itemizing_returns, charitable_returns, charitable_amount)
      SELECT * FROM UNNEST(
        ${b.map(r => r.zip)}::text[], ${b.map(() => YEAR)}::int[],
        ${b.map(r => r.returns)}::int[], ${b.map(r => r.agi)}::bigint[],
        ${b.map(r => r.itemizers)}::int[], ${b.map(r => r.charReturns)}::int[],
        ${b.map(r => r.charAmt)}::bigint[]
      )
    `
  }
  console.log(`  ✓ ${rows.length} rows upserted`)
  console.log('\nDone.')
}

run().catch(e => { console.error(e); process.exit(1) })
