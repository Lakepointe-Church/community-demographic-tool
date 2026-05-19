import { NextResponse } from 'next/server'

const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations'
const FRED_KEY = process.env.FRED_API_KEY

async function fetchSeries(seriesId: string) {
  const url = `${FRED_API_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=24`
  const response = await fetch(url)
  const data = await response.json()
  return data.observations || []
}

export async function GET() {
  try {
    const [population, unemployment, housingPermits] = await Promise.all([
      fetchSeries('DFWPOP'),       // DFW population
      fetchSeries('DALL348URN'),   // DFW unemployment rate
      fetchSeries('DALPOP'), // Dallas area housing permits
    ])

    return NextResponse.json({
      population: {
        latest: population[0],
        history: population.slice(0, 10),
      },
      unemployment: {
        latest: unemployment[0],
        history: unemployment.slice(0, 12),
      },
      housingPermits: {
        latest: housingPermits[0],
        history: housingPermits.slice(0, 12),
      },
    })
  } catch (error) {
    console.error('FRED API error:', error)
    return NextResponse.json({ error: 'Failed to fetch FRED data', details: String(error) }, { status: 500 })
  }
}