import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const SCORECARD_BASE = 'https://api.data.ed.gov/student/v1/schools.json'

const FIELDS = [
  'id', 'school.name', 'school.city', 'school.state',
  'school.institutional_characteristics.level',
  'latest.student.size',
  'latest.completion.completion_rate_4yr_150nt',
  'latest.cost.avg_net_price.public',
  'latest.earnings.10_yrs_after_entry.median',
].join(',')

// ── GET: Neon cache first, live API fallback ──────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const zip = searchParams.get('zip')
  const radius = searchParams.get('radius') || '15'

  if (!zip) return NextResponse.json({ error: 'zip parameter is required' }, { status: 400 })

  // Cache-first (populated by scripts/import-scorecard.ts)
  try {
    const cached = await sql`
      SELECT c.*
      FROM colleges_cache c
      JOIN zip_colleges zc ON c.unit_id = zc.unit_id
      WHERE zc.dfw_zip = ${zip}
        AND (c.iclevel IS NULL OR c.iclevel != 3)
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
    // Cache tables not yet created — fall through to live API
  }

  // Live API fallback (may not be reachable from all environments)
  try {
    const url = new URL(SCORECARD_BASE)
    url.searchParams.set('zip', zip)
    url.searchParams.set('distance', radius)
    url.searchParams.set('_fields', FIELDS)
    url.searchParams.set('_per_page', '10')
    if (process.env.SCORECARD_API_KEY) url.searchParams.set('api_key', process.env.SCORECARD_API_KEY)

    const response = await fetch(url.toString())
    if (!response.ok) {
      console.error('Scorecard API HTTP error:', response.status)
      return NextResponse.json({ zip, radius, total: 0, schools: [] })
    }

    const data = await response.json()
    const results = (data.results ?? []) as Record<string, unknown>[]
    const filtered = results.filter(s => s['school.institutional_characteristics.level'] !== 3)
    return NextResponse.json({
      zip, radius, total: filtered.length, cached: false,
      schools: filtered.map(s => ({
        name:               s['school.name'],
        city:               s['school.city'],
        state:              s['school.state'],
        enrollment:         s['latest.student.size'],
        completionRate4yr:  s['latest.completion.completion_rate_4yr_150nt'],
        avgNetPrice:        s['latest.cost.avg_net_price.public'],
        medianEarnings10yr: s['latest.earnings.10_yrs_after_entry.median'],
      })),
    })
  } catch {
    return NextResponse.json({ zip, radius, total: 0, schools: [] })
  }
}
