import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS } from '@/lib/zips'

const SCORECARD_BASE = 'https://api.data.ed.gov/student/v1/schools.json'

const FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'latest.student.size',
  'latest.completion.completion_rate_4yr_150nt',
  'latest.cost.avg_net_price.public',
  'latest.earnings.10_yrs_after_entry.median',
].join(',')

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS colleges_cache (
      unit_id              INTEGER PRIMARY KEY,
      name                 TEXT,
      city                 TEXT,
      state                TEXT,
      enrollment           INTEGER,
      completion_rate_4yr  NUMERIC(6,4),
      avg_net_price        INTEGER,
      median_earnings_10yr INTEGER,
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS zip_colleges (
      dfw_zip TEXT,
      unit_id INTEGER,
      PRIMARY KEY (dfw_zip, unit_id)
    )
  `
}

// ── GET: read from Neon cache, fall back to live API ─────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const zip = searchParams.get('zip')
  const radius = searchParams.get('radius') || '15'

  if (!zip) return NextResponse.json({ error: 'zip parameter is required' }, { status: 400 })

  // Cache-first
  try {
    const cached = await sql`
      SELECT c.*
      FROM colleges_cache c
      JOIN zip_colleges zc ON c.unit_id = zc.unit_id
      WHERE zc.dfw_zip = ${zip}
      ORDER BY c.enrollment DESC NULLS LAST
      LIMIT 10
    `
    if (cached.length > 0) {
      return NextResponse.json({
        zip, radius, total: cached.length, cached: true,
        schools: cached.map(c => ({
          name:               c.name,
          city:               c.city,
          state:              c.state,
          enrollment:         c.enrollment,
          completionRate4yr:  c.completion_rate_4yr != null ? parseFloat(String(c.completion_rate_4yr)) : null,
          avgNetPrice:        c.avg_net_price,
          medianEarnings10yr: c.median_earnings_10yr,
        })),
      })
    }
  } catch (_err) {
    // Tables not yet created — fall through to live API
  }

  // Live API fallback
  try {
    const url = new URL(SCORECARD_BASE)
    url.searchParams.set('zip', zip)
    url.searchParams.set('distance', radius)
    url.searchParams.set('_fields', FIELDS)
    url.searchParams.set('_per_page', '10')
    if (process.env.SCORECARD_API_KEY) url.searchParams.set('api_key', process.env.SCORECARD_API_KEY)

    const response = await fetch(url.toString())
    if (!response.ok) {
      const errText = await response.text()
      console.error('Scorecard API HTTP error:', response.status, errText.slice(0, 300))
      return NextResponse.json({ zip, radius, total: 0, schools: [], apiError: response.status })
    }

    const data = await response.json()
    if (!data.results) console.error('Scorecard unexpected response:', JSON.stringify(data).slice(0, 300))

    return NextResponse.json({
      zip, radius, total: data.metadata?.total ?? 0, cached: false,
      schools: (data.results ?? []).map((s: Record<string, unknown>) => ({
        name:               s['school.name'],
        city:               s['school.city'],
        state:              s['school.state'],
        enrollment:         s['latest.student.size'],
        completionRate4yr:  s['latest.completion.completion_rate_4yr_150nt'],
        avgNetPrice:        s['latest.cost.avg_net_price.public'],
        medianEarnings10yr: s['latest.earnings.10_yrs_after_entry.median'],
      })),
    })
  } catch (error) {
    console.error('Scorecard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch Scorecard data', details: String(error) }, { status: 500 })
  }
}

// ── POST: populate Neon cache for all 170 DFW ZIPs ───────────────
// Run annually (or whenever Census data refreshes).
// Takes ~60–90s. Stores colleges within 15 miles of each DFW ZIP.
export async function POST() {
  try {
    await ensureTables()

    const apiKey = process.env.SCORECARD_API_KEY
    let schoolsUpserted = 0
    let mappingsUpserted = 0
    const errors: string[] = []

    for (const { zip } of DFW_ZIPS) {
      try {
        const url = new URL(SCORECARD_BASE)
        url.searchParams.set('zip', zip)
        url.searchParams.set('distance', '15')
        url.searchParams.set('_fields', FIELDS)
        url.searchParams.set('_per_page', '50')
        if (apiKey) url.searchParams.set('api_key', apiKey)

        const response = await fetch(url.toString())
        if (!response.ok) continue

        const data = await response.json()
        const results: Record<string, unknown>[] = data.results ?? []

        for (const s of results) {
          const unitId = s['id'] as number
          if (!unitId) continue

          await sql`
            INSERT INTO colleges_cache
              (unit_id, name, city, state, enrollment, completion_rate_4yr, avg_net_price, median_earnings_10yr, updated_at)
            VALUES (
              ${unitId},
              ${(s['school.name'] as string) ?? null},
              ${(s['school.city'] as string) ?? null},
              ${(s['school.state'] as string) ?? null},
              ${(s['latest.student.size'] as number) ?? null},
              ${(s['latest.completion.completion_rate_4yr_150nt'] as number) ?? null},
              ${(s['latest.cost.avg_net_price.public'] as number) ?? null},
              ${(s['latest.earnings.10_yrs_after_entry.median'] as number) ?? null},
              NOW()
            )
            ON CONFLICT (unit_id) DO UPDATE SET
              name                 = EXCLUDED.name,
              city                 = EXCLUDED.city,
              state                = EXCLUDED.state,
              enrollment           = EXCLUDED.enrollment,
              completion_rate_4yr  = EXCLUDED.completion_rate_4yr,
              avg_net_price        = EXCLUDED.avg_net_price,
              median_earnings_10yr = EXCLUDED.median_earnings_10yr,
              updated_at           = NOW()
          `
          schoolsUpserted++

          await sql`
            INSERT INTO zip_colleges (dfw_zip, unit_id) VALUES (${zip}, ${unitId})
            ON CONFLICT DO NOTHING
          `
          mappingsUpserted++
        }
      } catch (err) {
        errors.push(`ZIP ${zip}: ${String(err).slice(0, 80)}`)
      }
    }

    return NextResponse.json({
      ok: true,
      zipsProcessed: DFW_ZIPS.length,
      schoolsUpserted,
      mappingsUpserted,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('Scorecard refresh error:', error)
    return NextResponse.json({ error: 'Refresh failed', details: String(error) }, { status: 500 })
  }
}
