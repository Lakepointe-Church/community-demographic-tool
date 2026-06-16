/**
 * Commute-corridor loader — LEHD LODES8 Origin-Destination (OnTheMap).
 *
 * Streams the Texas OD "main" file (home + work both in TX) and the LODES8
 * geography crosswalk, aggregates block→block job flows up to ZCTA→ZCTA, and
 * stores, per DFW home ZIP:
 *   - commute_flows:   top-15 external work-destination ZIPs (the corridors)
 *   - commute_summary: total workers, jobs that stay in-ZIP (self-containment),
 *                      and the job-weighted net commute bearing/direction
 *
 * Also writes data/dfw-zip-centroids.json (zip → [lng, lat]) derived from the
 * crosswalk block centroids — a reusable asset (e.g. distance-to-campus, 3.4).
 *
 * Run: npx tsx scripts/import-lodes.ts        (DRY_RUN=1 to skip DB writes)
 *
 * Data (LODES8, current year 2023, released 2025-12-03):
 *   OD:    https://lehd.ces.census.gov/data/lodes/LODES8/tx/od/tx_od_main_JT00_2023.csv.gz
 *   xwalk: https://lehd.ces.census.gov/data/lodes/LODES8/tx/tx_xwalk.csv.gz
 *   Local fallback: data/lodes-od-2023.csv.gz, data/lodes-xwalk.csv.gz
 *
 * OD columns:    w_geocode, h_geocode, S000(total), SA01-03(age), SE01-03(earn), SI01-03(ind)
 *   SE03 = jobs paying > $3,333/month (~$40k/yr) — kept as "high_earner_jobs"
 * Crosswalk cols: 0 tabblk2020 · 12 zcta · 38 blklatdd · 39 blklondd  (names are quoted; parse with quotes)
 *
 * "main" = both ends in TX (intra-state). We further keep only flows where BOTH
 * ends fall in a DFW coverage ZIP, i.e. intra-metro commute corridors.
 */

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'fs'
import { createGunzip } from 'zlib'
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

const YEAR = 2023
const TOP_N = 15 // external destinations stored per home ZIP
const OD_URL = `https://lehd.ces.census.gov/data/lodes/LODES8/tx/od/tx_od_main_JT00_${YEAR}.csv.gz`
const XWALK_URL = `https://lehd.ces.census.gov/data/lodes/LODES8/tx/tx_xwalk.csv.gz`

const DFW_ZIP_SET = new Set(DFW_ZIPS.map(z => z.zip))

/** Gunzipped line reader from a remote URL or a local .gz fallback. */
async function gzLines(url: string, localPath: string): Promise<AsyncIterable<string>> {
  let input: NodeJS.ReadableStream
  if (existsSync(localPath)) {
    console.log(`  Using local file: ${localPath}`)
    input = createReadStream(localPath)
  } else {
    console.log(`  Fetching: ${url}`)
    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error(`${res.status} fetching ${url}`)
    input = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  }
  const gunzip = input.pipe(createGunzip())
  return createInterface({ input: gunzip, crlfDelay: Infinity })
}

/** CSV line splitter that respects double-quoted fields (crosswalk names contain commas). */
function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
function compass(bearingDeg: number): string {
  return COMPASS[Math.round(bearingDeg / 45) % 8]
}

async function run() {
  console.log('=== LODES Commute-Corridor Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  // ── Pass 1: crosswalk → DFW block→ZIP map + per-ZIP centroid accumulation ──
  console.log('\nCrosswalk:')
  const blockToZip = new Map<string, string>()
  const cent = new Map<string, { sumLng: number; sumLat: number; n: number }>()

  let xRows = 0
  for await (const line of await gzLines(XWALK_URL, 'data/lodes-xwalk.csv.gz')) {
    if (xRows++ === 0) continue // header
    const f = splitCsv(line)
    const zcta = f[12]
    if (!DFW_ZIP_SET.has(zcta)) continue
    const block = f[0]
    blockToZip.set(block, zcta)
    const lat = parseFloat(f[38]); const lng = parseFloat(f[39])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const c = cent.get(zcta) ?? { sumLng: 0, sumLat: 0, n: 0 }
      c.sumLng += lng; c.sumLat += lat; c.n++
      cent.set(zcta, c)
    }
  }
  console.log(`  ${blockToZip.size.toLocaleString()} DFW blocks across ${cent.size} ZIPs`)

  // ZIP centroids → data/dfw-zip-centroids.json (lng, lat)
  const centroids: Record<string, [number, number]> = {}
  for (const [zip, c] of cent) {
    if (c.n > 0) centroids[zip] = [+(c.sumLng / c.n).toFixed(5), +(c.sumLat / c.n).toFixed(5)]
  }
  if (!DRY_RUN) {
    writeFileSync('data/dfw-zip-centroids.json', JSON.stringify(centroids, null, 0) + '\n')
    console.log(`  ✓ wrote data/dfw-zip-centroids.json (${Object.keys(centroids).length} ZIPs)`)
  }

  // ── Pass 2: stream OD, accumulate intra-DFW ZIP→ZIP flows ──
  console.log('\nOrigin-Destination:')
  // flows: homeZip → workZip → [jobs, highEarnerJobs]
  const flows = new Map<string, Map<string, [number, number]>>()
  let odRows = 0
  let kept = 0
  for await (const line of await gzLines(OD_URL, 'data/lodes-od-2023.csv.gz')) {
    if (odRows++ === 0) continue // header
    if (!line) continue
    // OD rows are all-numeric (no quotes) → fast split
    const c = line.split(',')
    const homeZip = blockToZip.get(c[1])
    if (!homeZip) continue
    const workZip = blockToZip.get(c[0])
    if (!workZip) continue
    const jobs = +c[2] || 0
    const high = +c[8] || 0 // SE03
    let dest = flows.get(homeZip)
    if (!dest) { dest = new Map(); flows.set(homeZip, dest) }
    const prev = dest.get(workZip)
    if (prev) { prev[0] += jobs; prev[1] += high } else dest.set(workZip, [jobs, high])
    kept++
    if (odRows % 2_000_000 === 0) console.log(`  …${(odRows / 1e6).toFixed(0)}M rows scanned, ${kept.toLocaleString()} intra-DFW kept`)
  }
  console.log(`  ${(odRows - 1).toLocaleString()} OD rows scanned · ${kept.toLocaleString()} intra-DFW pairs · ${flows.size} home ZIPs`)

  // ── Build per-home summary + top-N corridors ──
  type Corridor = { workZip: string; jobs: number; high: number }
  const flowRows: { home: string; work: string; jobs: number; high: number }[] = []
  const summaryRows: {
    home: string; total: number; inZip: number; topDest: string | null
    bearing: number | null; dir: string | null; conc: number | null
  }[] = []

  for (const [home, dests] of flows) {
    let total = 0
    const inZip = dests.get(home)?.[0] ?? 0
    const ext: Corridor[] = []
    for (const [work, [jobs, high]] of dests) {
      total += jobs
      if (work !== home) ext.push({ workZip: work, jobs, high })
    }
    ext.sort((a, b) => b.jobs - a.jobs)

    // Net commute bearing: job-weighted vector of home→dest directions
    let vx = 0, vy = 0, extTotal = 0
    const home0 = centroids[home]
    if (home0) {
      const meanLatRad = (home0[1] * Math.PI) / 180
      for (const d of ext) {
        const dc = centroids[d.workZip]
        if (!dc) continue
        const x = (dc[0] - home0[0]) * Math.cos(meanLatRad) // east component
        const y = dc[1] - home0[1]                          // north component
        const mag = Math.hypot(x, y)
        if (mag === 0) continue
        vx += (x / mag) * d.jobs
        vy += (y / mag) * d.jobs
        extTotal += d.jobs
      }
    }
    let bearing: number | null = null, dir: string | null = null, conc: number | null = null
    if (extTotal > 0 && (vx !== 0 || vy !== 0)) {
      bearing = ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360
      dir = compass(bearing)
      conc = Math.hypot(vx, vy) / extTotal
    }

    summaryRows.push({
      home, total, inZip,
      topDest: ext[0]?.workZip ?? null,
      bearing: bearing != null ? +bearing.toFixed(1) : null,
      dir, conc: conc != null ? +conc.toFixed(3) : null,
    })
    for (const d of ext.slice(0, TOP_N)) {
      flowRows.push({ home, work: d.workZip, jobs: d.jobs, high: d.high })
    }
  }

  if (DRY_RUN) {
    console.log('\nSample (top 8 home ZIPs by total workers):')
    summaryRows.sort((a, b) => b.total - a.total).slice(0, 8).forEach(s => {
      const selfPct = s.total > 0 ? ((s.inZip / s.total) * 100).toFixed(0) : '0'
      const top3 = flowRows.filter(f => f.home === s.home).slice(0, 3).map(f => `${f.work}(${f.jobs})`).join(' ')
      console.log(`  ${s.home}: ${s.total.toLocaleString()} workers · ${selfPct}% in-ZIP · ${s.dir ?? '—'} ${s.conc ?? ''} · → ${top3}`)
    })
    console.log(`\n${flowRows.length} corridor rows · ${summaryRows.length} summary rows (not written)`)
    return
  }

  // ── Write (bulk UNNEST inserts — the HTTP driver dislikes many concurrent statements) ──
  const CH = 1000
  console.log('\nWriting commute_flows…')
  await sql`DELETE FROM commute_flows WHERE year = ${YEAR}`
  for (let i = 0; i < flowRows.length; i += CH) {
    const b = flowRows.slice(i, i + CH)
    await sql`
      INSERT INTO commute_flows (home_zip, work_zip, jobs, high_earner_jobs, year)
      SELECT * FROM UNNEST(
        ${b.map(r => r.home)}::text[], ${b.map(r => r.work)}::text[],
        ${b.map(r => r.jobs)}::int[], ${b.map(r => r.high)}::int[],
        ${b.map(() => YEAR)}::int[]
      )
    `
  }
  console.log(`  ✓ ${flowRows.length} corridor rows`)

  console.log('Writing commute_summary…')
  await sql`DELETE FROM commute_summary WHERE year = ${YEAR}`
  for (let i = 0; i < summaryRows.length; i += CH) {
    const b = summaryRows.slice(i, i + CH)
    await sql`
      INSERT INTO commute_summary
        (home_zip, year, total_workers, work_in_zip, top_dest_zip, net_bearing_deg, direction_label, concentration)
      SELECT * FROM UNNEST(
        ${b.map(s => s.home)}::text[], ${b.map(() => YEAR)}::int[],
        ${b.map(s => s.total)}::int[], ${b.map(s => s.inZip)}::int[],
        ${b.map(s => s.topDest)}::text[], ${b.map(s => s.bearing)}::numeric[],
        ${b.map(s => s.dir)}::text[], ${b.map(s => s.conc)}::numeric[]
      )
    `
  }
  console.log(`  ✓ ${summaryRows.length} summary rows`)
  console.log('\nDone.')
}

run().catch(e => { console.error(e); process.exit(1) })
