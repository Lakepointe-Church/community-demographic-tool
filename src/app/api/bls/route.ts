import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM metro_stats WHERE id = 1`

    if (!rows.length) {
      return NextResponse.json(
        { error: 'No metro stats found. Run POST /api/refresh to populate the database.' },
        { status: 404 }
      )
    }

    const d = rows[0]
    return NextResponse.json({
      area: 'DFW',
      unemploymentRate: {
        latest: d.bls_unemployment_rate?.toString() ?? null,
        period: d.bls_period,
        year:   d.bls_year,
      },
      employedPersons: { latest: d.bls_employed_persons?.toString() ?? null },
      laborForce:      { latest: d.bls_labor_force?.toString() ?? null },
      updatedAt: d.updated_at,
    })
  } catch (error) {
    console.error('BLS DB error:', error)
    return NextResponse.json({ error: 'Failed to fetch BLS data', details: String(error) }, { status: 500 })
  }
}
