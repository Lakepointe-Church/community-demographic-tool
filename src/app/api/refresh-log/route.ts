/**
 * GET /api/refresh-log — recent data-refresh run outcomes (Phase 5.4).
 * Read by /admin/status so a failed/partial monthly refresh is visible.
 * Auth handled by site-wide middleware (Basic for humans, Bearer for automation).
 */

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const runs = await sql`
      SELECT id, job, ok, duration_ms, summary, error_count, errors, logged_at
      FROM refresh_log
      ORDER BY logged_at DESC
      LIMIT 50
    `
    return NextResponse.json({ runs })
  } catch (error) {
    console.error('refresh-log error:', error)
    return NextResponse.json({ error: 'Failed to load refresh log', details: String(error) }, { status: 500 })
  }
}
