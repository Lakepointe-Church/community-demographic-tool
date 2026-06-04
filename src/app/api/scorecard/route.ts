import { NextRequest, NextResponse } from 'next/server'

const SCORECARD_BASE = 'https://api.data.ed.gov/student/v1/schools.json'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const zip = searchParams.get('zip')
  const radius = searchParams.get('radius') || '15'

  if (!zip) {
    return NextResponse.json({ error: 'zip parameter is required' }, { status: 400 })
  }

  try {
    const url = new URL(SCORECARD_BASE)
    url.searchParams.set('school.zip', zip)
    url.searchParams.set('zip.radius', radius)
    url.searchParams.set('_fields', [
      'school.name',
      'school.city',
      'school.state',
      'latest.student.size',
      'latest.completion.completion_rate_4yr_150nt',
      'latest.cost.avg_net_price.public',
      'latest.earnings.10_yrs_after_entry.median',
    ].join(','))
    url.searchParams.set('_per_page', '10')
    if (process.env.SCORECARD_API_KEY) {
      url.searchParams.set('api_key', process.env.SCORECARD_API_KEY)
    }

    const response = await fetch(url.toString())
    const data = await response.json()

    return NextResponse.json({
      zip,
      radius,
      total: data.metadata?.total ?? 0,
      schools: (data.results ?? []).map((s: Record<string, unknown>) => ({
        name:              s['school.name'],
        city:              s['school.city'],
        state:             s['school.state'],
        enrollment:        s['latest.student.size'],
        completionRate4yr: s['latest.completion.completion_rate_4yr_150nt'],
        avgNetPrice:       s['latest.cost.avg_net_price.public'],
        medianEarnings10yr:s['latest.earnings.10_yrs_after_entry.median'],
      })),
    })
  } catch (error) {
    console.error('Scorecard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch Scorecard data', details: String(error) }, { status: 500 })
  }
}
