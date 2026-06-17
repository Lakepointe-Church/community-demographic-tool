/**
 * Monthly loader — Zillow Home Value Index (ZHVI), ZIP level.
 * Gives a CURRENT typical home value per ZIP (smoothed, seasonally adjusted),
 * far fresher than ACS's lagged self-reported B25077 median.
 *
 * Run: npx tsx scripts/import-zillow.ts        (DRY_RUN=1 to preview without DB writes)
 *
 * Data (updated ~mid-month, all-homes 35th–65th-percentile tier, SFR+condo):
 *   https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv
 *   Local fallback: data/zillow-zhvi-zip.csv
 *
 * File: one row per ZIP. First 9 cols are metadata
 *   (RegionID, SizeRank, RegionName=ZIP, RegionType, StateName, State, City, Metro, CountyName),
 * then one column per month (header e.g. "2026-05-31"). Values are dollars w/ decimals.
 * Metro contains an embedded comma ("Dallas-Fort Worth-Arlington, TX") so the file
 * MUST be parsed with a real CSV parser, not line.split.
 *
 * Stored (one row per ZIP, latest snapshot):
 *   zhvi      = most recent non-empty month value (whole dollars)
 *   zhvi_yoy  = % change vs the value 12 months earlier (null if unavailable)
 *   series    = trailing up-to-13 months [{month:'YYYY-MM', value}] for a sparkline
 */

import { createReadStream, existsSync, readFileSync } from 'fs'
import { Readable } from 'stream'
import { parse } from 'csv-parse'
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

const URL = `https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
const LOCAL = `data/zillow-zhvi-zip.csv`
const DFW_ZIP_SET = new Set(DFW_ZIPS.map(z => z.zip))
const MONTH_RE = /^\d{4}-\d{2}-\d{2}$/

type Row = { zip: string; month: string; zhvi: number; yoy: number | null; series: { month: string; value: number }[] }

async function run() {
  console.log('=== Zillow ZHVI ZIP Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  let input: NodeJS.ReadableStream
  if (existsSync(LOCAL)) {
    console.log(`  Using local file: ${LOCAL}`)
    input = createReadStream(LOCAL)
  } else {
    console.log(`  Streaming: ${URL} (~120MB)`)
    const res = await fetch(URL)
    if (!res.ok || !res.body) throw new Error(`${res.status} fetching ${URL}`)
    input = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  }

  const parser = input.pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }))

  let monthKeys: string[] | null = null
  let scanned = 0
  const out: Row[] = []

  for await (const rec of parser as AsyncIterable<Record<string, string>>) {
    scanned++
    if (!monthKeys) monthKeys = Object.keys(rec).filter(k => MONTH_RE.test(k)).sort()
    const zip = (rec.RegionName ?? '').trim()
    if (!DFW_ZIP_SET.has(zip)) continue

    // numeric value per month, null when blank
    const vals = monthKeys.map(k => {
      const v = parseFloat(rec[k])
      return Number.isFinite(v) ? v : null
    })
    let latestIdx = -1
    for (let i = vals.length - 1; i >= 0; i--) { if (vals[i] != null) { latestIdx = i; break } }
    if (latestIdx < 0) continue

    const latest = vals[latestIdx]!
    const yoyIdx = latestIdx - 12
    const prior = yoyIdx >= 0 ? vals[yoyIdx] : null
    const yoy = prior != null && prior > 0 ? ((latest - prior) / prior) * 100 : null

    const series: { month: string; value: number }[] = []
    for (let i = Math.max(0, latestIdx - 12); i <= latestIdx; i++) {
      if (vals[i] != null) series.push({ month: monthKeys[i].slice(0, 7), value: Math.round(vals[i]!) })
    }

    out.push({ zip, month: monthKeys[latestIdx].slice(0, 7), zhvi: Math.round(latest), yoy: yoy != null ? +yoy.toFixed(1) : null, series })
  }

  console.log(`  ${scanned} rows scanned · ${out.length} DFW ZIPs matched · latest month ${out[0]?.month ?? '—'}`)

  if (DRY_RUN) {
    out.sort((a, b) => b.zhvi - a.zhvi).slice(0, 8).forEach(r =>
      console.log(`  ${r.zip}: $${r.zhvi.toLocaleString()}  YoY ${r.yoy == null ? '—' : (r.yoy >= 0 ? '+' : '') + r.yoy + '%'}  (${r.series.length}mo series)`))
    console.log(`\n${out.length} rows (not written)`)
    return
  }

  await sql`DELETE FROM zip_home_values`
  const CH = 500
  for (let i = 0; i < out.length; i += CH) {
    const b = out.slice(i, i + CH)
    await sql`
      INSERT INTO zip_home_values (zip, latest_month, zhvi, zhvi_yoy, series)
      SELECT * FROM UNNEST(
        ${b.map(r => r.zip)}::text[], ${b.map(r => r.month)}::text[],
        ${b.map(r => r.zhvi)}::int[], ${b.map(r => r.yoy)}::numeric[],
        ${b.map(r => JSON.stringify(r.series))}::jsonb[]
      )
    `
  }
  console.log(`  ✓ ${out.length} rows upserted`)
  console.log('\nDone.')
}

run().catch(e => { console.error(e); process.exit(1) })
