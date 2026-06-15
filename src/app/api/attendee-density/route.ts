import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const PRIVACY_THRESHOLD = 5

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
// Returns per-ZIP household counts with privacy masking plus last-upload metadata.
// Auth is handled by middleware (Basic auth for browsers, Bearer for automation).
export async function GET() {
  try {
    const [rows, logRows] = await Promise.all([
      sql`
        SELECT zip, total_households, campus_breakdown, source_date, updated_at
        FROM attendee_density
        ORDER BY total_households DESC
      `,
      sql`
        SELECT uploaded_at, zip_count, total_households, filename, source_date
        FROM attendee_upload_log
        ORDER BY uploaded_at DESC
        LIMIT 1
      `,
    ])

    const masked = rows.map(r => ({
      zip:             r.zip as string,
      households:      (r.total_households as number) < PRIVACY_THRESHOLD ? -1 : (r.total_households as number),
      campusBreakdown: (r.total_households as number) < PRIVACY_THRESHOLD ? null : r.campus_breakdown,
      sourceDate:      r.source_date as string | null,
    }))

    const lastUpload = logRows[0]
      ? {
          uploadedAt:      logRows[0].uploaded_at as string,
          zipCount:        logRows[0].zip_count as number,
          totalHouseholds: logRows[0].total_households as number,
          filename:        logRows[0].filename as string | null,
          sourceDate:      logRows[0].source_date as string | null,
        }
      : null

    return NextResponse.json({ data: masked, lastUpload })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ── POST /api/attendee-density ─────────────────────────────────────────────────
// Accepts a CSV file upload. Expected format (header row required):
//
//   zip,campus,households
//   75087,Rockwall,42
//   75150,Mesquite,18
//
// If no campus column is present, a simpler two-column format is accepted:
//   zip,households
//
// All rows for the same ZIP are aggregated by campus into campus_breakdown JSONB.
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
    const text = await (file as File).text()
    const lines = text.split(/\r?\n/).filter(l => l.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim())

    // Accept Rock RMS column names (PostalCodeLeft5, FamilyCount) alongside generic names
    const zipIdx = ['zip', 'postalcodeleft5', 'postalcode', 'postal_code', 'zip_code']
      .map(n => header.indexOf(n)).find(i => i >= 0) ?? -1
    const hhIdx  = ['households', 'familycount', 'family_count', 'count', 'hh_count']
      .map(n => header.indexOf(n)).find(i => i >= 0) ?? -1

    if (zipIdx < 0 || hhIdx < 0) {
      return NextResponse.json({
        error: 'CSV must have a ZIP column (zip / postalcodeleft5 / postalcode) and a count column (households / familycount)',
      }, { status: 400 })
    }

    const campusIdx = ['campus'].map(n => header.indexOf(n)).find(i => i >= 0) ?? -1

    // Campuses to exclude from geographic analysis (online-only, no physical location)
    const EXCLUDED_CAMPUSES = /online|church online|digital|streaming/i

    // Aggregate rows by ZIP
    const byZip = new Map<string, { total: number; campuses: Record<string, number> }>()

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim())
      const zip  = cols[zipIdx]?.replace(/^0+/, '').padStart(5, '0') ?? ''
      const hh   = parseInt(cols[hhIdx] ?? '0', 10)
      if (!zip || isNaN(hh) || hh < 0) continue

      const campus = campusIdx >= 0 ? (cols[campusIdx] ?? 'Unknown') : null

      // Skip online/non-physical campuses
      if (campus && EXCLUDED_CAMPUSES.test(campus)) continue

      if (!byZip.has(zip)) byZip.set(zip, { total: 0, campuses: {} })
      const entry = byZip.get(zip)!
      entry.total += hh
      if (campus) {
        entry.campuses[campus] = (entry.campuses[campus] ?? 0) + hh
      }
    }

    if (byZip.size === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    // Upsert all rows
    let upserted = 0
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

    return NextResponse.json({ ok: true, upserted, totalHouseholds, sourceDate })
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
    const result = await sql`SELECT COUNT(*) as count FROM attendee_density`
    const deleted = parseInt(result[0].count as string, 10)
    await sql`TRUNCATE TABLE attendee_density`
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
