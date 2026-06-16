/**
 * GET /api/commute?zip=75126
 *
 * Commute corridors for a ZIP's residents, from LEHD LODES8 origin-destination
 * (intra-DFW flows, block→ZCTA aggregated). Returns:
 *   - totalWorkers / workInZip / selfContainmentPct (live & work in same ZIP)
 *   - direction: job-weighted net commute bearing + compass label + concentration
 *   - corridors: top external work-destination ZIPs (jobs + high-earner share)
 *
 * Graceful degradation: returns { available: false } until import-lodes.ts is run.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS } from '@/lib/zips'
import { ZIP_COUNTY } from '@/lib/zip-county'

const LABELS: Record<string, string> = Object.fromEntries(DFW_ZIPS.map(z => [z.zip, z.label]))

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip) return NextResponse.json({ error: 'zip is required' }, { status: 400 })

  try {
    const [summaryRows, flowRows] = await Promise.all([
      sql`
        SELECT total_workers, work_in_zip, top_dest_zip, net_bearing_deg, direction_label, concentration, year
        FROM commute_summary WHERE home_zip = ${zip} ORDER BY year DESC LIMIT 1
      `,
      sql`
        SELECT work_zip, jobs, high_earner_jobs
        FROM commute_flows WHERE home_zip = ${zip}
        ORDER BY year DESC, jobs DESC LIMIT 12
      `,
    ])

    const s = summaryRows[0]
    if (!s) {
      return NextResponse.json({ available: false, zip, county: ZIP_COUNTY[zip] ?? null })
    }

    const total = s.total_workers as number
    const inZip = s.work_in_zip as number

    const corridors = flowRows.map(r => {
      const jobs = r.jobs as number
      const high = r.high_earner_jobs as number
      return {
        zip: r.work_zip as string,
        label: LABELS[r.work_zip as string] ?? (r.work_zip as string),
        jobs,
        highEarnerJobs: high,
        highPct: jobs > 0 ? Math.round((high / jobs) * 100) : 0,
      }
    })

    return NextResponse.json({
      available: true,
      zip,
      county: ZIP_COUNTY[zip] ?? null,
      year: s.year as number,
      totalWorkers: total,
      workInZip: inZip,
      selfContainmentPct: total > 0 ? parseFloat(((inZip / total) * 100).toFixed(1)) : 0,
      direction: s.direction_label
        ? {
            label: s.direction_label as string,
            bearingDeg: s.net_bearing_deg != null ? parseFloat(s.net_bearing_deg as string) : null,
            concentration: s.concentration != null ? parseFloat(s.concentration as string) : null,
          }
        : null,
      topDestZip: s.top_dest_zip as string | null,
      topDestLabel: s.top_dest_zip ? (LABELS[s.top_dest_zip as string] ?? (s.top_dest_zip as string)) : null,
      corridors,
    })
  } catch (error) {
    console.error('Commute corridors error:', error)
    return NextResponse.json({ error: 'Failed to load commute corridors', details: String(error) }, { status: 500 })
  }
}
