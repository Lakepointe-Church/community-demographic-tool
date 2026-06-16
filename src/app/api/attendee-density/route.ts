import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { sql } from '@/lib/db'
import { ZIP_COUNTY } from '@/lib/zip-county'
import { DFW_ZIPS } from '@/lib/zips'

const PRIVACY_THRESHOLD = 5

// Set of all known DFW ZIPs for upload validation
const DFW_ZIP_SET = new Set(DFW_ZIPS.map(z => z.zip))

// Middleware handles site-wide auth. Mutating endpoints additionally verify
// Bearer token (automation) OR valid Basic credentials (browser users).
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true
  if (auth.startsWith('Basic ')) {
    const [user, pass] = atob(auth.slice(6)).split(':')
    return user === process.env.BASIC_AUTH_USER && pass === process.env.BASIC_AUTH_PASS
  }
  return false
}

// ── GET /api/attendee-density ──────────────────────────────────────────────────
// Returns per-ZIP household counts with privacy masking, penetration metrics,
// unclaimed-reach metric, and last-upload metadata.
export async function GET() {
  try {
    const [rows, logRows, adherenceRows] = await Promise.all([
      sql`
        SELECT
          a.zip,
          a.total_households  AS attendee_hh,
          a.campus_breakdown,
          a.source_date,
          d.total_households  AS census_hh
        FROM attendee_density a
        LEFT JOIN zip_demographics d ON a.zip = d.zip
        ORDER BY a.total_households DESC
      `,
      sql`
        SELECT uploaded_at, zip_count, total_households, filename, source_date
        FROM attendee_upload_log
        ORDER BY uploaded_at DESC
        LIMIT 1
      `,
      sql`
        SELECT county, population, unclaimed
        FROM religious_adherence
      `,
    ])

    // County → unclaimed population lookup
    const unclaimedMap = new Map<string, { population: number; unclaimed: number }>()
    for (const r of adherenceRows) {
      unclaimedMap.set(r.county as string, {
        population: Number(r.population ?? 0),
        unclaimed:  Number(r.unclaimed  ?? 0),
      })
    }

    const masked = rows.map(r => {
      const attendeeHH = r.attendee_hh as number
      const censusHH   = r.census_hh   as number | null
      const suppressed = attendeeHH < PRIVACY_THRESHOLD

      // Penetration = attendee HH as % of census total HH
      const penetrationPct = !suppressed && censusHH && censusHH > 0
        ? Math.round((attendeeHH / censusHH) * 10000) / 100   // 2 decimal places
        : null

      // Unclaimed reach: attendee HH per 1,000 unclaimed residents (county-level join)
      const county = ZIP_COUNTY[r.zip as string]
      const cd     = county ? unclaimedMap.get(county) : null
      const attendeesPer1kUnclaimed = !suppressed && cd?.unclaimed && cd.unclaimed > 0
        ? Math.round((attendeeHH / cd.unclaimed) * 10000) / 10  // 1 decimal place
        : null

      // Derive primary campus (campus with most households in this ZIP)
      const breakdown = r.campus_breakdown as Record<string, number> | null
      const primaryCampus = !suppressed && breakdown
        ? (Object.entries(breakdown).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null)
        : null

      return {
        zip:                     r.zip as string,
        households:              suppressed ? -1 : attendeeHH,
        censusHH:                suppressed ? null : (censusHH ?? null),
        penetrationPct,
        campusBreakdown:         suppressed ? null : (breakdown ?? null),
        primaryCampus,
        county:                  county ?? null,
        attendeesPer1kUnclaimed,
        sourceDate:              r.source_date as string | null,
      }
    })

    const lastUpload = logRows[0]
      ? {
          uploadedAt:      logRows[0].uploaded_at      as string,
          zipCount:        logRows[0].zip_count        as number,
          totalHouseholds: logRows[0].total_households as number,
          filename:        logRows[0].filename         as string | null,
          sourceDate:      logRows[0].source_date      as string | null,
        }
      : null

    return NextResponse.json({ data: masked, lastUpload })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ── POST /api/attendee-density ─────────────────────────────────────────────────
// Accepts a CSV file upload. Handles Rock RMS exports directly:
//   Campus,PostalCodeLeft5,FamilyCount
//
// Also accepts generic format:
//   zip,campus,households
//
// Uses csv-parse to handle quoted campus names that contain commas.
// Rows are upserted — existing rows are overwritten on conflict.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    const sourceDate = (form.get('source_date') as string | null) ?? new Date().toISOString().slice(0, 10)

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const filename = (file as File).name
    const text     = await (file as File).text()

    // Parse CSV with proper quote handling (campus names can contain commas)
    let records: Record<string, string>[]
    try {
      records = parse(text, {
        columns:           (header: string[]) => header.map((h: string) => h.trim().toLowerCase()),
        skip_empty_lines:  true,
        trim:              true,
      })
    } catch {
      return NextResponse.json({ error: 'CSV parse error — ensure the file is valid UTF-8 CSV' }, { status: 400 })
    }

    if (!records.length) {
      return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })
    }

    // Detect column names (Rock RMS or generic)
    const firstRow = records[0]
    const zipKey = ['zip', 'postalcodeleft5', 'postalcode', 'postal_code', 'zip_code']
      .find(k => k in firstRow)
    const hhKey  = ['households', 'familycount', 'family_count', 'count', 'hh_count']
      .find(k => k in firstRow)

    if (!zipKey || !hhKey) {
      return NextResponse.json({
        error: `Missing columns. Found: [${Object.keys(firstRow).join(', ')}]. ` +
               `Need a ZIP column (zip / postalcodeleft5) and a count column (households / familycount).`,
      }, { status: 400 })
    }

    const campusKey         = 'campus' in firstRow ? 'campus' : null
    const EXCLUDED_CAMPUSES = /online|church online|digital|streaming/i

    const skipped = { online: 0, invalidZip: 0, invalidCount: 0, outOfCoverage: 0 }

    const byZip = new Map<string, { total: number; campuses: Record<string, number> }>()

    for (const r of records) {
      const rawZip = r[zipKey]?.trim() ?? ''
      // Normalize: keep only digits, left-pad to 5, truncate to rightmost 5 digits
      const zip    = rawZip.replace(/\D/g, '').padStart(5, '0').slice(-5)
      const hh     = parseInt(r[hhKey] ?? '0', 10)
      const campus = campusKey ? (r[campusKey] ?? 'Unknown').trim() : null

      if (campus && EXCLUDED_CAMPUSES.test(campus)) { skipped.online++;         continue }
      if (!zip || !/^\d{5}$/.test(zip))             { skipped.invalidZip++;     continue }
      if (isNaN(hh) || hh < 0)                      { skipped.invalidCount++;   continue }
      if (!DFW_ZIP_SET.has(zip))                     { skipped.outOfCoverage++;  continue }

      if (!byZip.has(zip)) byZip.set(zip, { total: 0, campuses: {} })
      const entry = byZip.get(zip)!
      entry.total += hh
      if (campus) {
        entry.campuses[campus] = (entry.campuses[campus] ?? 0) + hh
      }
    }

    if (byZip.size === 0) {
      return NextResponse.json({
        error: 'No valid DFW rows found in CSV',
        skipped,
      }, { status: 400 })
    }

    // Upsert all valid DFW rows
    let upserted        = 0
    let totalHouseholds = 0
    for (const [zip, { total, campuses }] of byZip) {
      const breakdown = Object.keys(campuses).length > 0 ? JSON.stringify(campuses) : null
      await sql`
        INSERT INTO attendee_density (zip, total_households, campus_breakdown, source_date, updated_at)
        VALUES (${zip}, ${total}, ${breakdown}::jsonb, ${sourceDate}, NOW())
        ON CONFLICT (zip) DO UPDATE SET
          total_households  = EXCLUDED.total_households,
          campus_breakdown  = EXCLUDED.campus_breakdown,
          source_date       = EXCLUDED.source_date,
          updated_at        = NOW()
      `
      upserted++
      totalHouseholds += total
    }

    // Log the upload for status display
    await sql`
      INSERT INTO attendee_upload_log (zip_count, total_households, filename, source_date)
      VALUES (${upserted}, ${totalHouseholds}, ${filename}, ${sourceDate})
    `

    return NextResponse.json({ ok: true, upserted, totalHouseholds, sourceDate, skipped })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ── DELETE /api/attendee-density ───────────────────────────────────────────────
// Truncates the attendee_density table. Used to reset before a clean re-upload.
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result  = await sql`SELECT COUNT(*) as count FROM attendee_density`
    const deleted = parseInt(result[0].count as string, 10)
    await sql`TRUNCATE TABLE attendee_density`
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
