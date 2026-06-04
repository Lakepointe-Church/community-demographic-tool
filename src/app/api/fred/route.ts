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
      population: {
        latest: {
          value: d.fred_population?.toString() ?? null,
          date:  d.fred_population_date,
        },
      },
      housingPermits: {
        latest: {
          value: d.fred_housing_permits?.toString() ?? null,
          date:  d.fred_housing_permits_date,
        },
      },
      updatedAt: d.updated_at,
    })
  } catch (error) {
    console.error('FRED DB error:', error)
    return NextResponse.json({ error: 'Failed to fetch FRED data', details: String(error) }, { status: 500 })
  }
}
