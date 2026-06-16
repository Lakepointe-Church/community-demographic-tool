import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, zip, area, fit_score, scenario_url, notes, decided_by, logged_at
      FROM decision_log
      ORDER BY logged_at DESC
      LIMIT 100
    `
    return NextResponse.json({ decisions: rows })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { zip, area, fitScore, scenarioUrl, notes, decidedBy } = body
    if (!zip || typeof zip !== 'string' || !/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: 'Invalid ZIP' }, { status: 400 })
    }
    const [row] = await sql`
      INSERT INTO decision_log (zip, area, fit_score, scenario_url, notes, decided_by)
      VALUES (${zip}, ${area ?? null}, ${fitScore ?? null}, ${scenarioUrl ?? null}, ${notes ?? null}, ${decidedBy ?? null})
      RETURNING id, logged_at
    `
    return NextResponse.json({ ok: true, id: row.id, loggedAt: row.logged_at })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
