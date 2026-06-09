import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS } from '@/lib/zips'

// Separate from /api/refresh to avoid Vercel timeout.
// Run after /api/refresh completes, or independently on a slower cadence.
// CFPB data is cumulative (all-time complaints) — monthly refresh is sufficient.

export async function POST() {
  const zips = [...DFW_ZIPS]
  let refreshed = 0
  const errors: string[] = []

  for (let i = 0; i < zips.length; i += 10) {
    const batch = zips.slice(i, i + 10)
    await Promise.allSettled(batch.map(async ({ zip }) => {
      try {
        const res = await fetch(
          `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?size=0&zip_code=${zip}`
        )
        if (!res.ok) return
        const data = await res.json()
        const count: number = data.hits?.total?.value ?? 0
        await sql`
          INSERT INTO community_health (zip, cfpb_complaints, updated_at)
          VALUES (${zip}, ${count}, NOW())
          ON CONFLICT (zip) DO UPDATE SET
            cfpb_complaints = EXCLUDED.cfpb_complaints,
            updated_at      = NOW()
        `
        refreshed++
      } catch (e) {
        errors.push(`ZIP ${zip}: ${String(e)}`)
      }
    }))
  }

  return NextResponse.json({
    ok: errors.length === 0,
    complaintsRefreshed: refreshed,
    errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    refreshedAt: new Date().toISOString(),
  })
}
