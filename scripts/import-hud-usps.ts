/**
 * Quarterly loader — HUD Aggregated USPS Administrative Data on Address Vacancies.
 * Computes "address momentum": active residential address counts per ZIP per
 * quarter, the freshest available growth signal (ahead of ACS lag).
 *
 * ⚠️ ACCESS IS [HUMAN]-GATED. This dataset is restricted to government / non-profit
 *    orgs behind a license agreement and is a MANUAL download (no API):
 *      1. Register + accept license at https://www.huduser.gov/portal/datasets/usps.html
 *      2. Download the most recent 5+ consecutive quarters at ZIP-code summary level
 *      3. Save each as data/hud-usps-{YYYY}q{Q}.csv  (e.g. data/hud-usps-2026q1.csv)
 *    See README "HUD USPS address momentum" for the full runbook.
 *
 * ⚠️ FORMAT NOT YET VERIFIED. The per-row column mapping below (FIELD_CANDIDATES)
 *    is a best-effort guess against documented HUD field names. The script does NOT
 *    blind-load: if the expected columns aren't found it prints the file's actual
 *    headers and stops, so the mapping can be finalized against the real file.
 *
 * Run: npx tsx scripts/import-hud-usps.ts        (DRY_RUN=1 to preview without DB writes)
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { neon } from '@neondatabase/serverless'

try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL!)
const DRY_RUN = process.env.DRY_RUN === '1'
const DATA_DIR = 'data'

// ⚠️ VERIFY against the real download — HUD has revised these field names over time.
// Each logical field lists candidate header names (lower-cased); first match wins.
const FIELD_CANDIDATES = {
  zip:    ['zip', 'geoid', 'zcta', 'zip_code'],
  total:  ['ams_res', 'tot_res', 'res_total', 'total_res', 'amsres'],
  vacant: ['vac_res', 'res_vacant', 'vacant_res', 'vacres'],
  nostat: ['nostat_res', 'no_stat_res', 'res_nostat', 'nostatres'],
  // some vintages ship an explicit active count; if present we use it directly
  active: ['active_res', 'res_active', 'avg_active_res'],
}

type Parsed = { zip: string; active: number | null; total: number | null; vacant: number | null; nostat: number | null }

/** "data/hud-usps-2026q1.csv" → "2026Q1" */
function quarterFromName(file: string): string | null {
  const m = file.match(/(\d{4})[\-_ ]?q([1-4])/i)
  return m ? `${m[1]}Q${m[2]}` : null
}

function pick(headers: string[], candidates: string[]): string | null {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const c of candidates) {
    const i = lower.indexOf(c)
    if (i >= 0) return headers[i]
  }
  return null
}

function parseFile(path: string): { rows: Parsed[]; headers: string[]; mapped: boolean } {
  const text = readFileSync(path, 'utf8')
  const records: Record<string, string>[] = parse(text, { columns: true, skip_empty_lines: true, trim: true })
  const headers = records.length ? Object.keys(records[0]) : []

  const colZip    = pick(headers, FIELD_CANDIDATES.zip)
  const colTotal  = pick(headers, FIELD_CANDIDATES.total)
  const colVacant = pick(headers, FIELD_CANDIDATES.vacant)
  const colNostat = pick(headers, FIELD_CANDIDATES.nostat)
  const colActive = pick(headers, FIELD_CANDIDATES.active)

  // We need a ZIP and SOME way to derive active addresses: either an explicit
  // active column, or total + (vacant and/or no-stat) to subtract.
  const canDeriveActive = !!colActive || (!!colTotal && (!!colVacant || !!colNostat))
  if (!colZip || !canDeriveActive) {
    return { rows: [], headers, mapped: false }
  }

  const num = (v: string | undefined) => {
    if (v == null || v === '') return null
    const n = parseInt(v.replace(/[, ]/g, ''), 10)
    return Number.isFinite(n) ? n : null
  }

  const rows: Parsed[] = []
  for (const r of records) {
    const zip = (r[colZip] ?? '').trim().slice(0, 5)
    if (!/^\d{5}$/.test(zip)) continue
    const total  = colTotal  ? num(r[colTotal])  : null
    const vacant = colVacant ? num(r[colVacant]) : null
    const nostat = colNostat ? num(r[colNostat]) : null
    let active: number | null = colActive ? num(r[colActive]) : null
    if (active == null && total != null) {
      active = total - (vacant ?? 0) - (nostat ?? 0)
    }
    rows.push({ zip, active, total, vacant, nostat })
  }
  return { rows, headers, mapped: true }
}

async function run() {
  console.log('=== HUD USPS Address Momentum Import ===')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  if (!existsSync(DATA_DIR)) { console.error(`No ${DATA_DIR}/ directory`); return }
  const files = readdirSync(DATA_DIR).filter(f => /^hud-usps-.*\.csv$/i.test(f)).sort()

  if (files.length === 0) {
    console.log('No data/hud-usps-*.csv files found.')
    console.log('Download quarterly ZIP-level files from https://www.huduser.gov/portal/datasets/usps.html')
    console.log('and save them as data/hud-usps-YYYYqQ.csv (e.g. data/hud-usps-2026q1.csv).')
    return
  }

  let totalUpserted = 0
  for (const file of files) {
    const quarter = quarterFromName(file)
    if (!quarter) { console.warn(`Skipping ${file} — can't parse a YYYYqQ quarter from the name`); continue }

    const { rows, headers, mapped } = parseFile(`${DATA_DIR}/${file}`)
    if (!mapped) {
      console.error(`\n✗ ${file}: could not map required columns (need a ZIP + a way to derive active addresses).`)
      console.error('  Actual headers in the file:')
      console.error('    ' + headers.join(', '))
      console.error('  → Update FIELD_CANDIDATES at the top of this script to match, then re-run.')
      continue
    }

    console.log(`\n${file} → ${quarter}: ${rows.length} ZIP rows`)
    if (DRY_RUN) {
      rows.slice(0, 5).forEach(r => console.log(`  ${r.zip}: active=${r.active} total=${r.total} vac=${r.vacant} nostat=${r.nostat}`))
      continue
    }

    const CH = 1000
    for (let i = 0; i < rows.length; i += CH) {
      const b = rows.slice(i, i + CH)
      await sql`
        INSERT INTO usps_addresses (zip, quarter, res_active, res_total, res_vacant, res_nostat)
        SELECT * FROM UNNEST(
          ${b.map(r => r.zip)}::text[], ${b.map(() => quarter)}::text[],
          ${b.map(r => r.active)}::int[], ${b.map(r => r.total)}::int[],
          ${b.map(r => r.vacant)}::int[], ${b.map(r => r.nostat)}::int[]
        )
        ON CONFLICT (zip, quarter) DO UPDATE SET
          res_active = EXCLUDED.res_active, res_total = EXCLUDED.res_total,
          res_vacant = EXCLUDED.res_vacant, res_nostat = EXCLUDED.res_nostat, updated_at = NOW()
      `
    }
    totalUpserted += rows.length
    console.log(`  ✓ upserted`)
  }

  if (!DRY_RUN) console.log(`\nDone — ${totalUpserted} rows upserted.`)
}

run().catch(e => { console.error(e); process.exit(1) })
